window.CATEGORY_API =
  window.CATEGORY_API || "http://127.0.0.1:8000/api/kasir/kategori";

/* ===============================
   DOM (DINAMIS)
================================ */
let modal, form, table, title, idEl, namaEl;
let deleteModalCategories, btnCancelDeleteCategories, btnConfirmDeleteCategories;
let deleteId = null;

/* ===============================
   AUTH
================================ */
function authHeader() {
  const t = localStorage.getItem("token");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

/* ===============================
   CACHE DOM
================================ */
function cacheDom() {
  modal = document.getElementById("categoryModal");
  form = document.getElementById("categoryForm");
  table = document.getElementById("categoryTable");
  title = document.getElementById("categoryModalTitle");
  idEl = document.getElementById("categoryId");
  namaEl = document.getElementById("nama_kategori");

  deleteModalCategories = document.getElementById("deleteModalCategories");
  btnCancelDeleteCategories = document.getElementById("cancelDeleteCategories");
  btnConfirmDeleteCategories = document.getElementById("confirmDeleteCategories");
}

/* ===============================
   MODAL HELPERS
================================ */
function openModal() {
  modal?.classList.remove("hidden");
}

function closeModal() {
  modal?.classList.add("hidden");
  resetForm();
}

function openDeleteModalCategories() {
  deleteModalCategories?.classList.remove("hidden");
}

function closeDeleteModalCategories() {
  deleteModalCategories?.classList.add("hidden");
  deleteId = null;
}

/* ===============================
   LOAD DATA
================================ */
async function load() {
  if (!table) return;

  try {
    const r = await fetch(CATEGORY_API, { headers: authHeader() });
    const j = await r.json();

    table.innerHTML = "";
    j.data.forEach((c, i) => {
      table.insertAdjacentHTML(
        "beforeend",
        `
        <tr>
          <td class="px-6 py-4 text-center">${i + 1}</td>
          <td class="px-6 py-4 text-center">${c.nama_kategori}</td>
          <td class="px-6 py-4 text-center space-x-3">
            <div class="inline-flex gap-2">
              <button data-category-edit="${c.id_kategori}" class="hover:bg-sky-600 text-sky-600 border border-sky-600 hover:text-white rounded-lg transition cursor-pointer py-2 px-3">Edit</button>
              <button data-category-delete="${c.id_kategori}" class="hover:bg-red-600 text-red-600 border border-red-600 hover:text-white rounded-lg transition cursor-pointer py-2 px-3">Hapus</button>
            </div>
          </td>
        </tr>`
      );
    });
  } catch {
    toast("Gagal memuat kategori", "error");
  }
}

/* ===============================
   EVENT DELEGATION (ONCE)
================================ */
if (!window.__categoriesEventsBound) {
  window.__categoriesEventsBound = true;

  document.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-category-edit]");
    const delBtn = e.target.closest("[data-category-delete]");

    if (e.target.id === "btnAddCategory") {
      cacheDom();
      resetForm();
      title.textContent = "Tambah Kategori";
      openModal();
      return;
    }

    if (e.target.id === "closeCategoryModal" || e.target === modal) {
      closeModal();
      return;
    }

    if (editBtn) openEdit(editBtn.dataset.edit);

    if (delBtn) {
      deleteId = delBtn.dataset.delete;
      openDeleteModalCategories();
    }

    if (e.target === deleteModalCategories) {
      closeDeleteModalCategories();
    }
  });
}

/* ===============================
   SAVE
================================ */
let saving = false;

function bindFormSubmit() {
  if (!form || form.__bound) return;
  form.__bound = true;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (saving) return;

    const nama = namaEl.value.trim();
    if (!nama) {
      toast("Nama kategori wajib diisi", "warning");
      return;
    }

    const id = idEl.value;
    const url = id ? `${CATEGORY_API}/${id}` : CATEGORY_API;
    const method = id ? "PUT" : "POST";

    saving = true;

    try {
      const r = await fetch(url, {
        method,
        headers: authHeader(),
        body: JSON.stringify({ nama_kategori: nama }),
      });

      const j = await r.json();
      if (!j.status) throw new Error(j.message);

      toast("Kategori berhasil disimpan", "success");
      closeModal();
      load();
    } catch (err) {
      toast(err.message || "Gagal menyimpan", "error");
    } finally {
      saving = false;
    }
  });
}

/* ===============================
   EDIT
================================ */
async function openEdit(id) {
  try {
    const r = await fetch(`${CATEGORY_API}/${id}`, { headers: authHeader() });
    const j = await r.json();

    if (!j.status) throw new Error(j.message);

    idEl.value = j.data.id_kategori;
    namaEl.value = j.data.nama_kategori;

    title.textContent = "Edit Kategori";
    openModal();
  } catch (err) {
    toast(err.message || "Gagal mengambil data", "error");
  }
}

/* ===============================
   DELETE MODAL ACTION
================================ */
function bindDeleteModal() {
  if (!btnCancelDeleteCategories || btnCancelDeleteCategories.__bound) return;
  btnCancelDeleteCategories.__bound = true;

  btnCancelDeleteCategories.addEventListener("click", closeDeleteModalCategories);

  btnConfirmDeleteCategories.addEventListener("click", async () => {
    if (!deleteId) return;

    try {
      const r = await fetch(`${CATEGORY_API}/${deleteId}`, {
        method: "DELETE",
        headers: authHeader(),
      });

      const j = await r.json();
      if (!j.status) throw new Error(j.message);

      toast("Kategori berhasil dihapus", "success");
      closeDeleteModalCategories();
      load();
    } catch (err) {
      toast(err.message || "Gagal menghapus", "error");
    }
  });
}

/* ===============================
   UTIL
================================ */
function resetForm() {
  form?.reset();
  if (idEl) idEl.value = "";
}

/* ===============================
   INIT PAGE
================================ */
window.initCategoriesPage = function () {
  cacheDom();
  bindFormSubmit();
  bindDeleteModal();
  load();
};
