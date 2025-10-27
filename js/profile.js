// ===== Manga4U profile.js (v4.5 — login display fix + language/about/save) =====
(() => {
  'use strict';

  const API_BASE = 'https://manga4u-164617ec4bac.herokuapp.com';
  const ENDPOINTS = {
    me: '/api/Account/me',
    changeNickname: '/api/Account/change-nickname',
    changePassword: '/api/Account/change-password',
    changeAvatar: '/api/Account/change-avatar',
    resetAvatar: '/api/Account/reset-avatar',
    setLanguage: '/api/Account/language',
    setAbout: '/api/Account/about'
  };

  const $ = (s, r = document) => r.querySelector(s);
  const msgBox = () => $('#formMessages');

  function showMsg(text, type = 'ok') {
    const box = msgBox();
    if (!box) return alert(text);
    const el = document.createElement('div');
    el.className = `msg ${type === 'err' ? 'msg--err' : 'msg--ok'}`;
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  async function api(path, options = {}) {
    const token =
      localStorage.getItem('m4u_token') ||
      sessionStorage.getItem('m4u_token');
    if (!token) throw new Error('No token found');
    const url = `${API_BASE}${path}`;
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (!(options.body instanceof FormData))
      headers.set('Content-Type', 'application/json');

    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const err = new Error(data?.message || data || res.statusText);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function initProfile() {
    const form = $('#profileForm');
    const nick = $('#nick');
    const email = $('#email');     // ✅ додано
    const passOld = $('#passOld');
    const passNew = $('#passNew');
    const passNew2 = $('#passNew2');
    const avatarInput = $('#avatarInput');
    const avatarPreview = $('#avatarPreview');
    const resetBtn = $('#avatarRemove');
    const saveBtn = form?.querySelector('button[type="submit"]');
    const langSel = $('#lang');
    const bioArea = $('#bio');

    let originalNick = '';
    let originalLang = '';
    let originalBio = '';

    // 1️⃣ Завантаження користувача
    try {
      const me = await api(ENDPOINTS.me);

      // --- логін / email ---
      email.value = me.login || me.email || ''; // ✅ показує логін

      // --- нік ---
      originalNick = me.nickname || me.userName || '';
      nick.value = originalNick;

      // --- мова ---
      if (me.language) {
        langSel.value = me.language.toLowerCase();
        originalLang = me.language.toLowerCase();
      }

      // --- про себе ---
      if (me.aboutMyself) {
        bioArea.value = me.aboutMyself;
        originalBio = me.aboutMyself;
      }

      // --- аватар ---
      if (me.avatarUrl) {
        const url = me.avatarUrl.startsWith('http')
          ? me.avatarUrl
          : `${API_BASE}/${me.avatarUrl.replace(/^\/+/, '')}`;
        avatarPreview.src = url;
      }
    } catch (err) {
      console.error('Not authorized:', err);
      showMsg('Потрібна авторизація', 'err');
      setTimeout(() => (location.href = './auth.html?next=./profile.html'), 3000);
      return;
    }

    // 2️⃣ Зміна аватара
    avatarInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        showMsg('Файл занадто великий (>2МБ)', 'err');
        return;
      }

      const fd = new FormData();
      fd.append('file', file);

      try {
        await api(ENDPOINTS.changeAvatar, { method: 'PATCH', body: fd });
        avatarPreview.src = URL.createObjectURL(file);
        showMsg('Аватар оновлено ✅');
      } catch (err) {
        console.error('Avatar change failed:', err);
        showMsg(err.message || 'Помилка при зміні аватара', 'err');
      }
    });

    // 🧹 Скидання аватара
    resetBtn?.addEventListener('click', async () => {
      try {
        await api(ENDPOINTS.resetAvatar, { method: 'PATCH' });
        avatarPreview.src = `${API_BASE}/avatar/default.png`;
        showMsg('Аватар скинуто до стандартного ✅');
      } catch (err) {
        console.error('Reset avatar failed:', err);
        showMsg(err.message || 'Помилка при скиданні аватара', 'err');
      }
    });

    // 3️⃣ Збереження змін
    saveBtn?.addEventListener('click', async (e) => {
      e.preventDefault();

      const newNick = nick.value.trim();
      const newLang = langSel.value.trim().toLowerCase();
      const newBio = bioArea.value.trim();
      const oldPwd = passOld.value.trim();
      const newPwd = passNew.value.trim();
      const newPwd2 = passNew2.value.trim();

      let anyChange = false;

      // --- зміна ніку ---
      if (newNick !== originalNick) {
        try {
          await api(ENDPOINTS.changeNickname, {
            method: 'PATCH',
            body: JSON.stringify(newNick)
          });
          showMsg('Нікнейм змінено ✅');
          originalNick = newNick;
          anyChange = true;
        } catch (err) {
          showMsg(err.message || 'Помилка при зміні ніку', 'err');
        }
      }

      // --- зміна мови ---
      if (newLang && newLang !== originalLang) {
        try {
          await api(ENDPOINTS.setLanguage, {
            method: 'PATCH',
            body: JSON.stringify(newLang)
          });
          showMsg('Мову інтерфейсу змінено ✅');
          originalLang = newLang;
          anyChange = true;
        } catch {
          showMsg('Помилка при зміні мови', 'err');
        }
      }

      // --- зміна “про себе” ---
      if (newBio !== originalBio) {
        try {
          await api(ENDPOINTS.setAbout, {
            method: 'PATCH',
            body: JSON.stringify(newBio)
          });
          showMsg('Інформацію “про себе” оновлено ✅');
          originalBio = newBio;
          anyChange = true;
        } catch {
          showMsg('Помилка при оновленні поля “про себе”', 'err');
        }
      }

      // --- зміна паролю ---
      const wantsChangePassword =
        oldPwd.length > 0 && newPwd.length > 0 && newPwd2.length > 0;
      if (wantsChangePassword) {
        try {
          if (newPwd !== newPwd2)
            throw new Error('Паролі не співпадають');
          if (newPwd.length < 8)
            throw new Error('Мінімум 8 символів');

          await api(ENDPOINTS.changePassword, {
            method: 'POST',
            body: JSON.stringify({
              OldPassword: oldPwd,
              NewPassword: newPwd
            })
          });
          showMsg('Пароль змінено ✅');
          passOld.value = newPwd;
          passNew.value = passNew2.value = '';
          anyChange = true;
        } catch (err) {
          showMsg(err.message || 'Помилка при зміні паролю', 'err');
        }
      }

      if (!anyChange) showMsg('Зміни відсутні', 'err');
    });

    // 👁 перемикання видимості пароля
    document.querySelectorAll('.form__togglePass').forEach((btn) => {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      `;
      btn.addEventListener('click', () => {
        const input = btn.closest('.pw')?.querySelector('input');
        if (!input) return;
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        btn.classList.toggle('active', isHidden);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', initProfile);
})();
