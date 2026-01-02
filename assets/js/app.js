/* =========================================================
   PAGE ROLE MAP
========================================================= */
const PAGE_ROLES = {
  dashboard: ["Admin"],
  users: ["Admin"],
  categories: ["Admin"],
  products: ["Admin"],
  report: ["Admin"],
  orders: ["Admin", "Karyawan"],
  pos: ["Admin", "Karyawan"],
};

/* =========================================================
   PAGE TITLE MAP
========================================================= */
const PAGE_TITLES = {
  dashboard: "Dashboard",
  users: "Data Karyawan",
  categories: "Data Kategori",
  products: "Data Produk",
  orders: "Data Pesanan",
  pos: "Kasir",
  report: "Laporan",
};

/* =========================================================
   ROLE HELPERS
========================================================= */
function getUserRole() {
  const user = auth.getUser();
  return user ? user.role : null;
}

function isAllowed(page) {
  const role = getUserRole();
  const allowedRoles = PAGE_ROLES[page];
  return role && allowedRoles && allowedRoles.includes(role);
}

/* =========================================================
   LOAD HTML COMPONENT
========================================================= */
async function loadComponent(id, path) {
  const el = document.getElementById(id);
  if (!el) return;

  const res = await fetch(path);
  el.innerHTML = await res.text();
}

/* =========================================================
   API RESPONSE PARSER (COCOK BACKEND KAMU + LARAVEL VALIDATION)
========================================================= */
async function parseApiResponse(res) {
  let json;

  try {
    json = await res.json();
  } catch {
    const err = new Error("Response server tidak valid");
    err.status = res.status;
    throw err;
  }

  // 1) Format custom backend: { status:false, message, errors }
  if (json && json.status === false) {
    const msg =
      json.message ||
      (json.errors ? Object.values(json.errors).flat()[0] : "Terjadi kesalahan");

    const err = new Error(msg);
    err.status = res.status;
    err.errors = json.errors || null;
    throw err;
  }

  // 2) Format Laravel ValidationException: { message, errors }
  if (json && json.errors && typeof json.errors === "object") {
    const firstError = Object.values(json.errors).flat()[0];
    const msg = firstError || json.message || "Validasi gagal";

    const err = new Error(msg);
    err.status = res.status;
    err.errors = json.errors;
    throw err;
  }

  // 3) HTTP error lain (401/403/500) dengan message
  if (!res.ok) {
    const err = new Error((json && json.message) || "Request gagal");
    err.status = res.status;
    throw err;
  }

  return json.data ?? json;
}

/* =========================================================
   FETCH WITH AUTH (SANCTUM)
========================================================= */
async function apiFetch(url, options = {}) {
  const token = auth.getToken();

  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  try {
    return await parseApiResponse(res);
  } catch (err) {
    if (err && err.status === 401) auth.logout();
    throw err;
  }
}

/* =========================================================
   SIDEBAR ROLE ACCESS
========================================================= */
function applySidebarRoleAccess() {
  const user = auth.getUser();
  if (!user || !user.role) return;

  const role = user.role.toLowerCase();

  document.querySelectorAll(".sidebar-item").forEach(item => {
    const roles = (item.dataset.role || "")
      .split(",")
      .map(r => r.trim().toLowerCase())
      .filter(Boolean);

    const allowed = roles.includes(role);

    if (!allowed) {
      item.style.display = "none";   // 🔥 paksa hilang
      item.classList.add("hidden");
    } else {
      item.style.display = "";
      item.classList.remove("hidden");
    }
  });
}


/* =========================================================
   SIDEBAR ACTIVE MENU
========================================================= */
function setActiveMenu(page) {
  document.querySelectorAll(".sidebar-item").forEach(item => {
    item.classList.toggle("active", item.dataset.page === page);
  });
}

/* =========================================================
   NAVBAR TITLE
========================================================= */
function setPageTitle(page) {
  const el = document.getElementById("page-title");
  if (el) el.textContent = PAGE_TITLES[page] || "Dashboard";
}

/* =========================================================
   LOAD PAGE SCRIPT
========================================================= */
function loadPageScript(page) {
  const scripts = {
    dashboard: "./assets/js/dashboard.js",
    users: "./assets/js/users.js",
    categories: "./assets/js/categories.js",
    products: "./assets/js/products.js",
    orders: "./assets/js/orders.js",
    pos: "./assets/js/pos.js",
    invoice: "./assets/js/invoice.js",
    report: "./assets/js/report.js",
  };

  if (!scripts[page]) return;

  const old = document.getElementById("page-script");
  if (old) old.remove();

  const script = document.createElement("script");
  script.id = "page-script";
  script.src = scripts[page];

  script.onload = () => {
    const inits = {
      dashboard: window.initDashboardPage,
      users: window.initUsersPage,
      categories: window.initCategoriesPage,
      products: window.initProductsPage,
      orders: window.initOrdersPage,
      pos: window.initPosPage,
      invoice: window.initInvoicePage,
      report: window.initReportPage,
    };
    if (typeof inits[page] === "function") inits[page]();
  };

  document.body.appendChild(script);
}

