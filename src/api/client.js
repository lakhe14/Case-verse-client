import axios from 'axios';

const ACCESS_KEY = 'cv_access';
const REFRESH_KEY = 'cv_refresh';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY) || null;
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY) || null;
  },
  set({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single-flight refresh: queue requests while a refresh is in progress.
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    if (!response || response.status !== 401 || config._retried) {
      return Promise.reject(normalizeError(error));
    }
    const code = response.data?.error?.code;
    if (code !== 'invalid_token' && code !== 'missing_token') {
      return Promise.reject(normalizeError(error));
    }
    const refreshToken = tokenStore.refresh;
    if (!refreshToken) {
      tokenStore.clear();
      return Promise.reject(normalizeError(error));
    }

    try {
      if (!refreshing) {
        refreshing = axios
          .post((import.meta.env.VITE_API_URL || '') + '/api/auth/refresh', { refreshToken })
          .then((r) => {
            tokenStore.set(r.data);
            return r.data.accessToken;
          })
          .finally(() => {
            refreshing = null;
          });
      }
      const newAccess = await refreshing;
      config._retried = true;
      config.headers.Authorization = `Bearer ${newAccess}`;
      return api(config);
    } catch (e) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('cv:auth-expired'));
      return Promise.reject(normalizeError(error));
    }
  }
);

export function normalizeError(error) {
  const data = error.response?.data;
  const message = data?.error?.message || error.message || 'Request failed';
  const wrapped = new Error(message);
  wrapped.code = data?.error?.code || 'network_error';
  wrapped.status = error.response?.status;
  wrapped.details = data?.error?.details;
  return wrapped;
}

export default api;
