import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios'; 
import '../styles/dashboard.css';
import '../styles/auth.css'; 

export default function Dashboard() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        setError(null);
        const userId = localStorage.getItem('userId'); 
        
        const response = await api.get(`/users/${userId}/attempts`);
        setAttempts(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        const message = err.response?.data?.error || 'Не удалось загрузить историю попыток';
        setError(message);
      }
    };
    fetchAttempts();
  }, []);

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  };

  const statusLabels = { 
    'in_progress': 'В процессе', 
    'finished': 'Завершено', 
    'abandoned': 'Прервано' 
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-card">
        <h1>Личный кабинет</h1>
        <p className="subtitle">История собеседований</p>
        
        <div className="section">
          <h3>Ваши результаты</h3>

          {error && <p className="error-message">{error}</p>}

          <div className="history-list">
          {attempts.length > 0 ? (
            attempts.map((item) => (
              <div 
                key={item.attempt_id} 
                className={`history-item ${item.status !== 'finished' ? 'disabled' : ''}`}
                onClick={() => {
                  if (item.status === 'finished') {
                    navigate(`/results/${item.attempt_id}`);
                  }
                }}
              >
                <div className="left">
                  <div className="role">{item.course?.name}</div>
                  <div className="date">
                    {formatDate(item.timestamp_start)} · {statusLabels[item.status]}
                  </div>
                </div>

                <div className="right">
                  <div className="score">
                    {item.status === 'finished' && item.overall_score !== null 
                      ? `${item.overall_score}%` 
                      : '—'}
                  </div>
                </div>
              </div>
            ))
          ) : (
            !error && <p className="empty-message">У вас ещё не было собеседований!</p>
          )}
          </div>
        </div>
        <button className="start-button" onClick={() => navigate('/select')}>
          Начать новое собеседование
        </button>
      </div>
    </div>
  );
}