/* =========================================================
   LOAD PAGE (SPA CORE)
========================================================= */
async function loadPage(page) {
  if (!isAllowed(page)) {
    alert("Anda tidak memiliki akses ke halaman ini");
    return;
  }

  const welcome = document.getElementById("welcomeState");
  if (welcome) welcome.remove();

  try {
    const res = await fetch(`./pages/${page}.html`);
    if (!res.ok) throw new Error("Halaman tidak ditemukan");

    const content = document.getElementById("content");
    if (content) content.innerHTML = await res.text();

    setActiveMenu(page);
    setPageTitle(page);
    loadPageScript(page);
  } catch (err) {
    const content = document.getElementById("content");
    if (content) content.innerHTML = `<div class="p-6 text-red-600">${err.message}</div>`;
  }
}

/* =========================================================
   GLOBAL CLICK HANDLER
========================================================= */
document.addEventListener("click", e => {
  const menu = e.target.closest("[data-page]");
  if (menu) {
    e.preventDefault();

    const page = menu.dataset.page;

    if (!isAllowed(page)) {
      alert("Anda tidak memiliki akses ke menu ini");
      return;
    }

    loadPage(page);
  }

  if (e.target.closest(".sidebar-item") && window.innerWidth < 1024) {
    document.body.classList.remove("sidebar-open");
  }

  if (e.target.closest("#toggleSidebar")) toggleSidebar();
});


/* =========================================================
   SIDEBAR TOGGLE
========================================================= */
function toggleSidebar() {
  if (window.innerWidth < 1024) {
    document.body.classList.toggle("sidebar-open");
  } else {
    document.body.classList.toggle("sidebar-collapsed");
    localStorage.setItem(
      "sidebar-collapsed",
      document.body.classList.contains("sidebar-collapsed")
    );
  }
}

/* =========================================================
   USER DROPDOWN
========================================================= */
document.addEventListener("click", e => {
  const btn = e.target.closest("#userDropdownBtn");
  const menu = document.getElementById("userDropdownMenu");

  if (btn && menu) menu.classList.toggle("hidden");
  else if (!e.target.closest("#userDropdown")) menu && menu.classList.add("hidden");
});

/* =========================================================
   INIT NAVBAR USER
========================================================= */
function initNavbarUser() {
  const user = auth.getUser();
  if (!user) return;

  const name = user.nama || user.name || user.username || user.email || "User";
  const role = user.role || "Role";

  const initials = String(name)
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatar = document.getElementById("userAvatar");
  const avatarLg = document.getElementById("userAvatarLarge");
  const userName = document.getElementById("userName");
  const userRole = document.getElementById("userRole");

  if (avatar) avatar.textContent = initials;
  if (avatarLg) avatarLg.textContent = initials;
  if (userName) userName.textContent = name;
  if (userRole) userRole.textContent = role;
}

/* =========================================================
   INIT APP (FINAL & CLEAN)
========================================================= */
window.addEventListener("DOMContentLoaded", async () => {
  // Restore sidebar state
  const collapsed = localStorage.getItem("sidebar-collapsed") === "true";
  if (collapsed && window.innerWidth >= 1024) {
    document.body.classList.add("sidebar-collapsed");
  }

  // Auth guard (hanya untuk main.html)
  const isMainPage = !!document.getElementById("content");
  if (isMainPage && !auth.isAuthenticated()) {
    window.location.href = "index.html";
    return;
  }

  if (isMainPage) {
    // Sidebar
    await loadComponent("sidebar", "./layouts/sidebar.html");
    applySidebarRoleAccess();

    // Navbar
    await loadComponent("nav", "./layouts/nav.html");
    initNavbarUser();

    // Welcome state
    const user = auth.getUser();
    const roleEl = document.getElementById("welcomeRole");
    if (roleEl && user) roleEl.textContent = user.role;

    // Default page by role
    const defaultPage =
      user.role === "Karyawan" ? "pos" : "dashboard";

    if (isAllowed(defaultPage)) {
      loadPage(defaultPage);
    } else {
      const fallback = Object.keys(PAGE_ROLES).find(p => isAllowed(p));
      fallback && loadPage(fallback);
    } 
  }
});
