import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css             */import"./api.client-Cwoejsn1.js";import"./main-FYAW3UC_.js";const n=document.getElementById("historyList"),s=document.getElementById("errorMessage");async function p(){console.log("HISTORY PAGE LOADED");try{const e=await apiFetch("/api/history");if(console.log("API RESULT:",e),!Array.isArray(e)||e.length===0){n.innerHTML='<p style="opacity:.7; text-align:center;">Немає історії</p>';return}h(e)}catch(e){s.style.display="block",s.textContent="Не вдалося завантажити історію",console.error(e)}}function h(e){n.innerHTML="";const o=e.sort((t,a)=>new Date(a.updatedAt)-new Date(t.updatedAt)).slice(0,20);for(const t of o){const a=t.lastChapterId||t.LastChapterId||t.chapterId,c=t.mangaName||t.MangaName||"Невідома манґа",i=t.lastChapterNumber??t.LastChapterNumber??"?",l=t.lastChapterTitle||t.LastChapterTitle||"Без назви",d=t.language||t.Language||"en",r=document.createElement("div");r.className="history-card",r.innerHTML=`
      <div class="history-card__info">
        <div class="history-card__title">
          Розділ ${i} — ${l}
        </div>
        <div class="history-card__manga">
          Манґа: ${c}
        </div>
      </div>

      <a class="history-card__btn"
         href="/reader.html?chapterId=${a}&lang=${d}">
         Продовжити
      </a>
    `,n.appendChild(r)}}p();
