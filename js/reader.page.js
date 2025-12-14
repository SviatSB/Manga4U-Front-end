import MangadexService from "./mangadex.service.js";

/* =========================================================
   Query helper
   ========================================================= */
function qs(name) {
  const m = location.search.match(new RegExp("[?&]" + name + "=([^&]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}

const chapterId = qs("chapterId");
const status = document.getElementById("status");
const content = document.getElementById("content");
const useSaver = document.getElementById("useSaver");
const reloadBtn = document.getElementById("reload");
const openBase = document.getElementById("openBase");

const openMangaPage = document.getElementById("openMangaPage");
let mangaIdGlobal = null;

const API_BASE = import.meta.env.VITE_API_BASE || "";

/* =========================================================
   ✅ Локальный TokenStore + apiFetch (чтобы не зависеть от main.js)
   ========================================================= */
const TokenStore = {
  key: "m4u_token",
  skey: "m4u_token_session",

  get() {
    return (
      localStorage.getItem(this.key) ||
      sessionStorage.getItem(this.skey) ||
      null
    );
  },

  clear() {
    localStorage.removeItem(this.key);
    sessionStorage.removeItem(this.skey);
  },
};

async function apiFetch(path, options = {}) {
  const token = TokenStore.get();
  const headers = new Headers(options.headers || {});

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    if (res.status === 401) TokenStore.clear();
    const err = new Error(data?.message || res.statusText);
    err.status = res.status;
    throw err;
  }

  return data;
}

function bindMangaButton() {
  if (mangaIdGlobal) {
    openMangaPage.href = `/manga.html?id=${mangaIdGlobal}`;
    openMangaPage.style.display = "inline-block";
  }
}

/* =========================================================
   👍 Сохранение истории (просмотр главы) — НЕ ТРОГАЮ ЛОГИКУ
   ========================================================= */
async function saveHistory(chapter) {
  try {
    const mangaRel = chapter.relationships?.find((r) => r.type === "manga");
    if (!mangaRel) return;

    const mangaId = mangaRel.id;
    const attrs = chapter.attributes || {};

    let number = parseInt(attrs.chapter || "0");
    if (!number || number < 1) number = 1; // FIX: глава 0 → глава 1

    const title =
      attrs.title && attrs.title.trim().length > 0
        ? attrs.title
        : `Chapter ${number}`;

    const dto = {
      mangaExternalId: mangaId,
      lastChapterId: chapterId,
      language: attrs.translatedLanguage || "unknown",
      lastChapterTitle: title,
      lastChapterNumber: number, // теперь всегда >= 1
    };

    await apiFetch("/api/history", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  } catch (e) {
    console.warn("Не удалось сохранить историю:", e);
  }
}

/* =========================================================
   Загрузка и отображение страниц главы — НЕ ТРОГАЮ ЛОГИКУ
   ========================================================= */
async function loadPages() {
  if (!chapterId) {
    status.textContent = "Не передано chapterId";
    return;
  }

  status.textContent = "Завантаження розділу...";

  try {
    const chapterInfo = await MangadexService.callProxy(`/chapter/${chapterId}`);
    const chapter = chapterInfo?.data || chapterInfo;

    // после получения chapter
    const mangaRel = chapter?.relationships?.find((r) => r.type === "manga");
    mangaIdGlobal = mangaRel?.id || null;
    bindMangaButton();

    // 👇 Сохраняем историю (только авторизованным)
    if (chapter && TokenStore.get()) await saveHistory(chapter);

    const res = await MangadexService.callProxy(`/at-home/server/${chapterId}`);

    const base = res?.baseUrl;
    const chapterData = res?.chapter || {};
    const hash = chapterData.hash;
    const files =
      (useSaver.checked ? chapterData.dataSaver : chapterData.data) || [];

    if (!base || !hash || !files.length) {
      status.textContent = "Немає доступних сторінок для цього розділу";
      return;
    }

    status.textContent = `Сторінок: ${files.length}`;

    openBase.href = base;
    openBase.textContent = "Відкрити baseUrl";

    content.innerHTML = "";

    const apiBase = import.meta.env.VITE_API_BASE || "";

    for (const f of files) {
      const img = document.createElement("img");
      const imageUrl = `${base}/data/${hash}/${f}`;
      img.src = `${apiBase}/api/MangaDexProxy/image?url=${encodeURIComponent(
        imageUrl
      )}`;
      img.alt = f;
      content.appendChild(img);
    }
  } catch (err) {
    status.textContent =
      "Помилка завантаження сторінок: " + (err.message || err);
    content.innerHTML = "";
  }
}

reloadBtn.addEventListener("click", loadPages);
useSaver.addEventListener("change", loadPages);

/* =========================================================
   Helpers
   ========================================================= */
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c])
  );
}

