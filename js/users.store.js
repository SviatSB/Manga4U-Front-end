// ===== users.store.js (v2.0 — без DEMO, лише API) =====
window.UsersStore = (function () {
  'use strict';

  // ✅ Отримати користувачів з бекенду
  async function fetchAll(params = {}) {
    const query = new URLSearchParams();
    if (params.skip) query.set('skip', params.skip);
    if (params.take) query.set('take', params.take);
    if (params.nickname) query.set('nickname', params.nickname);
    if (params.login) query.set('login', params.login);
    if (params.roles && params.roles.length) {
      for (const r of params.roles) query.append('roles', r);
    }

    const data = await apiFetch(`/api/Admin/users?${query.toString()}`, {
      method: 'GET'
    });

    const items = data?.items || [];
    const total = data?.total ?? items.length;
    return { items, total };
  }

  // ✅ Отримати одного користувача (опціонально)
  async function getById(id) {
    const { items } = await fetchAll();
    return items.find(u => u.id === id) || null;
  }

  return {
    fetchAll,
    getById
  };
})();
