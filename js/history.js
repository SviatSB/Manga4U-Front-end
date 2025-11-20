import "/js/api.client.js";

const list = document.getElementById("historyList");
const errorBox = document.getElementById("errorMessage");

async function loadHistory() {
  console.log("HISTORY PAGE LOADED");

  try {
    const res = await apiFetch("/api/history");
    console.log("API RESULT:", res);

    if (!Array.isArray(res) || res.length === 0) {
      list.innerHTML = `<p style="opacity:.7; text-align:center;">Немає історії</p>`;
      return;
    }

    renderHistory(res);
  } catch (e) {
    errorBox.style.display = "block";
    errorBox.textContent = "Не вдалося завантажити історію";
    console.error(e);
  }
}

function renderHistory(items) {
  list.innerHTML = "";

  // сортируем — последние 4
  const recent = items
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 20);

  for (const item of recent) {
    const chapterId =
      item.lastChapterId || item.LastChapterId || item.chapterId;

    const mangaName =
      item.mangaName || item.MangaName || "Невідома манґа";

    const chapterNumber =
      item.lastChapterNumber ?? item.LastChapterNumber ?? "?";

    const chapterTitle =
      item.lastChapterTitle || item.LastChapterTitle || "Без назви";

    const lang = item.language || item.Language || "en";

    const card = document.createElement("div");
    card.className = "history-card";

    card.innerHTML = `
      <div class="history-card__info">
        <div class="history-card__title">
          Розділ ${chapterNumber} — ${chapterTitle}
        </div>
        <div class="history-card__manga">
          Манґа: ${mangaName}
        </div>
      </div>

      <a class="history-card__btn"
         href="/reader.html?chapterId=${chapterId}&lang=${lang}">
         Продовжити
      </a>
    `;

    list.appendChild(card);
  }
}

loadHistory();
