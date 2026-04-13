import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import '../styles/select.css';

export default function SelectRole() {
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        setCategories(res.data);
      } catch (err) {
        setError('Не удалось загрузить данные. Попробуйте позже.');
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategoryId) {
      setError(null);
      setCourses([]);
      api.get(`/courses?category_id=${selectedCategoryId}`)
        .then(res => setCourses(res.data))
        .catch(() => setError('Ошибка при загрузке списка курсов.'));
    }
  }, [selectedCategoryId]);

  const handleStartInterview = async () => {
    if (!selectedCourseId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.post(`/v2/courses/${selectedCourseId}/attempt`);
      const attemptData = response.data;

      navigate(`/interview/${selectedCourseId}`, {
        state: {
          attemptId: attemptData.attempt_id,
          courseId: attemptData.course_id,
          status: attemptData.status,
          timestampStart: attemptData.timestamp_start ?? null,
        },
      });
    } catch (err) {
      const message = err.response?.data?.error || 'Не удалось создать сессию интервью.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="select-container">
        <div className="select-card">
          <h1>Выбор специальности</h1>
          <p className="subtitle">Выберите направление и уровень</p>

          {error && <p className="error-message">{error}</p>}
          
          <div className="roles">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`role-card ${selectedCategoryId === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategoryId(cat.id);
                  setSelectedCourseId(null);
                }}
              >
                {cat.name}
              </div>
            ))}
          </div>

          {selectedCategoryId && (
            <div className="courses-section">
              <div className="section-header">Доступные уровни</div>
              <div className="courses-list">
                {courses.length > 0 ? (
                  courses.map((course) => (
                    <div
                      key={course.id}
                      className={`course-card-item ${selectedCourseId === course.id ? 'active' : ''}`}
                      onClick={() => setSelectedCourseId(course.id)}
                    >
                      <div className="course-details">
                        <span className="course-name">{course.name}</span>
                        <span className="course-level-tag">{course.level}</span>
                      </div>
                      <div className="selection-dot"></div>
                    </div>
                  ))
                ) : (
                  !error && <p className="empty-message">Курсов пока нет</p>
                )}
              </div>
            </div>
          )}

          <button
            className="start-button"
            disabled={!selectedCourseId || loading}
            onClick={handleStartInterview}
          >
            {"Начать собеседование"}
          </button>
        </div>
      </div>
    </div>
  );
}