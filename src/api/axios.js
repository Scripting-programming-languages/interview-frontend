import axios from 'axios';

const BASE_URL = 'http://localhost:8081';

const api = axios.create({
  baseURL: BASE_URL,
});

let refreshTimer = null;

export const storage = {
  get: (key) => {
    const val = localStorage.getItem(key);
    return (val === 'undefined' || val === 'null') ? null : val;
  },
  set: (access, refresh) => {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  },
  clear: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
};

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch { return null; }
}

export function initAuth() {
  const token = storage.get('accessToken');
  if (token) {
    scheduleTokenRefresh(token);
  }
}

async function refreshTokens() {
  try {
    const refreshToken = storage.get('refreshToken');
    if (!refreshToken) throw new Error();

    const res = await axios.post(`${BASE_URL}/auth/refresh_token`, {}, {
      headers: { Authorization: `Bearer ${refreshToken}` }
    });

    const { access_token, refresh_token } = res.data;
    storage.set(access_token, refresh_token);
    scheduleTokenRefresh(access_token);
    return access_token;
  } catch (e) {
    logoutUser();
    throw e;
  }
}

export function scheduleTokenRefresh(token) {
  if (refreshTimer) clearTimeout(refreshTimer);
  
  const accessToken = token || storage.get('accessToken');
  const payload = parseJwt(accessToken);
  if (!payload?.exp) return;

  const delay = (payload.exp * 1000) - Date.now() - 60000; // за 1 мин до конца
  refreshTimer = setTimeout(refreshTokens, Math.max(delay, 0));
}

// Интерцептор запросов
api.interceptors.request.use((config) => {
  const token = storage.get('accessToken');
  if (token && !config.url.includes('/auth/')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Интерцептор ответов
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const isAuthError = error.response?.status === 401 || error.response?.status === 403;
    const isRefreshRequest = originalRequest.url.includes('/auth/refresh_token');

    if (isAuthError && !originalRequest._retry && !isRefreshRequest) {
      originalRequest._retry = true;
      const newToken = await refreshTokens();
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    }
    return Promise.reject(error);
  }
);

function logoutUser() {
  clearTimeout(refreshTimer);
  storage.clear();
  if (window.location.pathname !== '/login') window.location.href = '/login';
}

export default api;