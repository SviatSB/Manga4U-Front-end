// ===== admin.app.js — UI/фільтри/пагінація/дії (оновлено) =====
(function (w, d) {
  const me = w.currentUser || { role: 'user' };

  const qInput    = d.querySelector('#q');
  const roleSel   = d.querySelector('#roleSel');
  const statusSel = d.querySelector('#statusSel');
  const bodyEl    = d.querySelector('#usersBody');
  const pagerEl   = d.querySelector('#pager');
  const usersCard = d.querySelector('#usersCard');
  const alertBox  = d.querySelector('#adminAlert');

  // --- Перевірка ролі ---
  if (!['admin', 'owner'].includes(me.role?.toLowerCase())) {
    if (usersCard) usersCard.hidden = true;
    if (alertBox)  { alertBox.hidden = false; alertBox.textContent = 'У вас немає прав доступу.'; }
    return;
  } else {
    if (alertBox)  alertBox.hidden = true;
    if (usersCard) usersCard.hidden = false;
  }

  const state = { page: 1, perPage: 10, q: '', role: '', status: '' };

  // --- Події фільтрів ---
  if (qInput)    qInput.addEventListener('input', debounce(() => { state.q=qInput.value.trim(); state.page=1; render(); }, 250));
  if (roleSel)   roleSel.addEventListener('change', () => { state.role=roleSel.value; state.page=1; render(); });
  if (statusSel) statusSel.addEventListener('change', () => { state.status=statusSel.value; state.page=1; render(); });

  // --- Основне відображення ---
  async function render() {
    try {
      const { items, total } = await UsersStore.fetchAll({
        skip: (state.page - 1) * state.perPage,
        take: state.perPage,
        nickname: state.q,
        login: state.q,
        roles: state.role ? [state.role] : []
      });

      const filtered = state.status
        ? items.filter(u => (u.status || 'active') === state.status)
        : items;

      bodyEl.innerHTML = '';
      filtered.forEach(u => bodyEl.appendChild(row(u)));

      const pages = Math.max(1, Math.ceil(total / state.perPage));
      pagerEl.innerHTML = '';
      pagerEl.append(
        pageBtn('«', state.page <= 1, () => { if (state.page>1){ state.page--; render(); }}),
        pageInfo(`${state.page}/${pages}`),
        pageBtn('»', state.page >= pages, () => { if (state.page<pages){ state.page++; render(); }})
      );
    } catch (e) {
      console.error(e);
      Toast?.err(e.message || 'Помилка завантаження користувачів');
    }
  }

  // --- Рядок користувача ---
  function row(u) {
    const r = d.createElement('div');
    r.className = 'userRow';
    const status = u.status || 'active';
    const role = (u.roles || [u.role || 'user'])[0]?.toLowerCase() || 'user';

    r.innerHTML = `
      <div class="col col--nick">
        <img class="userAvatar" src="${esc(u.avatarUrl || './img/avatar-placeholder.png')}" alt="">
        <div>
          <div class="userNick">${esc(u.nickname || u.userName || u.email)}</div>
          <div class="userEmail">${esc(u.email || u.login)}</div>
        </div>
      </div>
      <div class="col col--email">${esc(u.email || u.login)}</div>
      <div class="col col--role"><span class="badge ${role==='admin'?'badge--role-admin':''}">${role==='admin'?'Адмін':'Користувач'}</span></div>
      <div class="col col--status"><span class="badge ${statusClass(status)}">${statusText(status)}</span></div>
      <div class="col col--actions">
        <div class="actionBar">
          ${me.role==='owner'
            ? (role==='admin'
                ? `<button class="ghostBtn act" data-act="demote" data-id="${u.id}">Зняти адміна</button>`
                : `<button class="btn btn--primary act" data-act="promote" data-id="${u.id}">Видати адміна</button>`)
            : ''}
          ${status==='muted'
            ? `<button class="ghostBtn act" data-act="unmute" data-id="${u.id}">Зняти м'ют</button>`
            : `<button class="ghostBtn act" data-act="mute" data-id="${u.id}">М'ют</button>`}
          ${status==='banned'
            ? `<button class="ghostBtn act" data-act="unban" data-id="${u.id}">Розбан</button>`
            : `<button class="ghostBtn act" data-act="ban" data-id="${u.id}">Бан</button>`}
        </div>
      </div>`;

    r.addEventListener('click', e => {
      const btn = e.target.closest('.act');
      if (!btn) return;
      handleAction(btn.dataset.act, Number(btn.dataset.id));
    });

    return r;
  }

  // --- Виконання дії ---
  async function handleAction(action, id) {
    try {
      const res = await apiFetch(`/api/Admin/user/${id}/${action}`, { method: 'POST' });
      Toast?.ok(`Операцію "${action}" виконано ✅`);
      render();
    } catch (err) {
      console.error('❌ handleAction error:', err);
      Toast?.err(err.message || 'Помилка при виконанні дії');
    }
  }

  // --- Хелпери ---
  function pageBtn(label, disabled, onClick){
    const b = d.createElement('button'); b.textContent = label; b.disabled = !!disabled; b.addEventListener('click', onClick); return b;
  }
  function pageInfo(text){ const s=d.createElement('span'); s.style.padding='8px 12px'; s.style.opacity='.8'; s.textContent=text; return s; }
  function statusText(s){ return s==='active'?'Активний': s==='muted'?'Замучений':'Забанений'; }
  function statusClass(s){ return s==='active'?'badge--status-active': s==='muted'?'badge--status-muted':'badge--status-banned'; }
  function esc(str){ return String(str||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function debounce(fn, wait){ let t=null; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }

  render();
})(window, document);
