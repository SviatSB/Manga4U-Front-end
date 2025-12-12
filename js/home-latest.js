import './api.client.js';
import MangadexService from './mangadex.service.js';

// ---------- helpers ----------
function firstLang(obj) {
  if (!obj) return null;
  if (typeof obj === "string") return obj;
  const keys = Object.keys(obj);
  for (const k of ["en", "en-us", "en-gb"]) if (obj[k]) return obj[k];
  return obj[keys[0]];
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

// ---------- render small cards for home page ----------
async function renderSmallList(items, grid) {
  grid.innerHTML = "";

  for (const item of items) {
    const id = item.id;
    const attr = item.attributes || {};

    const title = firstLang(attr.title) || "Без назви";

    // card wrapper
    const card = document.createElement("a");
    card.href = `/manga.html?id=${encodeURIComponent(id)}`;
    card.className = "card";

    // cover stub
    const cover = document.createElement("div");
    cover.className = "card__stub";   // no more dots

    // title
    const t = document.createElement("div");
    t.className = "card__title";
    t.textContent = title;

    card.append(cover, t);
    grid.append(card);

    // fetch cover
    const rel = (item.relationships || []).find(r => r.type === "cover_art");
    if (rel?.id) {
      MangadexService.callProxy(`/cover/${rel.id}`)
        .then(r => {
          const cov = r?.data || r;
          const file = cov?.attributes?.fileName;
          if (file) {
const real = `https://uploads.mangadex.org/covers/${id}/${file}`;
const apiBase = import.meta.env.VITE_API_BASE || '';
cover.style.backgroundImage =
  `url("${apiBase}/api/MangaDexProxy/image?url=${encodeURIComponent(real)}")`;
          }
        })
        .catch(() => {});
    }
  }
}

// ---------- main loader ----------
async function loadHomeSections() {
  const newGrid = document.getElementById("newGrid");
  const popularGrid = document.getElementById("popularGrid");

  if (!newGrid || !popularGrid) return;

  try {
    // новинки
    const newRes = await MangadexService.getNewReleases(1, 4);
    await renderSmallList(newRes.data || [], newGrid);

    // популярные
    const popRes = await MangadexService.getPopular(1, 4);
    await renderSmallList(popRes.data || [], popularGrid);

  } catch (err) {
    console.error("Home load error:", err);
  }
}

loadHomeSections();
