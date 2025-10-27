// ===== Manga4U api.client.js (v3.1 — з підтримкою login і токена) =====

// 🌍 Базова адреса бекенду
window.API_BASE = window.API_BASE || 'https://manga4u-164617ec4bac.herokuapp.com';

// --------------------------------------------------
// 🔐 TokenStore — єдиний механізм зберігання JWT
// --------------------------------------------------
const TokenStore = {
  localKey: 'm4u_token',
  sessionKey: 'm4u_token_session',

  get() {
    return (
      localStorage.getItem(this.localKey) ||
      sessionStorage.getItem(this.sessionKey) ||
      sessionStorage.getItem('m4u_token') || // fallback для старих сторінок
      null
    );
  },

  set(token, remember = false) {
    if (remember) localStorage.setItem(this.localKey, token);
    else sessionStorage.setItem(this.sessionKey, token);
  },

  clear() {
    localStorage.removeItem(this.localKey);
    sessionStorage.removeItem(this.sessionKey);
  },
};

// --------------------------------------------------
// 🌐 apiFetch — універсальний запит до API
// --------------------------------------------------
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('m4u_token') || sessionStorage.getItem('m4u_token');
  const headers = new Headers(options.headers || {});

  // если отправляем JSON — ставим правильный заголовок
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const err = new Error(data?.message || data || response.statusText);
    err.status = response.status;
    throw err;
  }

  return data;
}

window.apiFetch = apiFetch;

// --------------------------------------------------
// 👤 Auth — універсальний менеджер користувача
// --------------------------------------------------
window.Auth = {
  /**
   * Увійти в акаунт і зберегти токен
   * @param {string} login
   * @param {string} password
   * @param {boolean} remember
   */
  async login(login, password, remember = false) {
    const res = await fetch(`${API_BASE}/api/Account/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const msg = data?.message || data || 'Помилка авторизації';
      throw new Error(msg);
    }

    const token = data?.token;
    if (!token) throw new Error('Сервер не повернув токен');

    TokenStore.set(token, remember);
    console.log('✅ Token saved:', token.slice(0, 30) + '...');
    return token;
  },

  /**
   * Отримати поточного користувача
   * @param {boolean} strict - якщо true — кине помилку при 401
   * @returns {Promise<object|null>}
   */
  async me(strict = false) {
    const token = TokenStore.get();
    if (!token) {
      if (strict) throw new Error('No token');
      return null;
    }

    try {
      const me = await apiFetch('/api/Account/me', { method: 'GET' });
      return me;
    } catch (err) {
      if (err.status === 401) TokenStore.clear();
      if (strict) throw err;
      return null;
    }
  },

  /**
   * Перевірити роль користувача
   * @param {object} user - обʼєкт користувача
   * @param {string} role - назва ролі ("admin", "owner", "user")
   */
  hasRole(user, role) {
    const roles = (user?.roles || user?.role || []).map((r) =>
      String(r).toLowerCase()
    );
    return roles.includes(role.toLowerCase());
  },

  /**
   * Вийти з акаунту
   */
  logout() {
    TokenStore.clear();
    location.href = './auth.html';
  },
};

// --------------------------------------------------
// 🌎 Експортуємо глобально
// --------------------------------------------------
window.apiFetch = apiFetch;
window.TokenStore = TokenStore;
