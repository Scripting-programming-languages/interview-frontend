import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import '../styles/auth.css';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await api.post('/auth/login', formData);
      
      if (response.status === 200) {
        const { access_token, refresh_token } = response.data;

        localStorage.setItem('accessToken', access_token);
        localStorage.setItem('refreshToken', refresh_token);

        navigate('/dashboard');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Ошибка входа';
      setError(errorMessage);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleLogin}>
        <h2>Вход</h2>
        
        {error && <p className="error-message">{error}</p>}

        <div className="input-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="user@example.com"
            required
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div className="input-field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            value={formData.password}
            onChange={handleChange}
          />
        </div>

        <button type="submit" className="auth-button">
          Войти
        </button>
        
        <p onClick={() => navigate('/register')} className="link">
          Создать аккаунт
        </p>
      </form>
    </div>
  );
}