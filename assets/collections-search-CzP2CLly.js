import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css             *//* empty css                    */import"./header.init-DNZ4xaCr.js";import"./api.client-Cwoejsn1.js";const o=document.getElementById("searchInput"),c=document.getElementById("searchResults");o.addEventListener("input",async()=>{const t=o.value.trim();if(!t){c.innerHTML="";return}try{const e=await apiFetch(`/api/Collection/search?name=${encodeURIComponent(t)}`);s(e||[])}catch(e){console.error("Search error:",e),c.innerHTML='<div class="empty">Помилка пошуку</div>'}});function s(t){if(c.innerHTML="",!t.length){c.innerHTML='<div class="empty">Нічого не знайдено.</div>';return}t.forEach(e=>{const n=document.createElement("div");n.className="collection-card search-card";const i=e.ownerName||e.userName||e.ownerLogin||"Невідомий автор";n.innerHTML=`
            <div class="search-card__body">
                <div class="collection-title">${e.name}</div>
                <div class="collection-meta">
                    Автор: ${i}
                </div>
            </div>

            <div class="search-card__actions">
                <button class="btn-secondary open-btn">Переглянути</button>
                <button class="btn-primary clone-btn">➕ Додати до моїх</button>
            </div>
        `,n.querySelector(".open-btn").addEventListener("click",()=>{window.location.href=`/collection.html?id=${e.id}`}),n.querySelector(".clone-btn").addEventListener("click",async a=>{a.stopPropagation();try{const r=await apiFetch(`/api/Collection/${e.id}/clone`,{method:"POST"});alert("Колекцію скопійовано у ваші колекції ✅"),r&&r.id&&(window.location.href=`/collection.html?id=${r.id}`)}catch(r){console.error("Clone error:",r),alert("Не вдалося додати колекцію собі")}}),c.appendChild(n)})}
