import './api.client.js';
import MangadexService from './mangadex.service.js';

function qs(name) {
  const m = location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

const id = qs('id');
const content = document.getElementById('content');

/* =========================================================
   👍 Сохранение истории при заходе на страницу манги
   ========================================================= */
async function saveMangaOpen(mangaData) {
  try {
    const dto = {
      mangaExternalId: mangaData.id,
      lastChapterId: "manga",  // <<< ВАЖНО: НЕ пустая строка
      lastChapterTitle: "Перегляд манґи",
      lastChapterNumber: 0,
      language: "info"
    };

    await apiFetch("/api/history", {
      method: "POST",
      body: JSON.stringify(dto),
    });

  } catch (e) {
    console.warn("Не удалось сохранить историю о манге:", e);
  }
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
    await saveMangaOpen(data);

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
        if (file)
          coverUrl = `https://uploads.mangadex.org/covers/${id}/${file}`;
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

    content.innerHTML = `
      <div class="layout">
        <div class="layout__cover">
          <img class="thumb" src="${coverUrl}" alt="${title}" />
        </div>
        <div class="layout__main">
          <h1>${title}</h1>
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
        </div>
      </div>
    `;

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

load();
