// ===== admin.app.server.js (v5.0 — логіка mute/ban синхронізована з .NET API) =====
(function (w, d) {
  document.addEventListener('DOMContentLoaded', () => {
    const qInput    = d.querySelector('#q');
    const roleSel   = d.querySelector('#roleSel');
    const statusSel = d.querySelector('#statusSel');
    const bodyEl    = d.querySelector('#usersBody');
    const pagerEl   = d.querySelector('#pager');
    const usersCard = d.querySelector('#usersCard');
    const alertBox  = d.querySelector('#adminAlert');

    const state = { page: 1, perPage: 10, q: '', role: '', status: '' };
    let me = null;
    let isOwner = false;
    let isAdmin = false;
    let allUsers = [];

    init().catch(err => {
      console.error(err);
      showMsg(err.message || 'Помилка ініціалізації', 'err');
    });

    async function init() {
      try {
        me = await Auth.me(true);
      } catch (e) {
        usersCard?.setAttribute('hidden', 'true');
        if (alertBox) {
          alertBox.hidden = false;
          alertBox.textContent = 'Потрібна авторизація.';
        }
        return;
      }

      isOwner = Auth.hasRole(me, 'owner');
      isAdmin = isOwner || Auth.hasRole(me, 'admin');

      if (!isAdmin) {
        usersCard.hidden = true;
        alertBox.hidden = false;
        alertBox.textContent = 'У вас немає прав доступу.';
        return;
      }

      alertBox.hidden = true;
      usersCard.hidden = false;

      qInput?.addEventListener('input', debounce(() => { state.q = qInput.value.trim(); state.page=1; render(); }, 250));
      roleSel?.addEventListener('change', () => { state.role = roleSel.value; state.page=1; render(); });
      statusSel?.addEventListener('change', () => { state.status = statusSel.value; state.page=1; render(); });

      await render();
    }

    async function fetchUsers() {
      const skip = (state.page - 1) * state.perPage;
      const take = state.perPage;
      const params = new URLSearchParams();
      params.set('skip', skip);
      params.set('take', take);
      if (state.q) {
        params.set('nickname', state.q);
        params.set('login', state.q);
      }
      if (state.role) params.append('roles', state.role);

      const data = await apiFetch(`/api/Admin/users?${params.toString()}`, { method:'GET' });
      const items = data?.items || [];
      const total = data?.total ?? items.length;
      allUsers = items;
      return { items, total };
    }

    async function render() {
      try {
        const { items, total } = await fetchUsers();
        const filtered = state.status ? items.filter(u => statusOf(u) === state.status) : items;
        bodyEl.innerHTML = '';
        filtered.forEach(u => bodyEl.appendChild(row(u)));
        const pages = Math.max(1, Math.ceil(total / state.perPage));
        pagerEl.innerHTML = '';
        pagerEl.append(
          pageBtn('«', state.page <= 1, () => { if (state.page>1){ state.page--; render(); } }),
          pageInfo(`${state.page}/${pages}`),
          pageBtn('»', state.page >= pages, () => { if (state.page<pages){ state.page++; render(); } })
        );
      } catch (e) {
        console.error(e);
        showMsg(e.message || 'Помилка завантаження користувачів', 'err');
      }
    }

    function showMsg(text, type = 'ok') {
      const el = document.createElement('div');
      el.className = `msg ${type === 'err' ? 'msg--err' : 'msg--ok'}`;
      el.textContent = text;
      el.style.position = 'fixed';
      el.style.bottom = '20px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.padding = '8px 16px';
      el.style.borderRadius = '8px';
      el.style.background = type === 'err' ? '#a33' : '#3a3';
      el.style.color = '#fff';
      el.style.zIndex = 9999;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2500);
    }

    function statusOf(u) {
      const banned = !!(u.isBanned ?? u.banned ?? u.status === 'banned');
      const muted  = !!(u.isMuted  ?? u.muted  ?? u.status === 'muted');
      if (banned) return 'banned';
      if (muted)  return 'muted';
      return 'active';
    }

    function isAdminRole(u) {
      const roles = (u.roles || []).map(r => String(r).toLowerCase());
      return roles.includes('admin');
    }

    function isOwnerRole(u) {
      const roles = (u.roles || []).map(r => String(r).toLowerCase());
      return roles.includes('owner');
    }

    function row(u) {
      const r = d.createElement('div');
      r.className = 'userRow';
      const st = statusOf(u);
      const roleIsAdmin = isAdminRole(u);
      const roleIsOwner = isOwnerRole(u);

      // Backend guarantees `u.avatarUrl` is a full absolute URL.
      // Use it as-is (trim whitespace). No local fallback is used.
      const avatarSrc = (typeof u.avatarUrl === 'string' && u.avatarUrl.trim()) ? u.avatarUrl.trim() : '';

      r.innerHTML = `
        <div class="col col--nick">
          <img class="userAvatar" src="${esc(avatarSrc)}" alt="avatar">
          <div>
            <div class="userNick">${esc(u.nickname || u.userName)}</div>
            <div class="userEmail">${esc(u.login || u.email)}</div>
          </div>
        </div>
        <div class="col col--email">${esc(u.email || u.login)}</div>
        <div class="col col--role"><span class="badge ${roleIsOwner?'badge--role-owner':roleIsAdmin?'badge--role-admin':''}">
          ${roleIsOwner?'Власник':roleIsAdmin?'Адмін':'Користувач'}</span></div>
        <div class="col col--status"><span class="badge ${statusClass(st)}">${statusText(st)}</span></div>
        <div class="col col--actions">
          <div class="actionBar">
            ${isOwner ? (roleIsAdmin && !roleIsOwner
              ? `<button class="ghostBtn act" data-act="demote" data-id="${u.id}">Зняти адміна</button>`
              : (!roleIsOwner ? `<button class="btn btn--primary act" data-act="promote" data-id="${u.id}">Видати адміна</button>` : '')) : ''}

            ${(st !== 'banned')
              ? `<button class="ghostBtn act" data-act="${st==='muted'?'unmute':'mute'}" data-id="${u.id}">${st==='muted'?"Зняти м'ют":"М'ют"}</button>`
              : ''}

            ${(st==='banned')
              ? `<button class="ghostBtn act" data-act="unban" data-id="${u.id}">Розбан</button>`
              : `<button class="ghostBtn act" data-act="ban" data-id="${u.id}">Бан</button>`}
          </div>
        </div>`;
      r.addEventListener('click', onRowClick);
      return r;
    }

    function onRowClick(e) {
      const b = e.target.closest('.act');
      if (!b) return;
      handleAction(Number(b.dataset.id), b.dataset.act);
    }

    async function handleAction(id, action) {
      try {
        const token = localStorage.getItem('m4u_token') || sessionStorage.getItem('m4u_token');
        const u = allUsers.find(x => x.id === id);
        if (!u) return;

        const currentStatus = statusOf(u);

        if (isOwnerRole(u)) {
          showMsg('⚠️ Неможливо виконати дію над власником системи', 'err');
          return;
        }
        if (isAdminRole(u) && !isOwner) {
          showMsg('⚠️ Ви не можете виконати дію над іншим адміністратором', 'err');
          return;
        }
        if (currentStatus === 'banned' && action === 'mute') {
          showMsg('⚠️ Користувач вже забанений (м’ют не потрібен)', 'err');
          return;
        }

        const res = await fetch(`${API_BASE}/api/Admin/user/${id}/${action}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || res.statusText);
        }

        // === Фикс локального состояния ===
        switch (action) {
          case 'ban':
            u.isBanned = true;
            u.isMuted = true;
            break;
          case 'unban':
            u.isBanned = false;
            u.isMuted = false;
            break;
          case 'mute':
            u.isMuted = true;
            u.muted = true;
            break;
          case 'unmute':
            u.isMuted = false;
            u.muted = false;
            // 🧠 локально сбрасываем “признак мута” чтобы при следующем render() он остался активным
            localStorage.setItem(`m4u_unmuted_${id}`, 'true');
            break;
        }

        updateRowUI(id, statusOf(u));
        showMsg(`Операцію "${action}" виконано ✅`);
      } catch (err) {
        console.error('❌ handleAction error:', err);
        showMsg(err.message || 'Помилка при виконанні дії', 'err');
      }
    }



    function updateRowUI(id, newStatus) {
      const rowEl = bodyEl.querySelector(`[data-id="${id}"]`)?.closest('.userRow');
      if (!rowEl) { render(); return; }

      const statusEl = rowEl.querySelector('.col--status span');
      if (statusEl) {
        statusEl.className = `badge ${statusClass(newStatus)}`;
        statusEl.textContent = statusText(newStatus);
      }

      const actionBar = rowEl.querySelector('.actionBar');
      if (!actionBar) return;

      // Перемальовуємо кнопки, щоб після unban знову з'явився "М'ют"
      const u = allUsers.find(x => x.id === id);
      actionBar.innerHTML = `
        ${(newStatus !== 'banned')
          ? `<button class="ghostBtn act" data-act="${newStatus==='muted'?'unmute':'mute'}" data-id="${id}">${newStatus==='muted'?"Зняти м'ют":"М'ют"}</button>`
          : ''}

        ${(newStatus==='banned')
          ? `<button class="ghostBtn act" data-act="unban" data-id="${id}">Розбан</button>`
          : `<button class="ghostBtn act" data-act="ban" data-id="${id}">Бан</button>`}
      `;
    }

    // Helpers
    function pageBtn(label, disabled, onClick){ const b=d.createElement('button'); b.textContent=label; b.disabled=!!disabled; b.addEventListener('click',onClick); return b; }
    function pageInfo(text){ const s=d.createElement('span'); s.style.padding='8px 12px'; s.textContent=text; return s; }
    function statusText(s){ return s==='active'?'Активний': s==='muted'?'Замучений':'Забанений'; }
    function statusClass(s){ return s==='active'?'badge--status-active': s==='muted'?'badge--status-muted':'badge--status-banned'; }
    function esc(str){ return String(str||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
    function debounce(fn,wait){ let t=null; return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),wait);} }
  });
})(window, document);
