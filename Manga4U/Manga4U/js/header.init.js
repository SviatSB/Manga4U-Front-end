document.addEventListener("DOMContentLoaded", async () => {
  const API_BASE = "https://manga4u-164617ec4bac.herokuapp.com";
  const profileBtn = document.getElementById("profileBtn");
  const profileMenu = document.getElementById("profileMenu");
  const logoutBtn = document.getElementById("logoutBtn");
  const loginLink = document.getElementById("loginLink");
  const profileBlock = document.getElementById("profileBlock");
  const profileName = document.getElementById("profileName");
  const roleBadge = document.getElementById("roleBadge");
  const burger = document.querySelector(".burger");
  const mobileMenu = document.getElementById("mobileMenu");

  // 👇 ці елементи можуть зʼявитись пізніше
  const getMobileLoginLink = () => document.getElementById("mobileLoginLink");
  const getMobileProfileLink = () => document.getElementById("mobileProfileLink");
  const getMobileLogoutBtn = () => document.getElementById("mobileLogoutBtn");

  const token = localStorage.getItem("m4u_token") || sessionStorage.getItem("m4u_token");

  if (!token) {
    showLoggedOut();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/Account/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Unauthorized");

    const me = await res.json();
    if (!me || !me.nickname) {
      showLoggedOut();
      return;
    }

    // 🟢 користувач авторизований
    if (profileName) profileName.textContent = me.nickname;
    if (profileBlock) profileBlock.hidden = false;

    // 👇 Надійно ховаємо всі кнопки "Увійти"
    hideLoginButtons();

    // 🛡️ Перевірка ролей
    const roles = (me.roles || []).map(r => r.toLowerCase());
    if (roles.includes("admin") || roles.includes("owner")) {
      if (roleBadge) {
        roleBadge.hidden = false;
        roleBadge.textContent = roles.includes("owner") ? "Owner" : "Admin";
      }
      const adminLink = document.querySelector(".profile__item--admin");
      const mobileAdmin = document.querySelector(".mobileMenu__link--admin");
      if (adminLink) adminLink.hidden = false;
      if (mobileAdmin) mobileAdmin.hidden = false;
    } else {
      if (roleBadge) roleBadge.hidden = true;
    }

    // 📱 мобільне меню
    const mLogin = getMobileLoginLink();
    const mProfile = getMobileProfileLink();
    const mLogout = getMobileLogoutBtn();
    if (mLogin) mLogin.hidden = true;
    if (mProfile) mProfile.hidden = false;
    if (mLogout) mLogout.hidden = false;

    // ⚙️ дроп-меню профілю
    if (profileBtn && profileMenu) {
      profileBtn.addEventListener("click", e => {
        e.stopPropagation();
        profileMenu.hidden = !profileMenu.hidden;
        profileBtn.classList.toggle("active");
      });

      document.addEventListener("click", e => {
        if (!profileMenu.hidden && !e.target.closest("#profileMenu") && !e.target.closest("#profileBtn")) {
          profileMenu.hidden = true;
          profileBtn.classList.remove("active");
        }
      });
    }

    // 🚪 вихід
    if (logoutBtn) logoutBtn.addEventListener("click", logout);
    if (mLogout) mLogout.addEventListener("click", logout);

    // 🕒 На випадок, якщо DOM оновився — повторно ховаємо “Увійти”
    setTimeout(hideLoginButtons, 500);

  } catch (err) {
    console.error("Header init error:", err);
    showLoggedOut();
  }

  // 🍔 бургер
  if (burger && mobileMenu) {
    burger.addEventListener("click", () => {
      const expanded = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", !expanded);
      mobileMenu.classList.toggle("open", !expanded);
      mobileMenu.setAttribute("aria-hidden", expanded);
    });
  }

  // 💡 Хелпери
  function hideLoginButtons() {
    document.querySelectorAll('#loginLink, #mobileLoginLink, a[href*="auth"]').forEach(el => {
      el.hidden = true;
      el.style.display = "none";
    });
  }

  function showLoggedOut() {
    if (loginLink) loginLink.hidden = false;
    if (profileBlock) profileBlock.hidden = true;

    const mLogin = getMobileLoginLink();
    const mProfile = getMobileProfileLink();
    const mLogout = getMobileLogoutBtn();

    if (mLogin) mLogin.hidden = false;
    if (mProfile) mProfile.hidden = true;
    if (mLogout) mLogout.hidden = true;
  }

  function logout() {
    localStorage.removeItem("m4u_token");
    sessionStorage.removeItem("m4u_token");
    localStorage.removeItem("m4u_login");
    window.location.href = "../auth.html";
  }
});
