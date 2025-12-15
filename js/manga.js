import './api.client.js';
import MangadexService from './mangadex.service.js';

function qs(name) {
  const m = location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

const id = qs('id');
const content = document.getElementById('content');
const API_BASE = import.meta.env.VITE_API_BASE || '';

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



/* =========================================================
   👍 Сохранение перед переходом к чтению главы
   ========================================================= */
async function saveHistory(chapter, lang) {
  try {
    await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mangaExternalId: id,
        lastChapterId: chapter.id,
        lastChapterTitle: chapter.attributes?.title || "",
        lastChapterNumber: Number(chapter.attributes?.chapter || 0),
        language: lang
      })
    });
  } catch (e) {
    console.warn("History save failed:", e);
  }
}

async function load() {
  if (!id) {
    content.innerHTML = '<div class="manga-error">Не передано manga id у запиті</div>';
    return;
  }

  content.innerHTML = '<div id="status" class="manga-status">Завантаження манґи...</div>';

  try {
    const res = await MangadexService.callProxy(`/manga/${id}`);
    const data = res?.data || res;

    /* 👇 Сохраняем просмотр манги */
    // await saveMangaOpen(data);

    const attr = data?.attributes || {};
    const title =
      (attr?.title && (attr.title.en || Object.values(attr.title || {})[0])) ||
      '(Немає назви)';

    const alt =
      (attr?.altTitles && attr.altTitles.length)
        ? (attr.altTitles[0] &&
           (attr.altTitles[0].en || Object.values(attr.altTitles[0] || {})[0]))
        : '';

    const desc =
      (attr?.description &&
        (attr.description.en ||
         Object.values(attr.description || {})[0])) ||
      '';

    const statusText = attr?.status || '';
    const year = attr?.year || '';

    const relCover = (data.relationships || []).find(
      r => r.type === 'cover_art'
    );

    let coverUrl = '/css/placeholder.png';

    if (relCover && relCover.id) {
      try {
        const coverInfo = await MangadexService.callProxy(`/cover/${relCover.id}`);
        const cdata = coverInfo?.data || coverInfo;
        const file = cdata?.attributes?.fileName;
        if (file) {
          const real = `https://uploads.mangadex.org/covers/${id}/${file}`;
          coverUrl = `${API_BASE}/api/MangaDexProxy/image?url=${encodeURIComponent(real)}`;
        }
      } catch {}
    }

    const tags = (data?.attributes?.tags || [])
      .map(
        t =>
          (t?.attributes?.name &&
            (t.attributes.name.en ||
             Object.values(t.attributes.name || {})[0])) || ''
      )
      .filter(Boolean);

    /* далее твой оригинальный код — не менялся */

    const chapterCache = {};
    async function fetchChaptersForLang(code) {
      if (!code) return [];
      if (chapterCache[code]) return chapterCache[code];

      const summary = await MangadexService.callProxy(
        `/chapter?manga=${id}&translatedLanguage[]=${encodeURIComponent(code)}&limit=1`
      );
      const total = summary?.total || 0;

      if (!total) {
        chapterCache[code] = [];
        return [];
      }

      const MAX_CAP = 2000;
      const batch = 100;
      const toFetch = Math.min(total, MAX_CAP);
      const pages = Math.ceil(toFetch / batch);

      const all = [];
      for (let i = 0; i < pages; i++) {
        const offset = i * batch;
        const res = await MangadexService.callProxy(
          `/chapter?manga=${id}&translatedLanguage[]=${encodeURIComponent(code)}&limit=${batch}&offset=${offset}`
        );
        const data = res?.data || [];
        if (!data.length) break;
        all.push(...data);
        if (data.length < batch) break;
      }

      chapterCache[code] = all;
      return all;
    }

    const LANG_NAMES = {
      en: 'English',
      ru: 'Русский',
      tr: 'Türkçe',
      ja: '日本語',
      es: 'Español',
      fr: 'Français',
      pt: 'Português',
      'pt-br': 'Português (BR)',
      uk: 'Українська'
    };

    async function buildLanguageOptions() {
      const area = document.getElementById('langArea');
      area.innerHTML = 'Завантаження доступних перекладів...';

      try {
        const avail = attr?.availableTranslatedLanguages || [];
        let langs = [];

        if (avail?.length) {
          langs = avail.slice();
        } else {
          const summary = await MangadexService.callProxy(`/chapter?manga=${id}&limit=1`);
          const total = summary?.total || 0;

          if (!total) {
            area.innerHTML = '<div class="lang-message lang-message--empty">Переклади відсутні</div>';
            return { langs: [] };
          }

          const cap = Math.min(total, 1000);
          const all = await MangadexService.callProxy(`/chapter?manga=${id}&limit=${cap}`);
          const chapters = all?.data || [];
          langs = Array.from(
            new Set(
              chapters
                .map(c => c.attributes?.translatedLanguage)
                .filter(Boolean)
            )
          );
        }

        if (!langs.length) {
          area.innerHTML = '<div class="lang-message lang-message--empty">Переклади відсутні</div>';
          return { langs: [] };
        }

        const html = langs
          .map((code, i) => {
            const name = LANG_NAMES[code] || code;
            return `
              <label class="lang-option">
                <input type="radio" name="lang" value="${code}" ${i === 0 ? 'checked' : ''} />
                <span>${name}</span>
              </label>
            `;
          })
          .join('');

        area.innerHTML = `
          <div class="lang-options">${html}</div>
          <div class="lang-start-wrap">
            <button id="startRead" class="btn btn-accent">Почати читати (з першої)</button>
          </div>
        `;

        return { langs };
      } catch {
        area.innerHTML =
          '<div class="lang-message lang-message--error">Помилка завантаження перекладів</div>';
        return { langs: [] };
      }
    }

    async function renderChaptersForLang(list, lang) {
      const area = document.getElementById('chaptersArea');
      const l = list.slice();

      if (!l.length) {
        area.innerHTML = '<div class="chapters__empty">Немає глав</div>';
        return;
      }

      l.sort((a, b) => new Date(a.attributes.readableAt) - new Date(b.attributes.readableAt));

      const rows = l
        .map(c => {
          const ch = c.attributes?.chapter || '';
          const title = c.attributes?.title || '';
          const pages = c.attributes?.pages || 0;

          return `
            <div class="chapters__row">
              <div class="chapters__title">${ch} ${title}</div>
              <div class="chapters__right">
                <div class="chapters__meta">${pages} стр.</div>
                <button class="btn btn-small readBtn"
                        data-id="${c.id}"
                        data-lang="${lang}">
                  Читати
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      area.innerHTML = `
        <h3>Глави (${l.length})</h3>
        <div class="chapters">${rows}</div>
      `;

      area.querySelectorAll('.readBtn').forEach(b => {
        b.addEventListener('click', async () => {
          const cid = b.dataset.id;
          const lang = b.dataset.lang;
          const chapter = list.find(x => x.id === cid);

          if (chapter) await saveHistory(chapter, lang);

          window.location.href = `/reader.html?chapterId=${cid}`;
        });
      });
    }
 
    window.__mangaData = {
      externalId: id,
      title,
      description: desc,
      coverUrl,
      status: statusText,
      year
    };


    content.innerHTML = `
      <div class="layout">
        <div class="layout__cover">
          <img class="thumb" src="${coverUrl}" alt="${title}" />
        </div>
        <div class="layout__main">
          <h1>${title}</h1>
          <button id="addToCollectionBtn" class="btn btn-accent" style="margin-bottom: 10px;">
            + Додати в колекцію
          </button>
          <div class="meta">
            ${alt}
            ${year ? ' · ' + year : ''}
            ${statusText ? ' · ' + statusText : ''}
          </div>

          <div class="tags">
            ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
          </div>

          <h3>Опис</h3>
          <pre class="desc">${desc}</pre>

          <h3>Доступні переклади</h3>
          <div id="langArea" class="lang-area">Завантаження...</div>
          <div id="chaptersArea" class="chapters-area"></div>

          <!-- ====== ВІДГУКИ ====== -->
          <h3 id="reviews">Відгуки</h3>

          <section class="feedback" aria-label="Відгуки">

            <!-- Верхня секція: залишити -->
            <div class="feedback__card">
              <div class="feedback__head">
                <h4 class="feedback__title">Залишити відгук</h4>
                <div class="feedback__sub">Поділись думкою та оціни манґу.</div>
              </div>

              <div class="feedback__form">
                <div class="feedback__row">
                  <span class="feedback__label">Оцінка:</span>

                  <div class="rating" role="radiogroup" aria-label="Оцінка від 1 до 5">
                    <input class="rating__inp" type="radio" name="stars" id="star5" value="5" />
                    <label class="rating__lbl" for="star5" title="5">★</label>

                    <input class="rating__inp" type="radio" name="stars" id="star4" value="4" />
                    <label class="rating__lbl" for="star4" title="4">★</label>

                    <input class="rating__inp" type="radio" name="stars" id="star3" value="3" />
                    <label class="rating__lbl" for="star3" title="3">★</label>

                    <input class="rating__inp" type="radio" name="stars" id="star2" value="2" />
                    <label class="rating__lbl" for="star2" title="2">★</label>

                    <input class="rating__inp" type="radio" name="stars" id="star1" value="1" />
                    <label class="rating__lbl" for="star1" title="1">★</label>
                  </div>
                </div>

                <textarea
                  id="commentText"
                  class="feedback__textarea"
                  rows="4"
                  maxlength="1000"
                  placeholder="Напиши свій відгук…"
                ></textarea>

                <div class="feedback__actions">
                  <button id="sendCommentBtn" class="btn btn-accent" type="button">
                    Опублікувати
                  </button>
                  <div id="commentMessage" class="feedback__message" aria-live="polite"></div>
                </div>
              </div>
            </div>

            <!-- Нижня секція: список зі скролом -->
            <div class="feedback__card">
              <div class="feedback__listHead">
                <h4 class="feedback__title">Всі відгуки</h4>
                <button id="reloadCommentsBtn" class="btn btn-small" type="button">Оновити</button>
              </div>

              <div id="commentsList" class="feedback__list" role="list">
                <div class="feedback__empty">Поки що немає відгуків.</div>
              </div>
            </div>

          </section>
        </div>
      </div>
    `;

    initFeedback();

    (async () => {
      const { langs } = await buildLanguageOptions();
      if (!langs.length) return;

      const radios = document.getElementsByName('lang');

      radios.forEach(r =>
        r.addEventListener('change', async () => {
          const code = document.querySelector('input[name=lang]:checked').value;

          const list = await fetchChaptersForLang(code);
          await renderChaptersForLang(list, code);
        })
      );

      const cur = document.querySelector('input[name=lang]:checked').value;

      const initial = await fetchChaptersForLang(cur);
      await renderChaptersForLang(initial, cur);

      document.getElementById('startRead').addEventListener('click', async () => {
        const code = document.querySelector('input[name=lang]:checked').value;

        const lst = await fetchChaptersForLang(code);

        const sorted = lst
          .slice()
          .sort(
            (a, b) =>
              new Date(a.attributes.readableAt) -
              new Date(b.attributes.readableAt)
          );

        if (!sorted.length) {
          alert('Немає глав для цієї мови');
          return;
        }

        const first = sorted[0];

        await saveHistory(first, code);

        window.location.href = `/reader.html?chapterId=${first.id}`;
      });
    })();
  } catch (err) {
    content.innerHTML =
      '<div class="manga-error">Помилка завантаження манґи: ' +
      escapeHtml(String(err)) +
      '</div>';
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]
  );
}

let __feedbackUser = null;
let __feedbackIsAdmin = false;

function hasRole(user, role) {
  const want = String(role || "").toLowerCase();
  const roles = user?.roles || user?.Roles || user?.role || user?.Role || [];
  if (Array.isArray(roles)) return roles.map(r => String(r).toLowerCase()).includes(want);
  if (typeof roles === "string") return roles.split(",").map(s => s.trim().toLowerCase()).includes(want);
  return false;
}

function getUserModerationState(user) {
  const isMuted = !!(user?.isMuted ?? user?.IsMuted);
  const isBanned = !!(user?.isBanned ?? user?.IsBanned);
  return { isMuted, isBanned };
}

function lockFeedbackForRestricted(kind) {
  const btn = document.getElementById("sendCommentBtn");
  const ta = document.getElementById("commentText");
  const msg = document.getElementById("commentMessage");
  const radios = document.querySelectorAll('input[name="stars"]');

  if (btn) btn.disabled = true;
  if (ta) ta.disabled = true;
  radios.forEach(r => (r.disabled = true));

  if (!msg) return;
  msg.textContent =
    kind === "banned"
      ? "Ви забанені. Додавати відгуки заборонено."
      : "Ви в м'юті. Поки м'ют активний — ви не можете писати відгуки.";
}


/* =========================================================
   ✅ ВІДГУКИ + ЗАХИСТ ГОСТЯ + ВИДАЛЕННЯ (Admin)
   ========================================================= */

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isAdminFromAny(user) {
  const roles =
    user?.roles ||
    user?.Roles ||
    user?.role ||
    user?.Role ||
    user?.userRoles ||
    user?.UserRoles;

  if (Array.isArray(roles) && roles.includes("Admin")) return true;
  if (typeof roles === "string" && roles.split(",").map(s => s.trim()).includes("Admin")) return true;

  const token = TokenStore.get();
  if (!token) return false;

  const payload = parseJwt(token);
  if (!payload) return false;

  const roleClaim =
    payload.role ||
    payload.roles ||
    payload.Role ||
    payload.Roles ||
    payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
    payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role"];

  if (Array.isArray(roleClaim)) return roleClaim.includes("Admin");
  if (typeof roleClaim === "string") return roleClaim === "Admin" || roleClaim.split(",").map(s => s.trim()).includes("Admin");

  return false;
}

function lockFeedbackForGuest() {
  const btn = document.getElementById("sendCommentBtn");
  const ta = document.getElementById("commentText");
  const msg = document.getElementById("commentMessage");
  const radios = document.querySelectorAll('input[name="stars"]');

  if (btn) btn.disabled = true;
  if (ta) ta.disabled = true;
  radios.forEach(r => (r.disabled = true));

  const next = encodeURIComponent(location.pathname + location.search);
  if (msg) {
    msg.innerHTML = `Щоб залишити відгук, потрібно увійти/зареєструватись.
      <a href="./auth.html?next=${next}">Перейти до реєстрації</a>`;
  }
}

function unlockFeedback() {
  const btn = document.getElementById("sendCommentBtn");
  const ta = document.getElementById("commentText");
  const msg = document.getElementById("commentMessage");
  const radios = document.querySelectorAll('input[name="stars"]');

  if (btn) btn.disabled = false;
  if (ta) ta.disabled = false;
  radios.forEach(r => (r.disabled = false));
  if (msg) msg.textContent = "";
}

function renderReviews(items) {
  const list = document.getElementById("commentsList");
  if (!list) return;

  if (!items?.length) {
    list.innerHTML = `<div class="feedback__empty">Поки що немає відгуків.</div>`;
    return;
  }

  list.innerHTML = items.map(r => {
    const stars = (r.stars ?? r.Stars ?? 0);
    const rid = (r.id ?? r.Id ?? r.reviewId ?? r.ReviewId ?? "");
    const delBtn = (__feedbackIsAdmin && rid)
      ? `<button class="btn btn-small" type="button" data-review-delete="${rid}">Видалити</button>`
      : "";

    return `
      <div class="feedback__item">
        <div class="feedback__itemHead">
          <div class="feedback__name">${escapeHtml(r.userNickname || r.UserNickname || "User")}</div>
          <div class="feedback__stars">${"★".repeat(stars)}${"☆".repeat(5 - stars)}</div>
          ${delBtn}
        </div>
        <div class="feedback__text">${escapeHtml(r.text || r.Text || "")}</div>
      </div>
    `;
  }).join("");
}

async function loadReviews() {
  const list = document.getElementById("commentsList");
  if (list) list.innerHTML = `<div class="feedback__empty">Завантаження…</div>`;

  try {
    const data = await apiFetch(`/api/review/manga/${id}?skip=0&take=50`);
    renderReviews(data?.items || data?.Items || []);
  } catch (e) {
    console.warn("loadReviews failed:", e);
    if (list) list.innerHTML = `<div class="feedback__empty">Не вдалося завантажити.</div>`;
  }
}

async function deleteReviewAsAdmin(reviewId) {
  if (!__feedbackIsAdmin) return;

  const ok = confirm("Видалити цей відгук?");
  if (!ok) return;

  try {
    await apiFetch(`/api/review/${reviewId}`, { method: "DELETE" });
    await loadReviews();
  } catch (e) {
    console.warn("deleteReview failed:", e);
    alert("Не вдалося видалити.");
  }
}

async function submitReview() {
  const msg = document.getElementById("commentMessage");
  const textEl = document.getElementById("commentText");
  const text = (textEl?.value || "").trim();
  const stars = Number(document.querySelector('input[name="stars"]:checked')?.value || 0);

  if (!stars) {
    if (msg) msg.textContent = "Оберіть оцінку 1–5.";
    return;
  }

  // нет токена => гость
  if (!TokenStore.get()) {
    lockFeedbackForGuest();
    return;
  }

  // если пользователь в мюте/бане — не отправляем
if (__feedbackUser) {
  const { isMuted, isBanned } = getUserModerationState(__feedbackUser);
  if (isBanned) { lockFeedbackForRestricted("banned"); return; }
  if (isMuted) { lockFeedbackForRestricted("muted"); return; }
}


  try {
    // ВАЖНО: только apiFetch, чтобы отправлялся Authorization: Bearer ...
    await apiFetch("/api/review", {
      method: "POST",
      body: JSON.stringify({ mangaExternalId: id, stars, text })
    });

    if (msg) msg.textContent = "Готово ✅";
    if (textEl) textEl.value = "";
    const checked = document.querySelector('input[name="stars"]:checked');
    if (checked) checked.checked = false;

    await loadReviews();
  } catch (e) {
    if (e?.status === 401) {
      lockFeedbackForGuest();
      return;
    }
    console.warn("submitReview failed:", e);
    if (msg) msg.textContent = "Помилка при відправці.";
  }
}

async function getCurrentUserSafe() {
  if (!TokenStore.get()) return null;
  try {
    // как у тебя в main.js
    return await apiFetch("/api/Account/me");
  } catch (e) {
    return null;
  }
}

async function initFeedback() {
  const sendBtn = document.getElementById("sendCommentBtn");
  const reloadBtn = document.getElementById("reloadCommentsBtn");
  const list = document.getElementById("commentsList");

  if (reloadBtn) reloadBtn.addEventListener("click", loadReviews);

  const user = await getCurrentUserSafe();
  __feedbackUser = user;
  __feedbackIsAdmin = !!user && hasRole(user, "admin");

  if (!user) {
    lockFeedbackForGuest();
  } else {
    const { isMuted, isBanned } = getUserModerationState(user);

    if (isBanned) {
      lockFeedbackForRestricted("banned");
    } else if (isMuted) {
      lockFeedbackForRestricted("muted");
    } else {
      unlockFeedback();
      sendBtn?.addEventListener("click", submitReview);
    }
  }

  // Делегирование клика по кнопке удаления (если у тебя уже было) — оставляем как есть:
  if (list && !list.dataset.deleteBound) {
    list.dataset.deleteBound = "1";
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-review-delete]");
      if (!btn) return;
      const rid = btn.getAttribute("data-review-delete");
      if (!rid) return;
      deleteReviewAsAdmin(rid);
    });
  }

  await loadReviews();
}


load();
