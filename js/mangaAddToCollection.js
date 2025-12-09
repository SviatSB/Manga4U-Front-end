// Получаем данные манги из manga.js
function getManga() {
    const m = window.__mangaData;
    if (!m || !m.externalId) {
        console.error("mangaData not loaded");
        return null;
    }
    return m;
}

// Элементы модалки
const modal = document.getElementById("collectionModal");
const list = document.getElementById("collectionList");
const closeBtn = document.getElementById("closeModal");

// Открыть модалку
document.addEventListener("click", e => {
    if (e.target.closest("#addToCollectionBtn")) {
        openCollectionModal();
    }
});

// Закрыть
closeBtn.addEventListener("click", () => modal.classList.add("hidden"));


// 🔥 Загружаем коллекции пользователя
async function openCollectionModal() {
    modal.classList.remove("hidden");
    list.innerHTML = "<div>Завантаження...</div>";

    try {
        const systems = await apiFetch("/api/Collection/system");
        const users = await apiFetch("/api/Collection/user");

        const sysHtml = systems.map(c =>
            `<button class="collection-btn" data-id="${c.id}">${c.name}</button>`
        ).join("");

        const userHtml = users.map(c =>
            `<button class="collection-btn" data-id="${c.id}">${c.name}</button>`
        ).join("");

        list.innerHTML = `
            <h3>Системні</h3>
            ${sysHtml || "<div>Порожньо</div>"}

            <h3 style="margin-top:12px">Мої колекції</h3>
            ${userHtml || "<div>Порожньо</div>"}
        `;
    } catch {
        list.innerHTML = "<div>Помилка завантаження</div>";
    }
}


// 🔥 Добавление манги в коллекцию (без лишних API)
document.addEventListener("click", async e => {
    const btn = e.target.closest(".collection-btn");
    if (!btn) return;

    const collectionId = btn.dataset.id;
    const manga = getManga();
    if (!manga) return;

    try {
        await apiFetch(
            `/api/Collection/${collectionId}/manga?mangaExternalId=${manga.externalId}`,
            { method: "POST" }
        );

        alert("Манґу додано до колекції ✔");
        modal.classList.add("hidden");
    } catch (err) {
        console.error(err);
        alert("Не вдалося додати мангу");
    }
});
