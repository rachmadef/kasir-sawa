(() => {
  if (window.__usersPageLoaded) return;
  window.__usersPageLoaded = true;

  window.USERS_API =
    window.USERS_API || "http://127.0.0.1:8000/api/kasir/karyawan";

  let allUsers = [];
  let deleteUserId = null;
  let perPage = 10;               // default show entries
  let currentUsersView = [];      // data hasil filter/search (atau full)

  /* =========================================================
    DOM ELEMENTS (AMBIL SEKALI, GLOBAL SCOPE)
  ========================================================= */
  let userForm,
    userId,
    nama,
    email,
    password,
    statusEl,
    noTelpEl,
    userModal,
    modalTitle,
    deleteModal,
    detailModal,
    detailContent,
    pageSizeEl;

  function cacheDom() {
    userForm = document.getElementById("userForm");
    userId = document.getElementById("userId");
    nama = document.getElementById("nama");
    email = document.getElementById("email");
    password = document.getElementById("password");
    statusEl = document.getElementById("status");
    noTelpEl = document.getElementById("no_telp");

    userModal = document.getElementById("userModal");
    modalTitle = document.getElementById("modalTitle");
    deleteModal = document.getElementById("deleteModal");
    detailModal = document.getElementById("detailModal");
    detailContent = document.getElementById("detailContent");
    pageSizeEl = document.getElementById("userPageSize");

  }

  /* =========================================================
    AUTH FETCH (SANCTUM)
  ========================================================= */
  function authFetch(url, options = {}) {
    const token = localStorage.getItem("token");

    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  }

  /* =========================================================
    INIT PAGE (dipanggil dari app.js)
  ========================================================= */
  window.initUsersPage = function () {
    cacheDom();
    loadUsers();
  };

  /* =========================================================
    PARSE API RESPONSE (AMAN SEMUA CASE)
  ========================================================= */
  async function parseApiResponse(res) {
    const text = await res.text();
    let json;

    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Response API bukan JSON valid");
    }
    if (res.status === 404) {
      throw new Error("Karyawan tidak ditemukan");
    }
    // Case 1: standar { status, message, data }
    if (json.status !== undefined) {
      if (!res.ok || json.status === false) {
        throw new Error(json.message || "Request gagal");
      }
      return json.data ?? json;
    }
    // Case 2: langsung model (show)
    if (!res.ok) {
      throw new Error("Request gagal");
    }

    return json;
  }

  /* =========================================================
    LOAD USERS
  ========================================================= */
  async function loadUsers() {
    try {
      const res = await authFetch(USERS_API);
      const data = await parseApiResponse(res);

      allUsers = Array.isArray(data) ? data : [];
      currentUsersView = [...allUsers];
      if (pageSizeEl) {
        perPage = parseInt(pageSizeEl.value, 10) || perPage;
      }
      refreshTable();
      updateSummaryCards(currentUsersView);
    } catch (err) {
      allUsers = [];
      currentUsersView = [];
      renderUsers([]);
      updateSummaryCards([]);
      showToast(err.message, "error");
    }
  }

  /* =========================================================
    SEARCH REALTIME
  ========================================================= */
  document.addEventListener("input", (e) => {
    if (e.target.id !== "searchUser") return;

    const keyword = e.target.value.toLowerCase();
    const safe = (v) => (v || "").toLowerCase();

    currentUsersView = allUsers.filter(
      (u) =>
        safe(u.nama).includes(keyword) ||
        safe(u.email).includes(keyword) ||
        safe(u.role).includes(keyword) ||
        safe(u.status).includes(keyword)
    );

    refreshTable();
    updateSummaryCards(currentUsersView);
  });
  document.addEventListener("change", (e) => {
    if (e.target.id !== "userPageSize") return;

    perPage = parseInt(e.target.value, 10) || 10;
    refreshTable();
  });

  /* =========================================================
    TOAST
  ========================================================= */
  function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const icons = {
      success: "✔",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };

    const titles = {
      success: "Berhasil",
      error: "Terjadi Kesalahan",
      warning: "Perhatian",
      info: "Informasi",
    };

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="flex-1">
        <p class="toast-title">${titles[type]}</p>
        <p class="toast-message">${message}</p>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-x-6");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  function applyPerPage(users) {
    return users.slice(0, perPage);
  }

  function refreshTable() {
    // render hanya sejumlah perPage dari data view saat ini
    renderUsers(applyPerPage(currentUsersView));
  }

  /* =========================================================
    RENDER TABLE
  ========================================================= */
  function renderUsers(users) {
    const tbody = document.getElementById("userTable");
    tbody.innerHTML = "";

    if (!users.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-6 text-center text-gray-500">
            Data karyawan belum tersedia
          </td>
        </tr>
      `;
      return;
    }

    users.forEach((user) => {
      const roleClass =
        user.role === "Admin"
          ? "bg-indigo-100 text-indigo-700"
          : "bg-sky-100 text-sky-700";

      const statusClass =
        user.status === "Aktif"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-yellow-100 text-yellow-700";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-6 py-4 text-center">${user.nama}</td>
        <td class="px-6 py-4 text-center">${user.email}</td>
        <td class="px-6 py-4 text-center">
          <span class="px-2 py-1 rounded-full text-xs ${roleClass}">
            ${user.role}
          </span>
        </td>
        <td class="px-6 py-4 text-center">
          <span class="px-2 py-1 rounded-full text-xs ${statusClass}">
            ${user.status}
          </span>
        </td>
        <td class="px-6 py-4 text-center">
          <div class="inline-flex gap-2">
            <button data-users-detail="${user.id_user}" class="action-text action-info hover:bg-emerald-600 text-emerald-600 border border-emerald-600 hover:text-white rounded-lg transition cursor-pointer py-2 px-3 m-1">Detail</button>
            <button data-users-edit="${user.id_user}" class="action-text action-edit hover:bg-sky-600 text-sky-600 border border-sky-600 hover:text-white rounded-lg transition cursor-pointer py-2 px-3 m-1">Edit</button>
            <button data-users-delete="${user.id_user}" class="action-text action-delete hover:bg-red-600 text-red-600 border border-red-600 hover:text-white rounded-lg transition cursor-pointer py-2 px-3 m-1">Hapus</button>
          </div>
        </td>

      `;
      tbody.appendChild(tr);
    });
  }

  /* =========================================================
    SUMMARY CARDS
  ========================================================= */
  function updateSummaryCards(users) {
    document.getElementById("totalUser").innerText = users.length;
    document.getElementById("totalActive").innerText = users.filter(
      (u) => u.status === "Aktif"
    ).length;
    document.getElementById("totalInactive").innerText = users.filter(
      (u) => u.status !== "Aktif"
    ).length;
  }

  /* =========================================================
    SUBMIT FORM (ADD / EDIT)
  ========================================================= */
  document.addEventListener("submit", async (e) => {
    if (e.target !== userForm) return;
    e.preventDefault();

    const id = userId.value;

    const payload = {
      nama: nama.value,
      email: email.value,
      no_telp: noTelpEl.value,
      status: statusEl.value,
    };

    if (password.value) payload.password = password.value;

    try {
      const res = await authFetch(id ? `${USERS_API}/${id}` : USERS_API, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      await parseApiResponse(res);

      showToast(
        id ? "Karyawan berhasil diperbarui" : "Karyawan berhasil ditambahkan",
        "success"
      );

      closeUserModal();
      loadUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  });


  /* =========================================================
    EVENT DELEGATION
  ========================================================= */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(
      "#btnAddUser, #closeUserModal, #closeDetailModal, #cancelDelete, #confirmDelete, [data-users-edit], [data-users-delete], [data-users-detail]"
    );

    if (!btn) return;

    if (btn.id === "btnAddUser") openAddModal();
    if (btn.id === "closeUserModal") closeUserModal();
    if (btn.id === "closeDetailModal") closeDetailModal();
    if (btn.id === "cancelDelete") closeDeleteModal();
    if (btn.id === "confirmDelete") deleteUserConfirmed();

    if (btn.dataset.usersEdit) openEditModal(btn.dataset.usersEdit);
    if (btn.dataset.usersDelete) openDeleteModal(btn.dataset.usersDelete);
    if (btn.dataset.usersDetail) showDetail(btn.dataset.usersDetail);

  });

  /* =========================================================
    ADD / EDIT MODAL
  ========================================================= */
  function openAddModal() {
    userForm.reset();
    userId.value = "";
    statusEl.value = "Aktif"; // default
    modalTitle.innerText = "Tambah Karyawan";
    userModal.classList.remove("hidden");
  }

  function closeUserModal() {
    userModal.classList.add("hidden");
  }

  async function openEditModal(id) {
    try {
      const res = await authFetch(`${USERS_API}/${id}`);
      const user = await parseApiResponse(res);

      userId.value = user.id_user;
      nama.value = user.nama;
      email.value = user.email;
      password.value = "";
      statusEl.value = user.status;
      noTelpEl.value = user.no_telp ?? "";

      modalTitle.innerText = "Edit Karyawan";
      userModal.classList.remove("hidden");
    } catch (err) {
      showToast(err.message, "error");
    }
  }


  /* =========================================================
    DELETE
  ========================================================= */
  function openDeleteModal(id) {
    deleteUserId = id;
    deleteModal.classList.remove("hidden");
  }

  function closeDeleteModal() {
    deleteModal.classList.add("hidden");
    deleteUserId = null;
  }

  async function deleteUserConfirmed() {
    if (!deleteUserId) return;

    try {
      const res = await authFetch(`${USERS_API}/${deleteUserId}`, {
        method: "DELETE",
      });

      await parseApiResponse(res);

      showToast("Karyawan berhasil dihapus", "success");
      closeDeleteModal();
      loadUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  /* =========================================================
    DETAIL
  ========================================================= */
  async function showDetail(id) {
    try {
      const res = await authFetch(`${USERS_API}/${id}`);
      const user = await parseApiResponse(res);

      detailContent.innerHTML = `
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
            </svg>
          </div>
          <div>
            <p class="text-base font-semibold text-gray-900">${user.nama}</p>
            <p class="text-sm text-gray-500">${user.email}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 pt-4">
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">Role</p>
            <p class="font-medium">${user.role}</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">Status</p>
            <p class="font-medium">${user.status}</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3 col-span-2">
            <p class="text-xs text-gray-500">No. Telepon</p>
            <p class="font-medium">${user.no_telp ?? "-"}</p>
          </div>
        </div>
      `;

      detailModal.classList.remove("hidden");
    } catch (err) {
      showToast(err.message, "error");
    }
  }


  function closeDetailModal() {
    detailModal.classList.add("hidden");
  }
})();