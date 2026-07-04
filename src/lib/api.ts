// Axios-based HTTP client for the Dafater API.
// Keeps the same `api.get/post/patch/put/del` surface used across all modules,
// but adds interceptors (auth header, 401 handling, error normalization).
import axios, { AxiosError, AxiosInstance } from 'axios';
import { toast } from './toast';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'dafater-token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export const http: AxiosInstance = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

// attach bearer token on every request
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// normalize errors + handle expired/invalid sessions
http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<any>) => {
    const status = error.response?.status;

    if (status === 401 && typeof window !== 'undefined') {
      setToken(null);
      // also drop the cached user, otherwise a stale user (e.g. after the token
      // is revoked) keeps bouncing the app /login -> /dashboard -> 401 -> /login
      localStorage.removeItem('dafater-user');
      if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/order')) {
        location.href = '/login';
      }
    }

    const body = error.response?.data;
    const message = Array.isArray(body?.message)
      ? body.message.join('، ')
      : body?.message || error.message || `HTTP ${status ?? ''}`.trim();

    toast.error(message);
    return Promise.reject(new Error(message));
  },
);

export const api = {
  get: <T>(path: string) => http.get<T>(path).then((r) => r.data),
  post: <T>(path: string, body?: unknown) => http.post<T>(path, body ?? {}).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => http.patch<T>(path, body ?? {}).then((r) => r.data),
  put: <T>(path: string, body?: unknown) => http.put<T>(path, body ?? {}).then((r) => r.data),
  del: <T>(path: string) => http.delete<T>(path).then((r) => r.data),
};
