import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import "../styles/results.css";

function getScore(value) {
  if (value === null || value === undefined || value === "") return "—";

  const numeric = Number(value);
  return Number.isNaN(numeric) ? "—" : `${numeric}%`;
}

function getLevelLabel(level) {
  return (
    {
      junior: "Junior",
      middle: "Middle",
      senior: "Senior",
    }[level] || level || "—"
  );
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { attemptId } = useParams();

  const initialResult = state?.result || null;
  const initialQuestions = state?.questions || [];
  const hasInitialQuestions = initialQuestions.length > 0;

  const [result, setResult] = useState(initialResult);
  const [courseQuestions, setCourseQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(!initialResult);
  const [error, setError] = useState("");

  const courseId = result?.course?.id;
  const isFinished = result?.status === "finished";
  const questionSource = hasInitialQuestions ? initialQuestions : courseQuestions;

  useEffect(() => {
    let ignore = false;

    setError("");

    if (!result) {
      setIsLoading(true);
    }

    api
      .get(`/attempts/${attemptId}`)
      .then((res) => {
        if (!ignore) {
          setResult(res.data);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(
            err?.response?.data?.error ||
              err?.message ||
              "Не удалось загрузить результаты"
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [attemptId]);

  useEffect(() => {
    if (!courseId || hasInitialQuestions || !isFinished) return;

    let ignore = false;

    api
      .get(`/courses/${courseId}`)
      .then((res) => {
        if (!ignore) {
          setCourseQuestions(res.data?.questions || []);
        }
      })
      .catch(() => {
        if (!ignore) {
          setCourseQuestions([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, [courseId, hasInitialQuestions, isFinished]);

  const questionMap = useMemo(() => {
    return questionSource.reduce((acc, q) => {
      if (q?.question_id != null) {
        acc[q.question_id] = q.text;
      }
      return acc;
    }, {});
  }, [questionSource]);

  const renderActions = () => (
    <div className="results-actions">
      <button
        className="results-primary-button"
        onClick={() => navigate("/select")}
        type="button"
      >
        Новое собеседование
      </button>

      <button
        className="results-secondary-button"
        onClick={() => navigate("/dashboard")}
        type="button"
      >
        В личный кабинет
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="results-page">
        <div className="results-card">
          <h1>Результаты</h1>
          <p className="subtitle">Итоги собеседования</p>
          <div className="results-section">
            <div className="results-empty">Загрузка результатов...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="results-page">
        <div className="results-card">
          <h1>Результаты</h1>
          <p className="subtitle">Итоги собеседования</p>
          <div className="results-section">
            <div className="results-empty">
              {error || "Результаты не найдены."}
            </div>
          </div>
          {renderActions()}
        </div>
      </div>
    );
  }

  if (!isFinished) {
    return (
      <div className="results-page">
        <div className="results-card">
          <h1>Результаты</h1>
          <p className="subtitle">Итоги собеседования</p>
          <div className="results-section">
            <div className="results-empty">
              Результаты доступны только для завершённых попыток.
            </div>
          </div>
          {renderActions()}
        </div>
      </div>
    );
  }

  const answers = result.answers || [];

  return (
    <div className="results-page">
      <div className="results-card">
        <h1>Результаты</h1>
        <p className="subtitle">Итоги собеседования</p>

        <div className="results-section">
          <h3>Информация о попытке</h3>
          <div className="results-meta">
            {result.course?.name && (
              <div className="results-meta-row">
                <span>Курс</span>
                <span>{result.course.name}</span>
              </div>
            )}
            {result.course?.level && (
              <div className="results-meta-row">
                <span>Уровень</span>
                <span>{getLevelLabel(result.course.level)}</span>
              </div>
            )}
            <div className="results-meta-row">
              <span>Количество ответов</span>
              <span>{answers.length}</span>
            </div>
          </div>
        </div>

        <div className="results-section">
          <h3>Общий результат</h3>
          <div className="results-score-grid">
            <div className="results-score-box">
              <div className="results-score-label">Качество ответа</div>
              <div className="results-score-value">
                {getScore(result.overall_answer_score)}
              </div>
            </div>
            <div className="results-score-box">
              <div className="results-score-label">Качество речи</div>
              <div className="results-score-value">
                {getScore(result.overall_speech_score)}
              </div>
            </div>
          </div>

          <div className="results-feedback-list">
            <div className="results-feedback-item">
              <div className="results-feedback-title">
                Отзыв по качеству ответа
              </div>
              <p>{result.overall_answer_feedback || "Комментарий отсутствует"}</p>
            </div>
            <div className="results-feedback-item">
              <div className="results-feedback-title">Отзыв по качеству речи</div>
              <p>{result.overall_speech_feedback || "Комментарий отсутствует"}</p>
            </div>
          </div>
        </div>

        <div className="results-section">
          <h3>Результаты по вопросам</h3>
          {answers.length > 0 ? (
            <div className="results-answers-list">
              {answers.map((ans) => (
                <div key={ans.question_id} className="results-answer-card">
                  <div className="results-question">
                    {questionMap[ans.question_id] || `Вопрос #${ans.question_id}`}
                  </div>

                  <div className="results-score-grid results-score-grid-inner">
                    <div className="results-score-box">
                      <div className="results-score-label">Качество ответа</div>
                      <div className="results-score-value small">
                        {getScore(ans.answer_score)}
                      </div>
                    </div>
                    <div className="results-score-box">
                      <div className="results-score-label">Качество речи</div>
                      <div className="results-score-value small">
                        {getScore(ans.speech_score)}
                      </div>
                    </div>
                  </div>

                  <div className="results-feedback-list">
                    <div className="results-feedback-item">
                      <div className="results-feedback-title">
                        Отзыв по качеству ответа
                      </div>
                      <p>{ans.answer_feedback || "Комментарий отсутствует"}</p>
                    </div>
                    <div className="results-feedback-item">
                      <div className="results-feedback-title">
                        Отзыв по качеству речи
                      </div>
                      <p>{ans.speech_feedback || "Комментарий отсутствует"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">Ответы не найдены</p>
          )}
        </div>

        {renderActions()}
      </div>
    </div>
  );
}