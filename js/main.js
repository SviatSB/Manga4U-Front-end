/* ========= Config ========= */
const API_BASE = import.meta.env.VITE_API_BASE;
if (!API_BASE) {
  throw new Error('VITE_API_BASE is not set. Define it in .env before building.');
}

/* ========= Token store ========= */
const TokenStore = {
  key: 'm4u_token',
  skey: 'm4u_token_session',

  get() {
    return (
      localStorage.getItem(this.key) ||
      sessionStorage.getItem(this.skey) ||
      null
    );
  },

  set(token, remember) {
    if (remember) {
      localStorage.setItem(this.key, token);
    } else {
      sessionStorage.setItem(this.skey, token);
    }
  },

  clear() {
    localStorage.removeItem(this.key);
    sessionStorage.removeItem(this.skey);
  },
};

/* ========= apiFetch ========= */
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
  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    if (response.status === 401) TokenStore.clear();
    const err = new Error(data?.message || response.statusText);
    err.status = response.status;
    throw err;
  }

  return data;
}

window.apiFetch = apiFetch;

/* ========= DOM helpers ========= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

async function loadHomeHistory() {
  const container = document.getElementById("genresGrid");
  if (!container) return; // нет блока — выходим

  try {
    const res = await apiFetch("/api/history");

    if (!Array.isArray(res) || res.length === 0) {
      container.innerHTML = `<p style="opacity:.7;">Немає історії</p>`;
      return;
    }

    // последние 8 записей
    const recent = res
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 8);

    container.innerHTML = "";

    for (const item of recent) {
      const chapterId =
        item.lastChapterId || item.LastChapterId || item.chapterId;

      const mangaName = item.mangaName || item.MangaName || "Невідома манґа";

      const chapterNumber =
        item.lastChapterNumber ?? item.LastChapterNumber ?? "?";

      const chapterTitle =
        item.lastChapterTitle || item.LastChapterTitle || "Без назви";

      const div = document.createElement("div");
      div.className = "genre-card panel__item";

      div.innerHTML = `
        <div class="history-title">${mangaName}</div>
        <div class="history-subtitle">Розділ ${chapterNumber}</div>
        <div class="history-small">${chapterTitle}</div>
      `;

      div.onclick = () => {
        location.href = `/reader.html?chapterId=${chapterId}`;
      };

      container.appendChild(div);
    }
  } catch (err) {
    console.error("Помилка завантаження історії на головній:", err);
  }
}

/* ========= Авторизация ========= */
async function getCurrentUser() {
  const token = TokenStore.get();
  if (!token) return null;

  try {
    return await apiFetch("/api/Account/me");
  } catch (err) {
    return null;
  }
}

/* ========= Guard ========= */
function setupGuards(isGuest) {
  $$('.guard-required').forEach((link) => {
    link.classList.toggle('is-disabled', isGuest);

    if (isGuest) {
      link.dataset.href = link.getAttribute('href');
      link.setAttribute('href', '#');
      link.addEventListener('click', onGuardClick);
    } else {
      if (link.dataset.href) link.setAttribute('href', link.dataset.href);
      link.removeEventListener('click', onGuardClick);
    }
  });
}

function onGuardClick(e) {
  e.preventDefault();
  const host = e.currentTarget;

  const tip = document.createElement('span');
  tip.className = 'guard-tip';
  tip.textContent = 'Доступно після входу';

  host.appendChild(tip);
  setTimeout(() => tip.remove(), 1500);

  setTimeout(() => {
    location.href = "./auth.html?next=./index.html";
  }, 500);
}

/* ========= Profile menu ========= */
function initProfileMenu() {
  const btn = $("#profileBtn");
  const menu = $("#profileMenu");
  if (!btn || !menu) return;

  function open() {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");

    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", closeOnEsc);
  }

  function close() {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");

    document.removeEventListener("pointerdown", outside);
    document.removeEventListener("keydown", closeOnEsc);
  }

  function toggle() {
    menu.hidden ? open() : close();
  }

  function outside(e) {
    if (!menu.contains(e.target) && !btn.contains(e.target)) close();
  }

  function closeOnEsc(e) {
    if (e.key === "Escape") close();
  }

  btn.addEventListener("click", toggle);

  $("#logoutBtn")?.addEventListener("click", () => {
    TokenStore.clear();
    location.reload();
  });
}

/* ========= Burger ========= */
function initBurger() {
  const body = document.body;
  const burger = $(".burger");
  const panel = $("#mobileMenu");
  const backdrop = $(".mobileMenu__backdrop");

  if (!burger || !panel || !backdrop) return;

  function open() {
    burger.classList.add("is-active");
    panel.classList.add("is-open");
    body.classList.add("menu-open");

    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add("is-open"));
  }

  function close() {
    burger.classList.remove("is-active");
    panel.classList.remove("is-open");
    body.classList.remove("menu-open");

    backdrop.classList.remove("is-open");
    setTimeout(() => (backdrop.hidden = true), 280);
  }

  burger.addEventListener("click", () => {
    panel.classList.contains("is-open") ? close() : open();
  });

  backdrop.addEventListener("click", close);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

/* ========= История ========= */
import MangadexService from "./mangadex.service.js";

