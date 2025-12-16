// ===== admin.stats.js — Статистика для адмін-панелі =====

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Елементи DOM
const periodSelect = document.getElementById('statsPeriod');
const refreshBtn = document.getElementById('statsRefresh');
const statElements = {
  active: document.getElementById('stat-active'),
  registrations: document.getElementById('stat-registrations'),
  reviews: document.getElementById('stat-reviews'),
  comments: document.getElementById('stat-comments'),
  collections: document.getElementById('stat-collections'),
};

// Обчислення діапазону дат
function getDateRange(period) {
  const end = new Date();
  let start = null;

  switch (period) {
    case 'day':
      start = new Date();
      start.setDate(start.getDate() - 1);
      break;
    case 'week':
      start = new Date();
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start = new Date();
      start.setMonth(start.getMonth() - 1);
      break;
    case 'year':
      start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'all':
    default:
      return { start: null, end: null };
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

// Завантаження статистики
async function loadStats() {
  const period = periodSelect.value;
  const { start, end } = getDateRange(period);

  // Показуємо завантаження
  Object.values(statElements).forEach(el => {
    if (el) el.textContent = '⏳';
  });

  try {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    // Завантажуємо всі статистики паралельно
    const [active, registrations, reviews, comments, collections] = await Promise.all([
      fetch(`${API_BASE}/api/Stat/active${queryString}`, {
        headers: { Authorization: `Bearer ${TokenStore.get()}` },
      }).then(r => r.text()),
      fetch(`${API_BASE}/api/Stat/registrations${queryString}`, {
        headers: { Authorization: `Bearer ${TokenStore.get()}` },
      }).then(r => r.text()),
      fetch(`${API_BASE}/api/Stat/reviews${queryString}`, {
        headers: { Authorization: `Bearer ${TokenStore.get()}` },
      }).then(r => r.text()),
      fetch(`${API_BASE}/api/Stat/comments${queryString}`, {
        headers: { Authorization: `Bearer ${TokenStore.get()}` },
      }).then(r => r.text()),
      fetch(`${API_BASE}/api/Stat/collections${queryString}`, {
        headers: { Authorization: `Bearer ${TokenStore.get()}` },
      }).then(r => r.text()),
    ]);

    // Оновлюємо UI
    if (statElements.active) statElements.active.textContent = active || '0';
    if (statElements.registrations) statElements.registrations.textContent = registrations || '0';
    if (statElements.reviews) statElements.reviews.textContent = reviews || '0';
    if (statElements.comments) statElements.comments.textContent = comments || '0';
    if (statElements.collections) statElements.collections.textContent = collections || '0';
  } catch (error) {
    console.error('Помилка завантаження статистики:', error);
    Object.values(statElements).forEach(el => {
      if (el) el.textContent = '❌';
    });
  }
}

// Події
if (periodSelect) {
  periodSelect.addEventListener('change', loadStats);
}
if (refreshBtn) {
  refreshBtn.addEventListener('click', loadStats);
}

// Завантажуємо статистику при запуску
loadStats();
