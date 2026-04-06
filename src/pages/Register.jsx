import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api, { storage, initAuth } from '../api/axios'; 
import '../styles/auth.css';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    birthdate: ''
  });
  
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await api.post('/auth/register', formData);

      if (response.status === 200) {
        const { access_token, refresh_token } = response.data;
        storage.set(access_token, refresh_token);
        const decoded = jwtDecode(access_token);
        localStorage.setItem('userId', decoded.user_id);
        initAuth();
        navigate('/dashboard'); 
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Ошибка при регистрации';
      setError(errorMessage);
    } 
  };

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleRegister}>
        <h2>Регистрация</h2>

        {error && <p className="error-message">{error}</p>}

        <div className="input-field">
          <label htmlFor="name">Имя</label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Иван Иванов"
            required
            value={formData.name}
            onChange={handleChange}
          />
        </div>

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
          <label htmlFor="birthdate">Дата рождения</label>
          <input
            id="birthdate"
            name="birthdate"
            type="date"
            value={formData.birthdate}
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
          Создать аккаунт
        </button>

        <p onClick={() => navigate('/login')} className="link">
          Уже есть аккаунт? Войти
        </p>
      </form>
    </div>
  );
}