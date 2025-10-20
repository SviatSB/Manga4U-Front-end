// js/auth.session.js — опционально
const AuthSession = {
  meCache: null,

  async login(login, password) {
    const r = await apiFetch('/api/Account/login', {
      method: 'POST',
      body: { login, password }
    });
    if (!r || !r.token) throw new Error('Токен не отримано');
    TokenStore.set(r.token);
    this.meCache = null;
    return r.token;
  },

  async register(login, password, nickname) {
    return apiFetch('/api/Account/register', {
      method: 'POST',
      body: { login, password, nickname }
    });
  },

  async me(force=false) {
    if (!force && this.meCache) return this.meCache;
    const u = await apiFetch('/api/Account/me', { method:'GET' });
    const roles = (u?.roles || u?.role || []).map?.(r => String(r).toLowerCase()) || [];
    const user = { ...u, roles };
    this.meCache = user;
    return user;
  },

  logout() { TokenStore.clear(); this.meCache = null; }
};
