import "/js/api.client.js";

const SYSTEM_TITLES = {
    Favorite: "⭐ Улюблені",
    Reading: "📖 Читаю",
    WantToRead: "📌 Хочу прочитати",
    Completed: "✅ Завершені"
};


const systemBlock = document.getElementById("systemCollections");
const userBlock = document.getElementById("userCollections");
const createBtn = document.getElementById("createCollectionBtn");

async function loadCollections() {
    systemBlock.innerHTML = "Завантаження...";
    userBlock.innerHTML = "Завантаження...";

    try {
        const system = await apiFetch("/api/Collection/system");
        const user = await apiFetch("/api/Collection/user");

        renderCollections(systemBlock, system, true);
        renderCollections(userBlock, user, false);

    } catch (err) {
        console.error(err);
        systemBlock.innerHTML = "Помилка";
        userBlock.innerHTML = "Помилка";
    }
}

function renderCollections(container, items, isSystem) {
    container.innerHTML = "";

    if (!items?.length) {
        container.innerHTML = "<div class='empty'>Немає колекцій</div>";
        return;
    }

    items.forEach(async col => {

        // ---- Локализация названия ----
        const displayName = isSystem
            ? SYSTEM_TITLES[col.name] || col.name
            : col.name;

        // ---- Загрузка количества манги ----
        let mangaCount = 0;
        try {
            const full = await apiFetch(`/api/Collection/${col.id}`);
            mangaCount = full.mangas?.length ?? 0;
        } catch (err) {
            console.warn("Не вдалося отримати манги колекції", col.id);
        }

        const div = document.createElement("div");
        div.className = `collection-item ${isSystem ? "system" : ""}`;

        div.innerHTML = `
            <div class="collection-title">${displayName}</div>
            <div class="collection-count">Манґ: ${mangaCount}</div>

            ${
                isSystem ? "" :
                `<div class="collection-actions">
                    <button class="action-btn rename" data-id="${col.id}">✏ Редагувати</button>
                    <button class="action-btn visibility" data-id="${col.id}">
                        ${col.isPublic ? "👁 Публічна" : "🙈 Приватна"}
                    </button>
                    <button class="action-btn delete" data-id="${col.id}">🗑 Видалити</button>
                </div>`
            }
        `;

        // ---- Переход в коллекцию ----
        div.addEventListener("click", ev => {
            if (ev.target.closest(".action-btn")) return;
            window.location.href = `/collection.html?id=${col.id}`;
        });

        container.appendChild(div);
    });
}


/* Создание новой коллекции */
createBtn.addEventListener("click", async () => {
    const name = prompt("Назва колекції:");
    if (!name) return;

    await apiFetch("/api/Collection", {
        method: "POST",
        body: JSON.stringify(name)
    });

    loadCollections();
});

/* Обработчики кнопок */
document.addEventListener("click", async e => {
    const del = e.target.closest(".delete");
    const ren = e.target.closest(".rename");
    const vis = e.target.closest(".visibility");

    if (del) {
        const id = del.dataset.id;
        if (!confirm("Видалити колекцію?")) return;

        await apiFetch(`/api/Collection/${id}`, { method: "DELETE" });
        return loadCollections();
    }

    if (ren) {
        const id = ren.dataset.id;
        const newName = prompt("Нова назва:");
        if (!newName) return;

        await apiFetch(`/api/Collection/${id}/rename`, {
            method: "POST",
            body: JSON.stringify(newName)
        });


        return loadCollections();
    }

    if (vis) {
        const id = vis.dataset.id;

        const col = await apiFetch(`/api/Collection/${id}`);

        await apiFetch(`/api/Collection/${id}/visibility`, {
            method: "POST",
            body: JSON.stringify(!col.isPublic)
        });

        return loadCollections();
    }
});

loadCollections();