function hasRole(user, role) {
  const want = String(role || "").toLowerCase();
  const roles =
    user?.roles || user?.Roles || user?.role || user?.Role || [];

  if (Array.isArray(roles)) {
    return roles.map((r) => String(r).toLowerCase()).includes(want);
  }
  if (typeof roles === "string") {
    return roles
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .includes(want);
  }
  return false;
}

function userStatusOf(user) {
  const banned = !!(user?.isBanned ?? user?.IsBanned ?? user?.banned ?? user?.Banned);
  const muted = !!(user?.isMuted ?? user?.IsMuted ?? user?.muted ?? user?.Muted);
  if (banned) return "banned";
  if (muted) return "muted";
  return "active";
}

function formatDate(dt) {
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

/* =========================================================
   ✅ Коментарі до глави + guard (guest/mute/ban) + delete (owner/admin)
   ========================================================= */
const CH_COMMENTS_TAKE = 50;

let _me = null;
let _canModerate = false; // owner/admin
let _writeBlockedReason = null; // 'guest' | 'muted' | 'banned' | null

function getCommentsEls() {
  return {
    textarea: document.getElementById("chapterCommentText"),
    sendBtn: document.getElementById("sendChapterCommentBtn"),
    msg: document.getElementById("chapterCommentMessage"),
    reloadBtn: document.getElementById("reloadChapterCommentsBtn"),
    list: document.getElementById("chapterCommentsList"),
  };
}

function lockChapterCommentUI(reason) {
  const { sendBtn, textarea, msg } = getCommentsEls();

  if (sendBtn) sendBtn.disabled = true;
  if (textarea) textarea.disabled = true;

  if (!msg) return;

  const next = encodeURIComponent(location.pathname + location.search);

  if (reason === "guest") {
    msg.innerHTML = `Щоб залишити коментар, потрібно увійти/зареєструватись.
      <a href="./auth.html?next=${next}">Перейти до реєстрації</a>`;
    return;
  }
  if (reason === "muted") {
    msg.textContent = "Ви в м'юті — коментування тимчасово недоступне.";
    return;
  }
  if (reason === "banned") {
    msg.textContent = "Ви забанені — коментування недоступне.";
    return;
  }
  msg.textContent = "";
}

function unlockChapterCommentUI() {
  const { sendBtn, textarea, msg } = getCommentsEls();

  if (sendBtn) sendBtn.disabled = false;
  if (textarea) textarea.disabled = false;
  if (msg) msg.textContent = "";
}

async function getCurrentUserSafe() {
  if (!TokenStore.get()) return null;
  try {
    return await apiFetch("/api/Account/me");
  } catch {
    return null;
  }
}

function renderChapterComments(items) {
  const { list } = getCommentsEls();
  if (!list) return;

  if (!items?.length) {
    list.innerHTML = `<div class="ch-comments__empty">Поки що немає коментарів.</div>`;
    return;
  }

  list.innerHTML = items
    .map((c) => {
      const id = c.id ?? c.Id;
      const text = c.text ?? c.Text ?? "";
      const nick = c.userNickname ?? c.UserNickname ?? "User";
      const createdAt = c.createdAt ?? c.CreatedAt ?? "";
      const isPinned = c.isPined ?? c.IsPined ?? c.isPinned ?? c.IsPinned ?? false;

      return `
        <div class="ch-comments__item" role="listitem">
          <div class="ch-comments__itemHead">
            <div class="ch-comments__meta">
              <div class="ch-comments__name">${escapeHtml(nick)}</div>
              <div class="ch-comments__date">${escapeHtml(formatDate(createdAt))}</div>
              ${isPinned ? `<span class="ch-comments__pin">📌 pinned</span>` : ""}
            </div>

            ${
              _canModerate
                ? `<button class="ch-comments__del" type="button" data-del="${id}">Видалити</button>`
                : ""
            }
          </div>

          <div class="ch-comments__text">${escapeHtml(text)}</div>
        </div>
      `;
    })
    .join("");
}

async function loadChapterComments() {
  const { list } = getCommentsEls();
  if (!list) return;

  list.innerHTML = `<div class="ch-comments__empty">Завантаження…</div>`;

  try {
    const data = await apiFetch(
      `/api/comment/root?chapterId=${encodeURIComponent(chapterId)}&skip=0&take=${CH_COMMENTS_TAKE}`,
      { method: "GET" }
    );

    const items = data?.items || data?.Items || data?.Items || data?.items || [];
    renderChapterComments(items);
  } catch (e) {
    console.warn("loadChapterComments failed:", e);
    list.innerHTML = `<div class="ch-comments__empty">Не вдалося завантажити.</div>`;
  }
}

async function submitChapterComment() {
  const { msg, textarea } = getCommentsEls();
  if (!textarea) return;

  const text = (textarea.value || "").trim();

  if (_writeBlockedReason) {
    lockChapterCommentUI(_writeBlockedReason);
    return;
  }

  if (!text) {
    if (msg) msg.textContent = "Напишіть текст коментаря.";
    return;
  }

  try {
    await apiFetch("/api/comment", {
      method: "POST",
      body: JSON.stringify({
        mangaChapterExternalId: chapterId,
        text,
        parentCommentId: null,
      }),
    });

    textarea.value = "";
    if (msg) msg.textContent = "Готово ✅";

    await loadChapterComments();
  } catch (e) {
    if (e?.status === 401) {
      _writeBlockedReason = "guest";
      lockChapterCommentUI("guest");
      return;
    }
    if (msg) msg.textContent = "Помилка при відправці.";
    console.warn("submitChapterComment failed:", e);
  }
}

async function deleteChapterComment(commentId) {
  if (!_canModerate) return;

  const ok = confirm("Видалити коментар?");
  if (!ok) return;

  try {
    await apiFetch(`/api/comment/${commentId}`, { method: "DELETE" });
    await loadChapterComments();
  } catch (e) {
    console.warn("deleteChapterComment failed:", e);
    alert(e?.message || "Не вдалося видалити");
  }
}

async function initChapterComments() {
  const { sendBtn, reloadBtn, list, textarea } = getCommentsEls();

  // если секции нет — ничего не ломаем
  if (!sendBtn || !reloadBtn || !list || !textarea) return;

  reloadBtn.addEventListener("click", loadChapterComments);
  sendBtn.addEventListener("click", submitChapterComment);

  // delete (делегирование)
  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    const id = btn.getAttribute("data-del");
    if (id) deleteChapterComment(id);
  });

  _me = await getCurrentUserSafe();
  _canModerate = !!_me && (hasRole(_me, "admin") || hasRole(_me, "owner"));

  if (!_me) {
    _writeBlockedReason = "guest";
    lockChapterCommentUI("guest");
  } else {
    const st = userStatusOf(_me);
    if (st === "banned") {
      _writeBlockedReason = "banned";
      lockChapterCommentUI("banned");
    } else if (st === "muted") {
      _writeBlockedReason = "muted";
      lockChapterCommentUI("muted");
    } else {
      _writeBlockedReason = null;
      unlockChapterCommentUI();
    }
  }

  await loadChapterComments();
}

/* =========================================================
   Start
   ========================================================= */
loadPages();
initChapterComments();
