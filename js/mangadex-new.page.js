// js/mangadex-new.page.js

import './api.client.js';
import MangadexService from './mangadex.service.js';

const grid = document.getElementById('grid');
const status = document.getElementById('status');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const pageDisplay = document.getElementById('pageDisplay');
const limitInput = document.getElementById('limitInput');

let currentPage = 1;
let currentLimit = parseInt(limitInput.value, 10) || 24;
let totalPages = 1;

function firstLang(obj) {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  const keys = Object.keys(obj);
  for (const k of ['en','en-us','en-gb']) if (obj[k]) return obj[k];
  return obj[keys[0]];
}

function truncate(s, n=260) { 
  if (!s) return ''; 
  return s.length>n ? s.slice(0,n).trim() + '...' : s; 
}

async function renderList(items) {
  grid.innerHTML = '';
  const coverPromises = [];

  for (const item of items) {
    const id = item.id;
    const a = item.attributes || {};
    const title = firstLang(a.title) || '(No title)';
    const alt = (a.altTitles && a.altTitles.length) ? firstLang(a.altTitles[0]) : '';
    const desc = firstLang(a.description) || '';
    const tags = (a.tags||[]).map(t => (t?.attributes?.name && firstLang(t.attributes.name)) || '').filter(Boolean);

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

    // Fetch cover
    const rel = (item.relationships || []).find(r => r.type === 'cover_art');
    if (rel && rel.id) {
      const p = MangadexService.callProxy(`/cover/${rel.id}`)
        .then(res => {
          const data = res?.data || res;
          const fileName = data?.attributes?.fileName;
          if (fileName) {
            const real = `https://uploads.mangadex.org/covers/${id}/${fileName}`;
            const apiBase = import.meta.env.VITE_API_BASE || '';
            img.src = `${apiBase}/api/MangaDexProxy/image?url=${encodeURIComponent(real)}`;
          }
        }).catch(()=>{});
      coverPromises.push(p);
    }
  }

  await Promise.allSettled(coverPromises);

  // После рендера карточек → триммим теги
  trimTags();
}

function escapeHtml(s){ 
  return String(s||'').replace(/[&<>"']/g, c=>({ 
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;' 
  })[c]); 
}

async function load(page = 1) {
  try {
    currentLimit = parseInt(limitInput.value, 10) || 24;
    status.textContent = 'Завантаження списку...';
    const res = await MangadexService.getNewReleases(page, currentLimit);
    const items = res?.data || [];
    const total = res?.total || items.length || 0;
    totalPages = Math.max(1, Math.ceil(total / currentLimit));
    currentPage = page;

    pageDisplay.textContent = String(currentPage);
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    status.textContent = items.length ? `Показані ${items.length} із ${total}` : 'Нет результатов';

    await renderList(items);
  } catch (err) {
    status.textContent = 'Помилка: ' + (err.message || err);
    grid.innerHTML = '<pre>'+escapeHtml(String(err))+'</pre>';
  }
}

prevBtn.addEventListener('click', () => { 
  if (currentPage>1) load(currentPage-1); 
});
nextBtn.addEventListener('click', () => { 
  if (currentPage<totalPages) load(currentPage+1); 
});
limitInput.addEventListener('change', () => { load(1); });

/* ==========================================================
  Функция для обрезки тегов и добавления "+N more"
  ========================================================== */
function trimTags() {
  document.querySelectorAll('.tags').forEach(tagBlock => {
    const tags = Array.from(tagBlock.querySelectorAll('.tag'));
    const SHOW = 4; // сколько тегов показываем

    if (tags.length <= SHOW) return;

    const hidden = tags.slice(SHOW);
    hidden.forEach(el => el.style.display = "none");

    const count = hidden.length;

    const more = document.createElement("div");
    more.className = "tag-more";
    more.textContent = `+${count}`;

    tagBlock.appendChild(more);
  });
}

// initial load
load(1);
