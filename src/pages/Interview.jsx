import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { streamNextQuestion } from "../api/questionStream";
import "../styles/interview.css";

export default function InterviewPage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const attemptId = state?.attemptId ?? null;
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionText, setQuestionText] = useState("");
  const [questionIndex, setQuestionIndex] = useState(1);

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isQuestionLoading, setIsQuestionLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const [audioBlob, setAudioBlob] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordStartedAtRef = useRef(null);

  const isAnswered = !!audioBlob;

  useEffect(() => {
    let ignore = false;

    async function loadFirstQuestion() {
      if (!attemptId) {
        navigate("/");
        return;
      }

      try {
        setIsPageLoading(true);
        setError("");
        setCurrentQuestion(null);
        setQuestionText("");

        const question = await streamNextQuestion({
          attemptId,
          onDelta: (fullText) => {
            if (!ignore) {
              setQuestionText(fullText);
            }
          },
        });

        if (ignore) return;

        setCurrentQuestion(question);
        setQuestionText(question.full_text || "");
      } catch (err) {
        if (!ignore) {
          setError(err?.message || "Не удалось получить вопрос");
        }
      } finally {
        if (!ignore) {
          setIsPageLoading(false);
        }
      }
    }

    loadFirstQuestion();

    return () => {
      ignore = true;
      stopMediaTracks();
    };
  }, [attemptId, navigate]);

  function stopMediaTracks() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  async function startRecording() {
    if (!window.MediaRecorder) {
      setError("Ваш браузер не поддерживает запись аудио");
      return;
    }

    stopMediaTracks();

    try {
      setError("");
      setAudioBlob(null);
      setAudioDuration(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = "";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob =
          audioChunksRef.current.length > 0
            ? new Blob(audioChunksRef.current, {
                type: recorder.mimeType || "audio/webm",
              })
            : null;

        setAudioBlob(blob || null);
        stopMediaTracks();
      };

      recordStartedAtRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
    } catch {
      setError("Не удалось получить доступ к микрофону");
      setIsRecording(false);
      stopMediaTracks();
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const duration = recordStartedAtRef.current
      ? (Date.now() - recordStartedAtRef.current) / 1000
      : 0;

    setAudioDuration(duration);
    setIsRecording(false);

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  async function submitCurrentAnswer() {
    if (!attemptId || !currentQuestion?.question_id || !audioBlob) {
      throw new Error("Нет данных для отправки ответа");
    }

    const formData = new FormData();
    formData.append("user_answer", audioBlob, "answer.webm");
    formData.append("audio_duration", String(Math.round(audioDuration)));

    await api.post(
      `/attempts/${attemptId}/questions/${currentQuestion.question_id}/answer`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  }

  async function loadNextQuestion() {
    setIsQuestionLoading(true);
    setCurrentQuestion(null);
    setQuestionText("");
    setAudioBlob(null);
    setAudioDuration(0);

    try {
      const question = await streamNextQuestion({
        attemptId,
        onDelta: (fullText) => {
          setQuestionText(fullText);
        },
      });

      setCurrentQuestion(question);
      setQuestionText(question.full_text || "");
      setQuestionIndex((prev) => prev + 1);
    } finally {
      setIsQuestionLoading(false);
    }
  }

  async function finishInterview({ goToResults = true } = {}) {
    if (!attemptId) return;

    const { data } = await api.patch(`/attempts/${attemptId}/finish`);

    if (goToResults) {
      navigate(`/results/${attemptId}`, {
        state: { result: data },
      });
    } else {
      navigate("/dashboard");
    }
  }

  async function handleRecord() {
    if (isPending || isQuestionLoading) return;
    isRecording ? stopRecording() : startRecording();
  }

  async function handleNext() {
    if (
      isPending ||
      isRecording ||
      isQuestionLoading ||
      !attemptId ||
      !currentQuestion ||
      !audioBlob
    ) {
      return;
    }

    setIsPending(true);
    setError("");

    try {
      await submitCurrentAnswer();
      await loadNextQuestion();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Не удалось отправить ответ или получить следующий вопрос"
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleFinishEarly() {
    if (isPending || isRecording || !attemptId) return;

    setIsPending(true);
    setError("");

    try {
      if (audioBlob && currentQuestion) {
        await submitCurrentAnswer();
      }

      await finishInterview({ goToResults: false });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Не удалось завершить собеседование"
      );
      setIsPending(false);
    }
  }

  if (isPageLoading) {
    return (
      <div className="interview-page">
        <div className="interview-card">
          <h1>Собеседование</h1>
          <div className="question-card">Загрузка вопроса...</div>
        </div>
      </div>
    );
  }

  if (error && !currentQuestion && !questionText) {
    return (
      <div className="interview-page">
        <div className="interview-card">
          <h1>Собеседование</h1>
          <div className="question-card">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="interview-page">
      <div className="interview-card">
        <div className="top-bar">
          <h1>Собеседование</h1>
          <button
            className="finish-btn"
            onClick={handleFinishEarly}
            disabled={isPending || isRecording || isQuestionLoading}
            type="button"
          >
            Завершить
          </button>
        </div>

        <div className="progress-block">
          <span>Вопрос {questionIndex}</span>
        </div>

        <div className="question-card">
          {questionText || (isQuestionLoading ? "Загрузка следующего вопроса..." : "Вопрос не получен")}
        </div>

        <button
          className={`record-circle ${isRecording ? "active" : ""}`}
          onClick={handleRecord}
          disabled={isPending || isQuestionLoading || !currentQuestion}
          aria-label={isRecording ? "Остановить запись" : "Начать запись"}
          type="button"
        />

        {error && <div className="error-text">{error}</div>}

        <button
          className="next-button"
          disabled={!isAnswered || isRecording || isPending || isQuestionLoading || !currentQuestion}
          onClick={handleNext}
          type="button"
        >
          {isPending || isQuestionLoading ? "Обработка..." : "Следующий вопрос"}
        </button>
      </div>
    </div>
  );
}