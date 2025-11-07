// Service for Mangadex via project proxy
// Uses proxy: VITE_API_BASE/api/mangadexproxy?path=/...&other=params

const API_BASE = import.meta.env.VITE_API_BASE || '';

function buildQuery(params = {}) {
  const parts = [];
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.join('&');
}

async function callProxy(path, extraParams = {}, options = {}) {
  // path must be a string like '/manga' (no domain)
  const proxyPath = '/api/mangadexproxy';

  // Build query: path as first param, then other params
  const params = { path };
  // merge extraParams (they will be appended after path)
  Object.assign(params, extraParams);

  const qs = buildQuery(params);
  const url = `${proxyPath}?${qs}`;

  // Prefer using global apiFetch (shared in project) if available
  if (typeof window !== 'undefined' && window.apiFetch) {
    return window.apiFetch(url, options);
  }

  // Fallback to fetch using API_BASE
  const headers = new Headers(options.headers || {});
  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(data?.message || data || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------------------------
// Tag cache / helpers
// ---------------------------
let _tagCache = null; // { byName: Map }

function _normalizeTagName(s) {
  return String(s || '').toLowerCase().replace(/["'’`]/g, '').replace(/\s+/g, ' ').trim();
}

async function ensureTagCache() {
  if (_tagCache) return _tagCache;
  _tagCache = { byName: new Map() };
  try {
    // Mangadex tags endpoint is /manga/tag
    const res = await callProxy('/manga/tag');
    const data = res?.data || [];
    _tagCache.tags = data;
    for (const tag of data) {
      const id = tag.id;
      const names = tag.attributes?.name || {};
      // add all localized names
      for (const locale of Object.keys(names)) {
        const val = names[locale];
        if (!val) continue;
        const key = _normalizeTagName(val);
        if (key) _tagCache.byName.set(key, id);
      }
      // also add the english name if present
      const en = names.en;
      if (en) _tagCache.byName.set(_normalizeTagName(en), id);
      // add slug-like and raw name
      if (tag.attributes?.name && typeof tag.attributes.name === 'string') {
        _tagCache.byName.set(_normalizeTagName(tag.attributes.name), id);
      }
    }
  } catch (err) {
    // if tags cannot be fetched, keep cache null-ish but not throw
    console.warn('Could not fetch tag list from Mangadex proxy:', err);
  }
  return _tagCache;
}

async function resolveTagIds(genres = []) {
  if (!genres || !genres.length) return [];
  // If items look like UUIDs already, keep them
  const uuidLike = s => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);

  const cache = await ensureTagCache();
  const ids = [];
  for (const g of genres) {
    if (!g) continue;
    if (uuidLike(g)) { ids.push(g); continue; }
    const key = _normalizeTagName(g);
    let id = cache?.byName.get(key);
    if (!id) {
      // try a loose search: look for any cache key that contains the query
      for (const [k, v] of (cache?.byName || new Map()).entries()) {
        if (k.includes(key) || key.includes(k)) { id = v; break; }
      }
    }
    if (id) ids.push(id);
    else console.warn('Tag not resolved to id:', g);
  }
  return ids;
}

/**
 * Search mangas by title and optional genres filter.
 * @param {string} title - partial or full title
 * @param {Array<string>} genres - array of genre ids or slugs (will be sent as includedTags[])
 * @param {number} page - 1-based page number
 * @param {number} limit - items per page
 */
async function search({ title = '', genres = [], page = 1, limit = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const extra = {
    title: title || undefined,
    limit,
    offset,
  };

  // Mangadex expects includedTags[] as tag IDs — resolve names to ids when needed
  if (Array.isArray(genres) && genres.length) {
    const ids = await resolveTagIds(genres);
    if (ids.length) extra['includedTags[]'] = ids;
    else extra['includedTags[]'] = genres; // fallback (will likely fail)
  }

  return callProxy('/manga', extra, { method: 'GET' });
}

/**
 * Get newest mangas (sorted by creation date desc)
 * @param {number} page
 * @param {number} limit
 */
async function getNewReleases(page = 1, limit = 20) {
  const offset = (Math.max(1, page) - 1) * limit;
  const extra = {
    limit,
    offset,
    // request newest first
    'order[createdAt]': 'desc',
  };
  return callProxy('/manga', extra, { method: 'GET' });
}

/**
 * Get most popular mangas. We use followedCount as a proxy for popularity.
 * @param {number} page
 * @param {number} limit
 */
async function getPopular(page = 1, limit = 20) {
  const offset = (Math.max(1, page) - 1) * limit;
  const extra = {
    limit,
    offset,
    'order[followedCount]': 'desc',
  };
  return callProxy('/manga', extra, { method: 'GET' });
}

async function refreshTagCache() {
  _tagCache = null;
  return ensureTagCache();
}

const MangadexService = {
  search,
  getNewReleases,
  getPopular,
  // low-level call if needed elsewhere
  callProxy,
  // tag helpers
  resolveTagIds,
  refreshTagCache,
  _ensureTagCache: ensureTagCache,
};

// expose for debugging
if (typeof window !== 'undefined') window.MangadexService = MangadexService;

export default MangadexService;
