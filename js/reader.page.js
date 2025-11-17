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

/* =========================================================
   👍 Сохранение истории (просмотр главы)
   ========================================================= */
async function saveHistory(chapter) {
  try {
    const mangaRel = chapter.relationships?.find(r => r.type === "manga");
    if (!mangaRel) return;

    const mangaId = mangaRel.id;
    const attrs = chapter.attributes || {};

    const number = parseInt(attrs.chapter || "0");
    const safeTitle =
      attrs.title && attrs.title.trim().length > 0
        ? attrs.title
        : `Chapter ${number || "?"}`;

    const dto = {
      mangaExternalId: mangaId,
      lastChapterId: chapterId,
      language: attrs.translatedLanguage || "unknown",
      lastChapterTitle: safeTitle,   // <<< ИСПРАВЛЕНО
      lastChapterNumber: number,
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
   Загрузка и отображение страниц главы
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

    // 👇 Сохраняем историю (только авторизованным)
    if (chapter) await saveHistory(chapter);

    const res = await MangadexService.callProxy(`/at-home/server/${chapterId}`);

    const base = res?.baseUrl;
    const chapterData = res?.chapter || {};
    const hash = chapterData.hash;
    const files = (useSaver.checked ? chapterData.dataSaver : chapterData.data) || [];

    if (!base || !hash || !files.length) {
      status.textContent = "Немає доступних сторінок для цього розділу";
      return;
    }

    status.textContent = `Сторінок: ${files.length}`;

    openBase.href = base;
    openBase.textContent = "Відкрити baseUrl";

    content.innerHTML = "";

    for (const f of files) {
      const img = document.createElement("img");
      img.src = `${base}/data/${hash}/${f}`;
      img.alt = f;
      content.appendChild(img);
    }
  } catch (err) {
    status.textContent = "Помилка завантаження сторінок: " + (err.message || err);
    content.innerHTML = "";
  }
}

reloadBtn.addEventListener("click", loadPages);
useSaver.addEventListener("change", loadPages);

loadPages();
