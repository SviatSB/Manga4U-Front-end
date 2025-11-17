import './api.client.js';
import MangadexService from './mangadex.service.js';

const titleEl = document.getElementById('title');
const genresEl = document.getElementById('genres');
const searchBtn = document.getElementById('searchBtn');
const grid = document.getElementById('grid');
const status = document.getElementById('status');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const pageDisplay = document.getElementById('pageDisplay');
const limitInput = document.getElementById('limitInput');

let currentPage = 1;
let currentLimit = parseInt(limitInput.value, 10) || 20;
let totalPages = 1;
let lastQuery = { title: '', genres: [] };

  function firstLang(obj) {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    const keys = Object.keys(obj);
    for (const k of ['en', 'en-us', 'en-gb']) if (obj[k]) return obj[k];
    return obj[keys[0]];
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);
  }

  function truncate(s, n = 260) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n).trim() + '...' : s;
  }

  // ============================
  //  Загрузка и отрисовка жанров
  // ============================
  async function loadGenres() {
    genresEl.innerHTML = '';
    status.textContent = 'Завантаження жанрів...';
    try {
      const cache = await MangadexService._ensureTagCache();
      const tags = cache?.tags || [];

      // group tags by attributes.group
      const groups = {};
      for (const t of tags) {
        const group = (t.attributes?.group || 'other').toString();
        groups[group] = groups[group] || [];
        groups[group].push(t);
      }

      const nice = name => {
        if (!name) return 'Інші';
        return name[0].toUpperCase() + name.slice(1);
      };

      for (const groupName of Object.keys(groups)) {
        const field = document.createElement('fieldset');
        field.className = 'genres-group';

        const legend = document.createElement('legend');
        legend.className = 'genres-group__title';
        legend.textContent = nice(groupName);
        field.appendChild(legend);

        const list = document.createElement('div');
        list.className = 'genres-group__list';

        for (const tagObj of groups[groupName]) {
          const tagName =
            tagObj.attributes?.name?.en ||
            Object.values(tagObj.attributes?.name || {})[0] ||
            tagObj.id;
          const id = tagObj.id;

          const lbl = document.createElement('label');
          lbl.className = 'genres-chip';

          const inp = document.createElement('input');
          inp.type = 'checkbox';
          inp.value = id; // use UUID as value
          inp.id = `tag-${id}`;
          inp.dataset.group = groupName;

          const span = document.createElement('span');
          span.className = 'genres-chip__label';
          span.textContent = tagName;

          lbl.appendChild(inp);
          lbl.appendChild(span);
          list.appendChild(lbl);
        }

        field.appendChild(list);
        genresEl.appendChild(field);
      }

      status.textContent = `Жанрів завантажено: ${tags.length}`;

      // hook up filter
      const filter = document.getElementById('genreFilter');
      filter.addEventListener('input', () => {
        const q = filter.value.trim().toLowerCase();
        const labels = genresEl.querySelectorAll('label.genres-chip');
        labels.forEach(lbl => {
          const txt = lbl.textContent.trim().toLowerCase();
          lbl.style.display = txt.includes(q) ? '' : 'none';
        });
      });
    } catch (err) {
      status.textContent = 'Не вдалося завантажити жанри';
      console.warn('Failed to load genres via proxy:', err);
    }
  }

  // ============================
  //  Рендер списка манги
  // ============================
  async function renderList(items) {
    grid.innerHTML = '';
    const coverPromises = [];

    for (const item of items) {
      const id = item.id;
      const a = item.attributes || {};
      const title = firstLang(a.title) || '(Без назви)';
      const alt = (a.altTitles && a.altTitles.length)
        ? firstLang(a.altTitles[0])
        : '';
      const desc = firstLang(a.description) || '';
      const tags = (a.tags || [])
        .map(t => (t?.attributes?.name && firstLang(t.attributes.name)) || '')
        .filter(Boolean);

      const card = document.createElement('article');
      card.className = 'card';

      const img = document.createElement('img');
      img.className = 'thumb';
      img.alt = title;
      img.src = '/css/placeholder.png';

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `
        <div class="title">${escapeHtml(title)}</div>
        <div class="subtitle">${escapeHtml(alt)}</div>
        <div class="desc">${escapeHtml(truncate(desc, 300))}</div>
      `;

      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'tags';
      for (const t of tags) {
        const el = document.createElement('div');
        el.className = 'tag';
        el.textContent = t;
        tagsWrap.appendChild(el);
      }
      meta.appendChild(tagsWrap);

      card.appendChild(img);
      card.appendChild(meta);

      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        window.location.href = `/manga.html?id=${encodeURIComponent(id)}`;
      });
      grid.appendChild(card);

      const rel = (item.relationships || []).find(r => r.type === 'cover_art');
      if (rel && rel.id) {
        const p = MangadexService.callProxy(`/cover/${rel.id}`)
          .then(res => {
            const data = res?.data || res;
            const fileName = data?.attributes?.fileName;
            if (fileName) {
              img.src = `https://uploads.mangadex.org/covers/${id}/${fileName}`;
            }
          })
          .catch(() => {});
        coverPromises.push(p);
      }
    }

    await Promise.allSettled(coverPromises);

    // подрезаем теги как в New (первые 4 + "+N")
    trimTags();
  }

  function getSelectedGenres() {
    const vals = Array
      .from(genresEl.querySelectorAll('input[type=checkbox]:checked'))
      .map(i => i.value)
      .filter(Boolean);
    return vals;
  }

  // ============================
  //  Отображение маппинга тегов
  // ============================
  async function showTagMapping(selectedIds) {
    const out = document.getElementById('tagMap');
    out.innerHTML = 'Обробка жанрів...';
    try {
      const cache = await MangadexService._ensureTagCache();
      const tags = cache?.tags || [];
      const byId = new Map(tags.map(t => [t.id, t]));
      const rows = [];

      for (let i = 0; i < selectedIds.length; i++) {
        const id = selectedIds[i];
        const tag = byId.get(id);
        const name = tag
          ? (tag.attributes?.name?.en || Object.values(tag.attributes?.name || {})[0])
          : '(невідомо)';

        rows.push(
          `<div class="tagMap__row">${escapeHtml(name)} → ${
            id
              ? `<code class="tagMap__code">${id}</code>`
              : '<span class="tagMap__error">(not found)</span>'
          }</div>`
        );
      }
      out.innerHTML = rows.join('');
    } catch (err) {
      out.innerHTML = 'Помилка обробки жанрів: ' + escapeHtml(String(err));
    }
  }

  // ============================
  //  Поиск
  // ============================
  async function doSearch(page = 1) {
    try {
      currentLimit = parseInt(limitInput.value, 10) || 20;
      const title = titleEl.value.trim();
      const genres = getSelectedGenres();

      showTagMapping(genres);
      lastQuery = { title, genres };

      status.textContent = 'Пошук...';

      const res = await MangadexService.search({
        title,
        genres,
        page,
        limit: currentLimit
      });

      const items = res?.data || [];
      const total = res?.total || items.length || 0;
      totalPages = Math.max(1, Math.ceil(total / currentLimit));
      currentPage = page;
      pageDisplay.textContent = String(currentPage);
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= totalPages;

      if (!items.length) {
        status.textContent = 'Немає результатів';
      } else {
        status.textContent = `Показано ${items.length} із ${total}`;
      }

      await renderList(items);
    } catch (err) {
      status.textContent = 'Помилка пошуку: ' + (err.message || err);
      grid.innerHTML = '<pre>' + escapeHtml(String(err)) + '</pre>';
    }
  }

  // ============================
  //  Тримминг тегов (как в New)
  // ============================
  function trimTags() {
    document.querySelectorAll('.tags').forEach(tagBlock => {
      const tags = Array.from(tagBlock.querySelectorAll('.tag'));
      const SHOW = 4;

      if (tags.length <= SHOW) return;

      const hidden = tags.slice(SHOW);
      hidden.forEach(el => {
        el.style.display = 'none';
      });

      const count = hidden.length;
      const more = document.createElement('div');
      more.className = 'tag-more';
      more.textContent = `+${count}`;

      tagBlock.appendChild(more);
    });
  }

  // ============================
  //  Хендлеры
  // ============================
  searchBtn.addEventListener('click', () => doSearch(1));
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) doSearch(currentPage - 1);
  });
  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) doSearch(currentPage + 1);
  });
  limitInput.addEventListener('change', () => doSearch(1));

  document
    .getElementById('refreshTagsBtn')
    .addEventListener('click', async () => {
      status.textContent = 'Оновлення кешу жанрів...';
      try {
        await MangadexService.refreshTagCache();
        status.textContent = 'Кеш жанрів оновлено';
        await loadGenres();
      } catch (err) {
        status.textContent =
          'Помилка оновлення кешу:: ' + (err.message || err);
      }
    });

// initial render of tag groups
await loadGenres();
