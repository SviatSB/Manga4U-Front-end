import "/js/api.client.js";

const input = document.getElementById("searchInput");
const results = document.getElementById("searchResults");

/* ============================
   Обработчик ввода
============================ */
input.addEventListener("input", async () => {
    const q = input.value.trim();

    if (!q) {
        results.innerHTML = "";
        return;
    }

    try {
        const data = await apiFetch(`/api/Collection/search?name=${encodeURIComponent(q)}`);
        renderResults(data || []);
    } catch (err) {
        console.error("Search error:", err);
        results.innerHTML = `<div class="empty">Помилка пошуку</div>`;
    }
});

/* ============================
   Рендер результата
============================ */
function renderResults(list) {
    results.innerHTML = "";

    if (!list.length) {
        results.innerHTML = `<div class="empty">Нічого не знайдено.</div>`;
        return;
    }

    list.forEach(col => {
        const card = document.createElement("div");
        card.className = "collection-card search-card";

        const owner =
            col.ownerName ||
            col.userName ||
            col.ownerLogin ||
            "Невідомий автор";

        card.innerHTML = `
            <div class="search-card__body">
                <div class="collection-title">${col.name}</div>
                <div class="collection-meta">
                    Автор: ${owner}
                </div>
            </div>

            <div class="search-card__actions">
                <button class="btn-secondary open-btn">Переглянути</button>
                <button class="btn-primary clone-btn">➕ Додати до моїх</button>
            </div>
        `;

        // открыть оригинальную коллекцию
        card.querySelector(".open-btn").addEventListener("click", () => {
            window.location.href = `/collection.html?id=${col.id}`;
        });

        // скопировать коллекцию себе
        card.querySelector(".clone-btn").addEventListener("click", async (e) => {
            e.stopPropagation();

            try {
                const created = await apiFetch(`/api/Collection/${col.id}/clone`, {
                    method: "POST",
                });

                alert("Колекцію скопійовано у ваші колекції ✅");

                if (created && created.id) {
                    // переходим на уже скопированную коллекцию
                    window.location.href = `/collection.html?id=${created.id}`;
                }
            } catch (err) {
                console.error("Clone error:", err);
                alert("Не вдалося додати колекцію собі");
            }
        });

        results.appendChild(card);
    });
}
