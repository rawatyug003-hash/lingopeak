// LingoPeak frontend API client.
// Talks to the backend at API_BASE_URL. Tokens are kept in memory + localStorage
// (this is a demo-grade client; for production you'd consider httpOnly cookies
// for the refresh token to reduce XSS exposure).

const API_BASE_URL = window.LINGOPEAK_API_URL || 'https://lingopeak-production.up.railway.app';

const TokenStore = {
  getAccessToken() { return localStorage.getItem('lp_access_token'); },
  getRefreshToken() { return localStorage.getItem('lp_refresh_token'); },
  setTokens({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem('lp_access_token', accessToken);
    if (refreshToken) localStorage.setItem('lp_refresh_token', refreshToken);
  },
  clear() {
    localStorage.removeItem('lp_access_token');
    localStorage.removeItem('lp_refresh_token');
    localStorage.removeItem('lp_user');
  },
  setUser(user) { localStorage.setItem('lp_user', JSON.stringify(user)); },
  getUser() {
    const raw = localStorage.getItem('lp_user');
    return raw ? JSON.parse(raw) : null;
  },
};

/**
 * Fetch wrapper that attaches the access token, and on a 401 with
 * code TOKEN_EXPIRED, transparently refreshes once and retries the request.
 */
async function apiFetch(path, options = {}, _isRetry = false) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const accessToken = TokenStore.getAccessToken();
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401 && !_isRetry) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.code === 'TOKEN_EXPIRED') {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return apiFetch(path, options, true);
      }
    }
  }

  return response;
}

async function tryRefreshToken() {
  const refreshToken = TokenStore.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      TokenStore.clear();
      return false;
    }
    const data = await res.json();
    TokenStore.setTokens(data);
    return true;
  } catch {
    TokenStore.clear();
    return false;
  }
}

async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.details = data.details;
    throw error;
  }
  return data;
}

const Auth = {
  async signup({ email, password, fullName }) {
    const data = await apiJson('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    });
    TokenStore.setTokens(data);
    TokenStore.setUser(data.user);
    return data.user;
  },

  async login({ email, password }) {
    const data = await apiJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    TokenStore.setTokens(data);
    TokenStore.setUser(data.user);
    return data.user;
  },

  async logout() {
    const refreshToken = TokenStore.getRefreshToken();
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Even if the network call fails, clear local tokens so the user is
      // logged out on this device.
    }
    TokenStore.clear();
  },

  async logoutAllDevices() {
    try {
      await apiJson('/api/auth/logout-all', { method: 'POST' });
    } finally {
      TokenStore.clear();
    }
  },

  async getCurrentUser() {
    return apiJson('/api/auth/me');
  },

  isLoggedIn() {
    return Boolean(TokenStore.getAccessToken());
  },
};
