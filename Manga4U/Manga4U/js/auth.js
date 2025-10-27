/* ========= Config ========= */
const API_BASE = 'https://manga4u-164617ec4bac.herokuapp.com';

/* ========= TokenStore ========= */
const TokenStore = {
  key: 'm4u_token',
  skey: 'm4u_token_session',
  get() {
    return localStorage.getItem(this.key) || sessionStorage.getItem(this.skey);
  },
  set(token, remember = true) {
    if (!token) {
      console.error("❌ Token is empty, not saving");
      return;
    }
    if (remember) {
      localStorage.setItem(this.key, token);
      console.log("✅ Token saved permanently (localStorage):", token.slice(0, 25) + "...");
    } else {
      sessionStorage.setItem(this.skey, token);
      console.log("✅ Token saved for session:", token.slice(0, 25) + "...");
    }
  },
  clear() {
    localStorage.removeItem(this.key);
    sessionStorage.removeItem(this.skey);
  }
};

/* ========= API (JSON + Auth + CORS) ========= */
async function apiFetch(path, options = {}) {
  const token = TokenStore.get();
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body && !(options.body instanceof FormData)
      ? JSON.stringify(options.body)
      : options.body,
    credentials: 'include' // 🆕 дозволяє CORS для JWT
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = (data && (data.message || data.title)) || data || res.statusText;
    throw new Error(message);
  }
  return data;
}

/* ========= Tabs ========= */
const tabLoginBtn = document.getElementById('tab-login-btn');
const tabRegisterBtn = document.getElementById('tab-register-btn');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');

function switchTab(tab) {
  const isLogin = tab === 'login';
  tabLoginBtn.classList.toggle('auth__tab--active', isLogin);
  tabRegisterBtn.classList.toggle('auth__tab--active', !isLogin);
  formLogin.classList.toggle('form--visible', isLogin);
  formRegister.classList.toggle('form--visible', !isLogin);
}
tabLoginBtn.addEventListener('click', () => switchTab('login'));
tabRegisterBtn.addEventListener('click', () => switchTab('register'));
document.querySelectorAll('[data-switch]')
  .forEach(b => b.addEventListener('click', () => switchTab(b.dataset.switch)));

/* ========= Toggle password ========= */
document.querySelectorAll('.form__togglePass').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

/* ========= LOGIN (always saves to localStorage) ========= */
formLogin.addEventListener('submit', async e => {
  e.preventDefault();
  const login = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const msgBox = document.getElementById('login-messages');

  try {
    const res = await apiFetch('/api/Account/login', {
      method: 'POST',
      body: { login, password }
    });

    if (!res || !res.token) throw new Error('Сервер не повернув токен!');
    TokenStore.set(res.token, true); // 🔥 сохраняем в localStorage всегда

    msgBox.textContent = '✅ Вхід успішний!';
    console.log('✅ Token отримано:', res.token);
    console.log('📦 Token check:', TokenStore.get());

    // Небольшая задержка для UI
    setTimeout(() => (location.href = './index.html'), 800);
  } catch (err) {
    console.error("Login error:", err);
    msgBox.textContent = '❌ ' + (err.message || 'Помилка входу');
  }
});

/* ========= REGISTER (fixed + auto-login) ========= */
formRegister.addEventListener('submit', async e => {
  e.preventDefault();
  const nickname = document.getElementById('reg-nickname').value.trim();
  const login = document.getElementById('reg-login').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const password2 = document.getElementById('reg-password2').value.trim();
  const terms = document.getElementById('reg-terms').checked;
  const msgBox = document.getElementById('register-messages');

  if (!terms) return (msgBox.textContent = '❌ Підтвердіть згоду з правилами');
  if (password !== password2)
    return (msgBox.textContent = '❌ Паролі не збігаються');

  try {
    await apiFetch('/api/Account/register', {
      method: 'POST',
      body: { login, password, nickname }
    });
    msgBox.textContent = '✅ Реєстрація успішна!';

    const res = await apiFetch('/api/Account/login', {
      method: 'POST',
      body: { login, password }
    });
    console.log('📦 Full response object:', res);
    if (!res || !res.token) throw new Error('Сервер не повернув токен!');
    TokenStore.set(res.token, true); // 🔥 localStorage

    console.log('✅ Token після реєстрації:', res.token);
    setTimeout(() => (location.href = './index.html'), 800);
  } catch (err) {
    console.error("Register error:", err);
    msgBox.textContent = '❌ ' + (err.message || 'Помилка реєстрації');
  }
});
