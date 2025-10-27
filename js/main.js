/* ========= Config ========= */
window.API_BASE = window.API_BASE || 'https://manga4u-164617ec4bac.herokuapp.com';

/* ========= Token store ========= */
const TokenStore = {
  key: 'm4u_token', skey: 'm4u_token_session',
  get() {
    return localStorage.getItem(this.key) ||
           sessionStorage.getItem(this.skey) || null;
  },
  set(t, remember) {
    (remember ? localStorage : sessionStorage)
      .setItem(remember ? this.key : this.skey, t);
  },
  clear() {
    localStorage.removeItem(this.key);
    sessionStorage.removeItem(this.skey);
  }
};

/* ========= Fetch helper (JSON + JWT) ========= */
async function apiFetch(path, { method='GET', headers={}, body=null } = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const h = new Headers(headers);
  if (body && !h.has('Content-Type')) h.set('Content-Type','application/json');
  const token = TokenStore.get();
  if (token) h.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'omit'
  });

  const text = await res.text();
  let data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const err = new Error((data && (data.message || data.title)) || res.statusText);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

/* ========= Утилиты DOM ========= */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const visible = el => !!(el && el.offsetParent !== null);

/* ========= Авторизация: получить текущего пользователя ========= */
async function getCurrentUser() {
  const token = TokenStore.get();
  if (!token) return null;
  try {
    const u = await apiFetch('/api/Account/me');
    const roles = (u?.roles || u?.role || []).map?.(r => String(r).toLowerCase()) || [];
    return { ...u, roles };
  } catch (e) {
    if (e.status === 401) TokenStore.clear();
    return null;
  }
}

/* ========= Guard (ограничения для гостя) ========= */
function setupGuards(isGuest) {
  $$('.guard-required').forEach(link => {
    link.classList.toggle('is-disabled', isGuest);
    if (isGuest) {
      link.addEventListener('click', onGuardClick);
      link.dataset.href = link.getAttribute('href');
      link.setAttribute('href', '#');
      link.setAttribute('aria-disabled', 'true');
    } else {
      link.removeEventListener('click', onGuardClick);
      if (link.dataset.href) link.setAttribute('href', link.dataset.href);
      link.removeAttribute('aria-disabled');
    }
  });
}
function onGuardClick(e) {
  e.preventDefault();
  const host = e.currentTarget;
  const tip = document.createElement('span');
  tip.className = 'guard-tip';
  tip.textContent = 'Доступно після входу';
  host.style.position = 'relative';
  host.appendChild(tip);
  setTimeout(() => tip.remove(), 1500);
  const next = encodeURIComponent('./index.html');
  setTimeout(() => location.href = `./auth.html?next=${next}`, 500);
}

