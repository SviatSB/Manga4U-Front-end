import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css             */import"./api.client-Cwoejsn1.js";import{M as v}from"./main-FYAW3UC_.js";function k(a){const r=location.search.match(new RegExp("[?&]"+a+"=([^&]+)"));return r?decodeURIComponent(r[1]):null}const m=k("id"),b=document.getElementById("content");async function C(a,r){try{await fetch("/api/history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mangaExternalId:m,lastChapterId:a.id,lastChapterTitle:a.attributes?.title||"",lastChapterNumber:Number(a.attributes?.chapter||0),language:r})})}catch(n){console.warn("History save failed:",n)}}async function S(){if(!m){b.innerHTML='<div class="manga-error">Не передано manga id у запиті</div>';return}b.innerHTML='<div id="status" class="manga-status">Завантаження манґи...</div>';try{const a=await v.callProxy(`/manga/${m}`),r=a?.data||a,n=r?.attributes||{},g=n?.title&&(n.title.en||Object.values(n.title||{})[0])||"(Немає назви)",u=n?.altTitles&&n.altTitles.length?n.altTitles[0]&&(n.altTitles[0].en||Object.values(n.altTitles[0]||{})[0]):"",I=n?.description&&(n.description.en||Object.values(n.description||{})[0])||"",f=n?.status||"",$=n?.year||"",w=(r.relationships||[]).find(t=>t.type==="cover_art");let L="/css/placeholder.png";if(w&&w.id)try{const t=await v.callProxy(`/cover/${w.id}`),s=(t?.data||t)?.attributes?.fileName;s&&(L=`https://uploads.mangadex.org/covers/${m}/${s}`)}catch{}const x=(r?.attributes?.tags||[]).map(t=>t?.attributes?.name&&(t.attributes.name.en||Object.values(t.attributes.name||{})[0])||"").filter(Boolean),y={};async function T(t){if(!t)return[];if(y[t])return y[t];const s=(await v.callProxy(`/chapter?manga=${m}&translatedLanguage[]=${encodeURIComponent(t)}&limit=1`))?.total||0;if(!s)return y[t]=[],[];const d=2e3,c=100,e=Math.min(s,d),i=Math.ceil(e/c),o=[];for(let l=0;l<i;l++){const h=l*c,M=(await v.callProxy(`/chapter?manga=${m}&translatedLanguage[]=${encodeURIComponent(t)}&limit=${c}&offset=${h}`))?.data||[];if(!M.length||(o.push(...M),M.length<c))break}return y[t]=o,o}const B={en:"English",ru:"Русский",tr:"Türkçe",ja:"日本語",es:"Español",fr:"Français",pt:"Português","pt-br":"Português (BR)",uk:"Українська"};async function A(){const t=document.getElementById("langArea");t.innerHTML="Завантаження доступних перекладів...";try{const p=n?.availableTranslatedLanguages||[];let s=[];if(p?.length)s=p.slice();else{const e=(await v.callProxy(`/chapter?manga=${m}&limit=1`))?.total||0;if(!e)return t.innerHTML='<div class="lang-message lang-message--empty">Переклади відсутні</div>',{langs:[]};const i=Math.min(e,1e3),l=(await v.callProxy(`/chapter?manga=${m}&limit=${i}`))?.data||[];s=Array.from(new Set(l.map(h=>h.attributes?.translatedLanguage).filter(Boolean)))}if(!s.length)return t.innerHTML='<div class="lang-message lang-message--empty">Переклади відсутні</div>',{langs:[]};const d=s.map((c,e)=>{const i=B[c]||c;return`
              <label class="lang-option">
                <input type="radio" name="lang" value="${c}" ${e===0?"checked":""} />
                <span>${i}</span>
              </label>
            `}).join("");return t.innerHTML=`
          <div class="lang-options">${d}</div>
          <div class="lang-start-wrap">
            <button id="startRead" class="btn btn-accent">Почати читати (з першої)</button>
          </div>
        `,{langs:s}}catch{return t.innerHTML='<div class="lang-message lang-message--error">Помилка завантаження перекладів</div>',{langs:[]}}}async function H(t,p){const s=document.getElementById("chaptersArea"),d=t.slice();if(!d.length){s.innerHTML='<div class="chapters__empty">Немає глав</div>';return}d.sort((e,i)=>new Date(e.attributes.readableAt)-new Date(i.attributes.readableAt));const c=d.map(e=>{const i=e.attributes?.chapter||"",o=e.attributes?.title||"",l=e.attributes?.pages||0;return`
            <div class="chapters__row">
              <div class="chapters__title">${i} ${o}</div>
              <div class="chapters__right">
                <div class="chapters__meta">${l} стр.</div>
                <button class="btn btn-small readBtn"
                        data-id="${e.id}"
                        data-lang="${p}">
                  Читати
                </button>
              </div>
            </div>
          `}).join("");s.innerHTML=`
        <h3>Глави (${d.length})</h3>
        <div class="chapters">${c}</div>
      `,s.querySelectorAll(".readBtn").forEach(e=>{e.addEventListener("click",async()=>{const i=e.dataset.id,o=e.dataset.lang,l=t.find(h=>h.id===i);l&&await C(l,o),window.location.href=`/reader.html?chapterId=${i}`})})}window.__mangaData={externalId:m,title:g,description:I,coverUrl:L,status:f,year:$},b.innerHTML=`
      <div class="layout">
        <div class="layout__cover">
          <img class="thumb" src="${L}" alt="${g}" />
        </div>
        <div class="layout__main">
          <h1>${g}</h1>
          <button id="addToCollectionBtn" class="btn btn-accent" style="margin-bottom: 10px;">
            + Додати в колекцію
          </button>
          <div class="meta">
            ${u}
            ${$?" · "+$:""}
            ${f?" · "+f:""}
          </div>

          <div class="tags">
            ${x.map(t=>`<span class="tag">${t}</span>`).join("")}
          </div>

          <h3>Опис</h3>
          <pre class="desc">${I}</pre>

          <h3>Доступні переклади</h3>
          <div id="langArea" class="lang-area">Завантаження...</div>
          <div id="chaptersArea" class="chapters-area"></div>
        </div>
      </div>
    `,(async()=>{const{langs:t}=await A();if(!t.length)return;document.getElementsByName("lang").forEach(c=>c.addEventListener("change",async()=>{const e=document.querySelector("input[name=lang]:checked").value,i=await T(e);await H(i,e)}));const s=document.querySelector("input[name=lang]:checked").value,d=await T(s);await H(d,s),document.getElementById("startRead").addEventListener("click",async()=>{const c=document.querySelector("input[name=lang]:checked").value,i=(await T(c)).slice().sort((l,h)=>new Date(l.attributes.readableAt)-new Date(h.attributes.readableAt));if(!i.length){alert("Немає глав для цієї мови");return}const o=i[0];await C(o,c),window.location.href=`/reader.html?chapterId=${o.id}`})})()}catch(a){b.innerHTML='<div class="manga-error">Помилка завантаження манґи: '+j(String(a))+"</div>"}}function j(a){return String(a||"").replace(/[&<>"']/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[r])}S();function P(){const a=window.__mangaData;return!a||!a.externalId?(console.error("mangaData not loaded"),null):a}const _=document.getElementById("collectionModal"),E=document.getElementById("collectionList"),O=document.getElementById("closeModal");document.addEventListener("click",a=>{a.target.closest("#addToCollectionBtn")&&D()});O.addEventListener("click",()=>_.classList.add("hidden"));async function D(){_.classList.remove("hidden"),E.innerHTML="<div>Завантаження...</div>";try{const a=await apiFetch("/api/Collection/system"),r=await apiFetch("/api/Collection/user"),n=a.map(u=>`<button class="collection-btn" data-id="${u.id}">${u.name}</button>`).join(""),g=r.map(u=>`<button class="collection-btn" data-id="${u.id}">${u.name}</button>`).join("");E.innerHTML=`
            <h3>Системні</h3>
            ${n||"<div>Порожньо</div>"}

            <h3 style="margin-top:12px">Мої колекції</h3>
            ${g||"<div>Порожньо</div>"}
        `}catch{E.innerHTML="<div>Помилка завантаження</div>"}}document.addEventListener("click",async a=>{const r=a.target.closest(".collection-btn");if(!r)return;const n=r.dataset.id,g=P();if(g)try{await apiFetch(`/api/Collection/${n}/manga?mangaExternalId=${g.externalId}`,{method:"POST"}),alert("Манґу додано до колекції ✔"),_.classList.add("hidden")}catch(u){console.error(u),alert("Не вдалося додати мангу")}});
