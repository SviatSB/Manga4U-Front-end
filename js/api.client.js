// =====================================================
//  Manga4U — api.client.js (v4, стабільна версія)
// =====================================================

// 🔧 Базовий URL API (обовʼязково має бути в .env)
const API_BASE = import.meta.env.VITE_API_BASE;
if (!API_BASE) {
  throw new Error("❌ VITE_API_BASE is not set in .env");
}

// =====================================================
//  JWT TokenStore
// =====================================================
const TokenStore = {
  localKey: "m4u_token",
  sessionKey: "m4u_token_session",

  get() {
    return (
      localStorage.getItem(this.localKey) ||
      sessionStorage.getItem(this.sessionKey) ||
      null
    );
  },

  set(token, remember = false) {
    if (remember) {
      localStorage.setItem(this.localKey, token);
    } else {
      sessionStorage.setItem(this.sessionKey, token);
    }
  },

  clear() {
    localStorage.removeItem(this.localKey);
    sessionStorage.removeItem(this.sessionKey);
  },
};

// =====================================================
//  apiFetch — універсальний HTTP-клієнт
// =====================================================
async function apiFetch(path, options = {}) {
  const token = TokenStore.get();

  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!response.ok) {
    const err = new Error(json?.message || json || response.statusText);
    err.status = response.status;

    // якщо токен протух — чистимо
    if (err.status === 401) TokenStore.clear();

    throw err;
  }

  return json;
}

// глобально
window.apiFetch = apiFetch;


// =====================================================
//  Auth manager — login / me / logout
// =====================================================
window.Auth = {
  async login(login, password, remember = false) {
    const result = await fetch(`${API_BASE}/api/Account/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });

    const text = await result.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!result.ok) {
      throw new Error(data?.message || "Login failed");
    }

    const token = data?.token;
    if (!token) throw new Error("Server did not return token");

    TokenStore.set(token, remember);
    return token;
  },

  async me(strict = false) {
    const token = TokenStore.get();
    if (!token) {
      if (strict) throw new Error("No token");
      return null;
    }

    try {
      return await apiFetch("/api/Account/me");
    } catch (err) {
      if (err.status === 401) TokenStore.clear();
      if (strict) throw err;
      return null;
    }
  },

  logout() {
    TokenStore.clear();
    location.href = "./auth.html";
  },
};

// експорти
window.TokenStore = TokenStore;