/* ========= Профільне меню ========= */
function initProfileMenu() {
  const btn = $('#profileBtn');
  const menu = $('#profileMenu');
  if (!btn || !menu) return;

  function open() {
    menu.hidden = false;
    btn.setAttribute('aria-expanded','true');
    const first = menu.querySelector('a,button');
    first && first.focus();
    document.addEventListener('pointerdown', onOutside, { capture:true });
    document.addEventListener('keydown', onKey);
  }
  function close() {
    menu.hidden = true;
    btn.setAttribute('aria-expanded','false');
    document.removeEventListener('pointerdown', onOutside, { capture:true });
    document.removeEventListener('keydown', onKey);
  }
  function toggle() { menu.hidden ? open() : close(); }
  function onOutside(e) {
    if (!menu.contains(e.target) && !btn.contains(e.target)) close();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  btn.addEventListener('click', toggle);
  $('#logoutBtn')?.addEventListener('click', () => {
    TokenStore.clear();
    location.reload();
  });
}

/* ========= Бургер / off-canvas ========= */
function initBurger() {
  const body = document.body;
  const burger = $('.burger');
  const panel  = $('#mobileMenu');
  const backdrop = $('.mobileMenu__backdrop');
  if (!burger || !panel || !backdrop) return;

  function open() {
    burger.classList.add('is-active');
    panel.classList.add('is-open');
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
    body.classList.add('menu-open');
    burger.setAttribute('aria-expanded','true');
    panel.setAttribute('aria-hidden','false');
    (panel.querySelector('a,button')||panel).focus();
  }
  function close() {
    burger.classList.remove('is-active');
    panel.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded','false');
    panel.setAttribute('aria-hidden','true');
    setTimeout(() => backdrop.hidden = true, 280);
  }

  burger.addEventListener('click', () =>
    panel.classList.contains('is-open') ? close() : open()
  );
  backdrop.addEventListener('click', close);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

/* ========= Фон: длина штриха ========= */
(function() {
  const el = $('.bg-script__text');
  if (!el || !el.getComputedTextLength) return;
  const apply = () => {
    try {
      const len = Math.ceil(el.getComputedTextLength()) + 60;
      el.style.setProperty('--dash', String(len));
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
    } catch (_) {}
  };
  apply();
  window.addEventListener('resize', () => requestAnimationFrame(apply));
})();

/* ========= Демо-карточки ========= */
function card({ title='', wide=false }={}) {
  const a = document.createElement('a');
  a.href = './title.html';
  a.className = 'card' + (wide ? ' card--latest' : '');
  const stub = document.createElement('div');
  stub.className='card__stub';
  stub.textContent='…';
  const t = document.createElement('div');
  t.className='card__title';
  t.textContent = title;
  a.append(stub,t);
  return a;
}
function fillGrid(el) {
  if (!el) return;
  const n = Number(el.dataset.fill || 6);
  const wide = String(el.dataset.wide||'false') === 'true';
  const list = [];
  for (let i=0;i<n;i++) list.push(card({ title:`Тайтл ${i+1}`, wide }));
  el.append(...list);
}

/* ========= UI bootstrap ========= */
(async function bootstrap() {
  ['#genresGrid','#newGrid','#popularGrid','#latestGrid']
    .forEach(sel => fillGrid($(sel)));

  initBurger();
  initProfileMenu();

  const user = await getCurrentUser();
  const isGuest = !user;

  const loginLink         = $('#loginLink');
  const profileBlock      = $('#profileBlock');
  const mobileLoginLink   = $('#mobileLoginLink');
  const mobileLogoutBtn   = $('#mobileLogoutBtn');
  const mobileProfileLink = $('#mobileProfileLink');

  if (isGuest) {
    if (loginLink)        { loginLink.hidden = false;  loginLink.style.display = ''; }
    if (mobileLoginLink)  { mobileLoginLink.hidden = false;  mobileLoginLink.style.display = ''; }
    if (profileBlock)     { profileBlock.hidden = true; }
    if (mobileProfileLink){ mobileProfileLink.hidden = true; }
    if (mobileLogoutBtn)  { mobileLogoutBtn.hidden = true; }
  } else {
    if (loginLink?.parentNode)              loginLink.parentNode.removeChild(loginLink);
    if (mobileLoginLink?.parentNode)        mobileLoginLink.parentNode.removeChild(mobileLoginLink);
    if (profileBlock)      profileBlock.hidden = false;
    if (mobileProfileLink) mobileProfileLink.hidden = false;
    if (mobileLogoutBtn)   mobileLogoutBtn.hidden = false;

    $('#profileName').textContent =
      user.nickname || user.userName || user.email || 'Кабінет';

    const admin = (user.roles || []).some(r =>
      ['admin','owner'].includes(String(r).toLowerCase())
    );

    const rb = $('#roleBadge');
    if (rb) {
      rb.hidden = !admin;
      if (admin) rb.textContent = 'ADMIN';
    }

    $$('.profile__item--admin, .mobileMenu__link--admin')
      .forEach(a => a.hidden = !admin);

    mobileLogoutBtn?.addEventListener('click', () => { TokenStore.clear(); location.reload(); });
    $('#logoutBtn')?.addEventListener('click', () => { TokenStore.clear(); location.reload(); });
  }

  setupGuards(isGuest);
})();
