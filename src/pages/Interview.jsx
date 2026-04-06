import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import "../styles/interview.css";

export default function InterviewPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const [audioBlob, setAudioBlob] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);

  const mediaRecorderRef = useRef(null); // экземпляр MediaRecorder
  const mediaStreamRef = useRef(null); // поток микрофона
  const audioChunksRef = useRef([]);
  const recordStartedAtRef = useRef(null);

  const currentQuestion = questions[current];
  const isAnswered = !!audioBlob;

  useEffect(() => {
    let ignore = false;

    async function startInterview() {
      try {
        setIsPageLoading(true);
        setError("");

        const { data } = await api.post(`/courses/${courseId}/attempt`);

        if (ignore) return;

        setAttemptId(data.attempt_id);
        setQuestions(data.questions || []);
      } catch (err) {
        if (!ignore) {
          setError(
            err?.response?.data?.error ||
              err.message ||
              "Не удалось начать собеседование"
          );
        }
      } finally {
        if (!ignore) setIsPageLoading(false);
      }
    }

    startInterview();

    return () => {
      ignore = true;
      stopMediaTracks();
    };
  }, [courseId]);

  const progress = useMemo(() => {
    if (!questions.length) return 0;
    return ((current + 1) / questions.length) * 100;
  }, [current, questions.length]);

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
    const formData = new FormData();
    formData.append("user_answer", audioBlob, "answer.webm");
    formData.append("audio_duration", String(Math.round(audioDuration)));

    await api.post(
      `/attempts/${attemptId}/questions/${currentQuestion.question_id}/answer`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  }

  async function finishInterview({ goToResults = true } = {}) {
    if (!attemptId) return;

    const { data } = await api.patch(`/attempts/${attemptId}/finish`);
    if (goToResults) {
      navigate(`/results/${attemptId}`, {
        state: { result: data, questions },
      });
    } else {
      navigate("/dashboard");
    }
  }

  async function handleRecord() {
    if (isPending) return;
    isRecording ? stopRecording() : startRecording();
  }

  async function handleNext() {
    if (
      isPending ||
      isRecording ||
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

      if (current === questions.length - 1) {
        await finishInterview({ goToResults: true });
      } else {
        setCurrent((prev) => prev + 1);
        setAudioBlob(null);
        setAudioDuration(0);
        setIsPending(false);
      }
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err.message ||
          "Не удалось отправить ответ"
      );
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
          err.message ||
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
          <div className="question-card">Загрузка вопросов...</div>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="interview-page">
        <div className="interview-card">
          <h1>Собеседование</h1>
          <div className="question-card">{error || "Вопросы не найдены"}</div>
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
            disabled={isPending || isRecording}
            type="button"
          >
            Завершить
          </button>
        </div>

        <div className="progress-block">
          <span>
            Вопрос {current + 1} из {questions.length}
          </span>
          <div className="progress-bar">
            <div style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="question-card">{currentQuestion.text}</div>

        <button
          className={`record-circle ${isRecording ? "active" : ""}`}
          onClick={handleRecord}
          disabled={isPending}
          aria-label={isRecording ? "Остановить запись" : "Начать запись"}
          type="button"
        />

        {error && <div className="error-text">{error}</div>}

        <button
          className="next-button"
          disabled={!isAnswered || isRecording || isPending}
          onClick={handleNext}
          type="button"
        >
          {isPending
            ? "Обработка..."
            : current === questions.length - 1
            ? "Завершить интервью"
            : "Следующий вопрос"}
        </button>
      </div>
    </div>
  );
}