async function loadHistory() {
  const grid = document.getElementById("historyGrid");
  if (!grid) return;

  try {
    const res = await apiFetch("/api/history");

    const list = Array.isArray(res.data) ? res.data : [];
    const items = list
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 4);

    if (!items.length) {
      grid.innerHTML = "<div style='padding:12px;color:#a6a3b5'>Порожньо</div>";
      return;
    }

    grid.innerHTML = "";

    for (const h of items) {
      const mangaId = h.mangaExternalId;

      const md = await MangadexService.callProxy(`/manga/${mangaId}`);
      const manga = md?.data || md;
      const a = manga?.attributes || {};

      const title =
        (a.title && (a.title.en || Object.values(a.title)[0])) ||
        "Без назви";

      const card = document.createElement("a");
      card.href = `/manga.html?id=${mangaId}`;
      card.className = "card";

      const img = document.createElement("div");
      img.className = "card__stub";

      const t = document.createElement("div");
      t.className = "card__title";
      t.textContent = title;

      card.append(img, t);
      grid.append(card);

      const cover = (manga.relationships || []).find(
        (r) => r.type === "cover_art"
      );

      if (cover?.id) {
        MangadexService.callProxy(`/cover/${cover.id}`)
          .then((r) => {
            const d = r?.data || r;
            const file = d?.attributes?.fileName;
            if (file)
              img.style.backgroundImage = `url("https://uploads.mangadex.org/covers/${mangaId}/${file}")`;
          })
          .catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Could not load history:", err);
  }
}

/* ========= Рекомендації на головній ========= */
async function loadFrontRecommendations() {
  const grid = document.getElementById("frontRecoGrid");
  if (!grid) return;

  grid.innerHTML = "";

  try {
    // 1) Жанровий вектор
    const raw = await apiFetch("/api/history/recomendation-vector?limit=20");
    const items = Array.isArray(raw) ? raw : raw?.items || [];

    if (!items.length) {
      grid.innerHTML = `<div style="padding:12px;opacity:.6">Немає рекомендацій</div>`;
      return;
    }

    // 2) Топ-2 жанри
    const topGenres = items
      .filter((g) => g.genreId)
      .sort((a, b) => b.number - a.number)
      .slice(0, 2)
      .map((g) => g.genreId);

    // 3) Запит до Mangadex
    const params = {
      "includedTags[]": topGenres,
      includedTagsMode: "OR",
      "contentRating[]": ["safe", "suggestive"],
      limit: 10,
      "order[relevance]": "desc",
    };

    const mdRes = await MangadexService.callProxy("/manga", params, {
      method: "GET",
    });
    const mdItems = mdRes?.data || [];

    if (!mdItems.length) {
      grid.innerHTML = `<div style="padding:12px;opacity:.6">Не знайдено манґ</div>`;
      return;
    }

    // 4) Рендер
    for (const item of mdItems) {
      const id = item.id;
      const a = item.attributes || {};
      const title =
        a.title?.uk ||
        a.title?.en ||
        Object.values(a.title || {})[0] ||
        "Без назви";

      let cover = "/css/placeholder.png";

      const rel = (item.relationships || []).find(
        (r) => r.type === "cover_art"
      );
      if (rel?.id) {
        try {
          const c = await MangadexService.callProxy(`/cover/${rel.id}`);
          const file = c?.data?.attributes?.fileName;
          if (file)
            cover = `https://uploads.mangadex.org/covers/${id}/${file}`;
        } catch {}
      }

      const card = document.createElement("a");
      card.href = `/manga.html?id=${id}`;
      card.className = "card";

      card.innerHTML = `
        <div class="card__stub" style="background-image:url('${cover}')"></div>
        <div class="card__title">${title}</div>
      `;

      grid.appendChild(card);
    }
  } catch (err) {
    console.error("Front recommendations error:", err);
    grid.innerHTML = `<div style="padding:12px;opacity:.6">Помилка завантаження</div>`;
  }
}

/* ========= INIT ========= */
(async function bootstrap() {
  initBurger();
  initProfileMenu();

  const user = await getCurrentUser();
  const isGuest = !user;

  const loginLink = $("#loginLink");
  const profileBlock = $("#profileBlock");
  const mobileLoginLink = $("#mobileLoginLink");
  const mobileLogoutBtn = $("#mobileLogoutBtn");
  const mobileProfileLink = $("#mobileProfileLink");

  if (isGuest) {
    loginLink && (loginLink.hidden = false);
    mobileLoginLink && (mobileLoginLink.hidden = false);

    profileBlock && (profileBlock.hidden = true);
    mobileProfileLink && (mobileProfileLink.hidden = true);
    mobileLogoutBtn && (mobileLogoutBtn.hidden = true);
  } else {
    loginLink?.remove();
    mobileLoginLink?.remove();

    profileBlock && (profileBlock.hidden = false);
    mobileProfileLink && (mobileProfileLink.hidden = false);
    mobileLogoutBtn && (mobileLogoutBtn.hidden = false);

    $("#profileName").textContent =
      user.nickname || user.userName || user.email || "Кабінет";
  }

  setupGuards(isGuest);

  if (!isGuest) {
    loadHomeHistory();
    loadFrontRecommendations();
  }
})();
