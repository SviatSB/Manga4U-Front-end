import "/js/api.client.js";

function qs(name) {
    const m = location.search.match(new RegExp("[?&]" + name + "=([^&]+)"));
    return m ? decodeURIComponent(m[1]) : null;
}

const id = qs("id");

const titleEl = document.getElementById("colName");
const infoEl = document.getElementById("collectionInfo");
const actionsEl = document.getElementById("collectionActions");
const listEl = document.getElementById("mangaList");

let isSystem = false;
let isOwner = false;

/* ============================================================
    Функция загрузки обложки манги (Mangadex API)
============================================================ */
async function getCoverUrl(mangaId) {
    try {
        const res = await MangadexService.callProxy(`/cover?manga[]=${encodeURIComponent(mangaId)}&limit=1`);
        const data = res?.data || [];
        const cover = Array.isArray(data) ? data[0] : null;
        if (!cover) return "/css/placeholder.png";

        const fileName = cover.attributes?.fileName;
        if (!fileName) return "/css/placeholder.png";
        
        const real = `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`;
        const apiBase = import.meta.env.VITE_API_BASE || '';
        return `${apiBase}/api/MangaDexProxy/image?url=${encodeURIComponent(real)}`;
    } catch {
        return "/css/placeholder.png";
    }
}

/* ============================================================
    Загрузка коллекции
============================================================ */
async function load() {
    if (!id) return;

    try {
        const data = await apiFetch(`/api/Collection/${id}`);

        titleEl.textContent = data.name;

        isSystem = data.systemCollectionType !== null;
        isOwner = data.isOwner ?? false;

        renderOwnerInfo(data);
        renderActions(data);

        // Загружаем манги коллекции
        renderManga(data.mangas || []);

    } catch (err) {
        console.error(err);
        titleEl.textContent = "Колекція не знайдена";
    }
}

/* ============================================================
    Отображение информации об авторе коллекции
============================================================ */
function renderOwnerInfo(col) {
    if (!infoEl) return;
    infoEl.innerHTML = "";

    // Не отображаем автора для системных коллекций
    if (col.systemCollectionType !== null) {
        return;
    }

    const avatarUrl = col.userAvatarUrl || col.UserAvatarUrl || "";
    const nickname = col.userNickname || col.UserNickname || "Невідомий";

    if (avatarUrl) {
        const avatar = document.createElement("img");
        avatar.src = avatarUrl;
        avatar.alt = nickname;
        avatar.style.cssText = "width: 40px; height: 40px; border-radius: 10px; object-fit: cover; border: 1px solid rgba(255, 255, 255, 0.06);";
        infoEl.appendChild(avatar);
    }

    const nameEl = document.createElement("div");
    nameEl.textContent = "Автор: " + nickname;
    nameEl.style.cssText = "font-size: 14px; color: #c9c6d6;";
    infoEl.appendChild(nameEl);
}

/* ============================================================
    Кнопки управления коллекцией
============================================================ */
function renderActions(col) {
    actionsEl.innerHTML = "";

    // если коллекция не наша или системная — никаких кнопок
    if (!col.isOwner || isSystem) {
        return;
    }

    const renameBtn = document.createElement("button");
    renameBtn.className = "btn-small";
    renameBtn.textContent = "✏ Перейменувати";
    renameBtn.onclick = async () => {
        const newName = prompt("Нова назва:");
        if (!newName) return;

        await apiFetch(`/api/Collection/${id}/rename`, {
            method: "POST",
            body: newName
        });

        load();
    };

    const visibilityBtn = document.createElement("button");
    visibilityBtn.className = "btn-small";
    visibilityBtn.textContent = col.isPublic ? "👁 Зробити приватною" : "👁 Зробити публічною";
    visibilityBtn.onclick = async () => {
        await apiFetch(`/api/Collection/${id}/visibility`, {
            method: "POST",
            body: JSON.stringify(!col.isPublic)
        });

        load();
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-small btn-danger";
    deleteBtn.textContent = "🗑 Видалити";
    deleteBtn.onclick = async () => {
        if (!confirm("Видалити колекцію?")) return;

        await apiFetch(`/api/Collection/${id}`, { method: "DELETE" });
        window.location.href = "/collections.html";
    };

    actionsEl.append(renameBtn, visibilityBtn, deleteBtn);
}


/* ============================================================
    Рендер карточек манги (с картинками!)
============================================================ */
/* ============================================================
    Рендер карточек манги (с картинками!)
============================================================ */
async function renderManga(items) {
    listEl.innerHTML = "";

    if (!items || items.length === 0) {
        const emptyDiv = document.createElement("div");
        emptyDiv.style.cssText = "grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: #c9c6d6; font-size: 16px;";
        emptyDiv.textContent = "Колекція порожня.";
        listEl.appendChild(emptyDiv);
        return;
    }

    for (const m of items) {
        const coverUrl = await getCoverUrl(m.externalId);

        const div = document.createElement("div");
        div.className = "collection-card";

        div.innerHTML = `
            <!-- Иконка удаления -->
            <button class="remove-icon" data-id="${m.externalId}" title="Видалити">🗑</button>

            <!-- Кликабельная область для перехода на мангу -->
            <a class="collection-card__link" href="/manga.html?id=${m.externalId}">
                <img class="collection-cover" src="${coverUrl}" alt="${m.name}">
                <div class="collection-title">${m.name}</div>
            </a>

            ${
                isOwner
                    ? `<button class="mini-btn remove" data-id="${m.externalId}">Вилучити</button>`
                    : ""
            }
        `;

        // ⚠️ НИКАКИХ div.addEventListener("click", ...) БОЛЬШЕ НЕ НУЖНО
        listEl.appendChild(div);
    }
}


/* ============================================================
    Удаление манги из коллекции (иконка 🗑 и кнопка "Вилучити")
============================================================ */
/* ============================================================
    Удаление манги из колекции (иконка 🗑 и кнопка "Вилучити")
============================================================ */
document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".remove-icon, .remove");
    if (!btn) return;

    // чтобы не срабатывал переход по ссылке
    e.preventDefault();
    e.stopPropagation();

    const mangaId = btn.dataset.id;

    try {
        await apiFetch(`/api/Collection/${id}/manga?mangaExternalId=${mangaId}`, {
            method: "DELETE",
        });

        await load(); // перезагружаем состав коллекции
    } catch (err) {
        console.error("Помилка видалення манґи:", err);
        alert("Не вдалося видалити манґу");
    }
});



load();
