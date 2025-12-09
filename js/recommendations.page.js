// js/recommendations.page.js

import "./api.client.js";
import MangadexService from "./mangadex.service.js";

const grid = document.getElementById("grid");
const status = document.getElementById("status");
const limitInput = document.getElementById("limitInput");
const reloadBtn = document.getElementById("reloadBtn");

let currentLimit = parseInt(limitInput.value, 10) || 12;

/* ==== УТИЛИТЫ — 1 в 1 как в mangadex-search.js ==== */

function firstLang(obj) {
  if (!obj) return null;
  if (typeof obj === "string") return obj;
  const keys = Object.keys(obj);
  for (const k of ["en", "en-us", "en-gb", "uk", "ru"]) {
    if (obj[k]) return obj[k];
  }
  return obj[keys[0]];
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function truncate(s, n = 260) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n).trim() + "..." : s;
}

/* ==== РЕНДЕР КАРТОЧЕК — 1 в 1 как в mangadex-search.js ==== */

async function renderList(items) {
  grid.innerHTML = "";
  const coverPromises = [];

  for (const item of items) {
    const id = item.id;
    const a = item.attributes || {};
    const title = firstLang(a.title) || "(Без назви)";
    const alt =
      a.altTitles && a.altTitles.length
        ? firstLang(a.altTitles[0])
        : "";
    const desc = firstLang(a.description) || "";
    const tags = (a.tags || [])
      .map(
        (t) =>
          (t?.attributes?.name && firstLang(t.attributes.name)) || ""
      )
      .filter(Boolean);

    const card = document.createElement("article");
    card.className = "card";

    const img = document.createElement("img");
    img.className = "thumb";
    img.alt = title;
    img.src = "/css/placeholder.png";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `
        <div class="title">${escapeHtml(title)}</div>
        <div class="subtitle">${escapeHtml(alt)}</div>
        <div class="desc">${escapeHtml(truncate(desc, 300))}</div>
      `;

    const tagsWrap = document.createElement("div");
    tagsWrap.className = "tags";
    for (const t of tags) {
      const el = document.createElement("div");
      el.className = "tag";
      el.textContent = t;
      tagsWrap.appendChild(el);
    }
    meta.appendChild(tagsWrap);

    card.appendChild(img);
    card.appendChild(meta);

    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      window.location.href = `/manga.html?id=${encodeURIComponent(id)}`;
    });
    grid.appendChild(card);

    const rel = (item.relationships || []).find(
      (r) => r.type === "cover_art"
    );
    if (rel && rel.id) {
      const p = MangadexService.callProxy(`/cover/${rel.id}`)
        .then((res) => {
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
  trimTags();
}

/* ==== trimTags — тоже из mangadex-search.js ==== */

function trimTags() {
  document.querySelectorAll(".tags").forEach((tagBlock) => {
    const tags = Array.from(tagBlock.querySelectorAll(".tag"));
    const SHOW = 4;

    if (tags.length <= SHOW) return;

    const hidden = tags.slice(SHOW);
    hidden.forEach((el) => {
      el.style.display = "none";
    });

    const count = hidden.length;
    const more = document.createElement("div");
    more.className = "tag-more";
    more.textContent = `+${count}`;

    tagBlock.appendChild(more);
  });
}

/* ==== ЛОГИКА РЕКОМЕНДАЦИЙ ==== */

async function loadRecommendations() {
  try {
    currentLimit = parseInt(limitInput.value, 10) || 12;

    status.textContent = "Завантаження рекомендацій...";
    grid.innerHTML = "";

    // 1) Жанровий вектор з бекенду
    const raw = await apiFetch(
      `/api/history/recomendation-vector?limit=${currentLimit}`,
      { method: "GET" }
    );

    const items = Array.isArray(raw) ? raw : raw?.items || [];

    if (!items.length) {
      status.textContent =
        "Поки немає рекомендацій. Почніть читати манґу 🙂";
      return;
    }

    // 2) Берём топ-2 жанра по числу прочитанных манг
    const topGenres = items
      .filter((g) => g.genreId)
      .sort((a, b) => b.number - a.number)
      .slice(0, 2)
      .map((g) => g.genreId);

    if (!topGenres.length) {
      status.textContent = "Не вдалося визначити жанри з історії.";
      return;
    }

    // 3) Запрос к Mangadex по этим жанрам
    const params = {
      "includedTags[]": topGenres,
      includedTagsMode: "OR",
      "contentRating[]": ["safe", "suggestive"],
      "order[relevance]": "desc",
      limit: currentLimit,
    };

    const mdRes = await MangadexService.callProxy(
      "/manga",
      params,
      { method: "GET" }
    );

    const mdItems = mdRes?.data || [];

    if (!mdItems.length) {
      status.textContent = "Не знайдено манґи за вашими вподобаннями.";
      return;
    }

    status.textContent = `Знайдено ${mdItems.length} рекомендацій`;
    await renderList(mdItems);
  } catch (err) {
    console.error("Recommendations error:", err);
    status.textContent =
      "Помилка завантаження рекомендацій: " + (err.message || err);
  }
}

/* ==== Хендлеры ==== */

reloadBtn.addEventListener("click", loadRecommendations);
limitInput.addEventListener("change", loadRecommendations);

loadRecommendations();
