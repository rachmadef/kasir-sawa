
(() => {
  // Hindari redeclare saat script di-load ulang oleh SPA
  if (window.__productsPageModuleLoaded) return;
  window.__productsPageModuleLoaded = true;

  /* =========================
     CONFIG
  ========================= */
  window.PRODUCT_API =
    window.PRODUCT_API || "http://127.0.0.1:8000/api/kasir/produk";
  window.CATEGORY_API =
    window.CATEGORY_API || "http://127.0.0.1:8000/api/kasir/kategori";

  /* =========================
     STATE (NAMESPACE)
  ========================= */
  window.ProductsPage = window.ProductsPage || {};
  const S = window.ProductsPage;

  Object.assign(S, {
    // data
    deleteId: null,
    allProducts: [],
    filteredProducts: [],
    categories: [],

    // ui state
    currentPage: 1,
    pageSize: 10,
    sortKey: "nama_produk",
    sortDir: "asc",

    // dom refs (diisi ulang setiap init)
    dom: {},
  });

  /* =========================
     AUTH HEADER (LOCAL)
  ========================= */
  function authHeader(extra = {}) {
    const t = localStorage.getItem("token");
    return {
      Accept: "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...extra,
    };
  }
  function formatRupiah(value) {
    if (value === null || value === undefined || value === "") return "-";

    const number = Number(value);
    if (Number.isNaN(number)) return value;

    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  }

  /* =========================
     UTIL
  ========================= */
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureToast(msg, type = "info") {
    // pakai toast global kalau ada
    if (typeof window.toast === "function") return window.toast(msg, type);
    // fallback
    console[type === "error" ? "error" : "log"](msg);
    alert(msg);
  }
  /* =========================
    IMAGE PREVIEW HELPERS
  ========================= */
  function resetImagePreview() {
    const d = S.dom;
    if (!d.imgPreview) return;

    d.imgPreview.src = "";
    d.imgPreview.classList.add("hidden");
    d.btnRemoveImage?.classList.add("hidden");
    d.imageLabel?.classList.add("hidden");

    // reset input file
    if (d.gambarEl) d.gambarEl.value = "";
  }

  function showImagePreview(src) {
    const d = S.dom;
    if (!d.imgPreview) return;

    d.imgPreview.src = src;
    d.imgPreview.classList.remove("hidden");
    d.btnRemoveImage?.classList.remove("hidden");
    d.imageLabel?.classList.remove("hidden");
  }

  /* =========================
     DOM CACHE (DIPANGGIL SETIAP MASUK PAGE)
  ========================= */
  function cacheDomProducts() {
    const dom = {};

    dom.productModal = document.getElementById("productModal");
    dom.productModalTitle = document.getElementById("productModalTitle");
    dom.productForm = document.getElementById("productForm");

    dom.productIdEl = document.getElementById("productId");
    dom.namaProdukEl = document.getElementById("nama_produk");
    dom.idKategoriEl = document.getElementById("id_kategori");
    dom.hargaEl = document.getElementById("harga");
    dom.stokEl = document.getElementById("stok");
    dom.deskripsiEl = document.getElementById("deskripsi");
    dom.gambarEl = document.getElementById("gambar_produk");
    dom.imgPreview = document.getElementById("imgPreview");
    dom.btnRemoveImage = document.getElementById("btnRemoveImage");
    dom.imageLabel = document.getElementById("imageLabel");

    dom.tbody = document.getElementById("productTbody");
    dom.noProductFound = document.getElementById("noProductFound");

    dom.productSearch = document.getElementById("productSearch");
    dom.sortSelect = document.getElementById("sortSelect");
    dom.pageSizeEl = document.getElementById("pageSize");
    dom.categoryFilter = document.getElementById("categoryFilter");

    dom.pageInfo = document.getElementById("pageInfo");
    dom.btnPrevPage = document.getElementById("btnPrevPage");
    dom.btnNextPage = document.getElementById("btnNextPage");
    dom.pageNumbers = document.getElementById("pageNumbers");

    // DELETE MODAL (versi Products)
    dom.deleteModal = document.getElementById("deleteModalProducts");
    dom.btnCancelDelete = document.getElementById("cancelDeleteProducts");
    dom.btnConfirmDelete = document.getElementById("confirmDeleteProducts");

    // close/open modal buttons (opsional)
    dom.btnAddProduct = document.getElementById("btnAddProduct");
    dom.btnCloseProductModal = document.getElementById("closeProductModal");
    dom.btnCancelProduct = document.getElementById("btnCancelProduct");

    S.dom = dom;

    // sync pageSize dari select (jika ada)
    S.pageSize = Number(dom.pageSizeEl?.value || S.pageSize || 10);
  }

  /* =========================
     MODAL HELPERS
  ========================= */
  function openProductModal() {
    const { productModal } = S.dom;
    if (!productModal) return;
    productModal.classList.remove("hidden");
  }

  function closeProductModal() {
    const { productModal } = S.dom;
    if (!productModal) return;
    productModal.classList.add("hidden");
    productModal.classList.remove("flex");
  }

  function resetProductForm() {
    const d = S.dom;
    d.productForm?.reset();
    if (d.productIdEl) d.productIdEl.value = "";
    if (d.productModalTitle) d.productModalTitle.textContent = "Tambah Produk";
    resetImagePreview();
  }

  /* =========================
     DELETE MODAL HELPERS
  ========================= */
  function openDeleteModalProduct(id) {
    S.deleteId = id;
    S.dom.deleteModal?.classList.remove("hidden");
  }

  function closeDeleteModalProduct() {
    S.dom.deleteModal?.classList.add("hidden");
    S.deleteId = null;
  }

  /* =========================
     LOAD CATEGORIES
  ========================= */
  async function loadCategories() {
    try {
      const res = await fetch(window.CATEGORY_API, { headers: authHeader() });
      const json = await res.json();

      if (!res.ok || !json?.status)
        throw new Error(json?.message || "Gagal memuat kategori");

      S.categories = Array.isArray(json.data) ? json.data : [];
      renderCategoryOptions();
    } catch (err) {
      ensureToast(err.message || "Gagal memuat kategori", "error");
    }
  }

  function renderCategoryOptions() {
    const { idKategoriEl, categoryFilter } = S.dom;
    if (!idKategoriEl || !categoryFilter) return;

    const keepModalVal = idKategoriEl.value;

    idKategoriEl.innerHTML = `<option value="">Pilih Kategori</option>`;
    categoryFilter.innerHTML = `<option value="">Semua Kategori</option>`;

    S.categories.forEach((k) => {
      const opt1 = document.createElement("option");
      opt1.value = String(k.id_kategori);
      opt1.textContent = k.nama_kategori;
      idKategoriEl.appendChild(opt1);

      const opt2 = opt1.cloneNode(true);
      categoryFilter.appendChild(opt2);
    });

    if (keepModalVal) idKategoriEl.value = keepModalVal;
  }

  /* =========================
     LOAD PRODUCTS
  ========================= */
  async function loadProducts() {
    try {
      const res = await fetch(window.PRODUCT_API, { headers: authHeader() });
      const json = await res.json();

      if (!res.ok || !json?.status)
        throw new Error(json?.message || "Gagal memuat produk");

      S.allProducts = Array.isArray(json.data) ? json.data : [];
      applyFilterSortPaginate(true);
    } catch (err) {
      ensureToast(err.message || "Gagal memuat produk", "error");
    }
  }

  /* =========================
     FILTER + SORT + PAGINATION
  ========================= */
  function applyFilterSortPaginate(reset = false) {
    const { productSearch, categoryFilter } = S.dom;
    if (!productSearch || !categoryFilter) return;

    if (reset) S.currentPage = 1;

    const keyword = (productSearch.value || "").toLowerCase();
    const category = categoryFilter.value || "";

    S.filteredProducts = S.allProducts.filter((p) => {
      if (category && String(p.id_kategori) !== String(category)) return false;

      const nama = String(p.nama_produk || "").toLowerCase();
      const kat = String(p.kategori?.nama_kategori || "").toLowerCase();
      return nama.includes(keyword) || kat.includes(keyword);
    });

    sortProducts();
    renderProducts();
    renderPagination();
  }

  function sortProducts() {
    const dir = S.sortDir === "asc" ? 1 : -1;

    S.filteredProducts.sort((a, b) => {
      let va, vb;

      if (S.sortKey === "kategori") {
        va = a.kategori?.nama_kategori || "";
        vb = b.kategori?.nama_kategori || "";
        return String(va).localeCompare(String(vb), "id") * dir;
      }

      va = a?.[S.sortKey];
      vb = b?.[S.sortKey];

      // angka
      if (
        S.sortKey === "harga" ||
        S.sortKey === "stok" ||
        S.sortKey === "id_produk"
      ) {
        return (Number(va || 0) - Number(vb || 0)) * dir;
      }

      // string
      return String(va || "").localeCompare(String(vb || ""), "id") * dir;
    });

    updateSortIndicators();
  }

  function updateSortIndicators() {
    const map = {
      nama_produk: "sortIndicatorNama",
      kategori: "sortIndicatorKategori",
      harga: "sortIndicatorHarga",
      stok: "sortIndicatorStok",
    };

    Object.values(map).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "";
    });

    const el = document.getElementById(map[S.sortKey]);
    if (el) el.textContent = S.sortDir === "asc" ? "▲" : "▼";
  }

  function renderProducts() {
    const { tbody, noProductFound, pageInfo } = S.dom;
    if (!tbody || !noProductFound || !pageInfo) return;

    tbody.innerHTML = "";
    noProductFound.classList.toggle("hidden", S.filteredProducts.length !== 0);

    const start = (S.currentPage - 1) * S.pageSize;
    const end = start + S.pageSize;

    S.filteredProducts.slice(start, end).forEach((p) => {
      const img = p.gambar_produk
        ? `http://127.0.0.1:8000/storage/${p.gambar_produk}`
        : "./assets/images/no-image.png";
      tbody.insertAdjacentHTML(
        "beforeend",
        `
        <tr>
          <td class="px-6 py-4">
            <img src="${img}" class="w-12 h-12 rounded-lg object-cover border" alt="foto produk">
          </td>
          <td class="px-6 py-4">${escapeHtml(p.nama_produk)}</td>
          <td class="px-6 py-4">${escapeHtml(
            p.kategori?.nama_kategori || "-"
          )}</td>
          <td class="px-6 py-4">${formatRupiah(p.harga)}</td>
          <td class="px-6 py-4">${escapeHtml(p.stok)}</td>
          <td class="px-6 py-4 text-center">
            <div class="inline-flex gap-2">
              <button data-action="edit" data-id="${escapeHtml(
                p.id_produk
              )}" class="hover:bg-sky-600 text-sky-600 border border-sky-600 hover:text-white rounded-lg transition cursor-pointer py-2 px-3">Edit</button>
              <button data-action="delete" data-id="${escapeHtml(
                p.id_produk
              )}" class="hover:bg-red-600 text-red-600 border border-red-600 hover:text-white rounded-lg transition cursor-pointer py-2 px-3">Hapus</button>
            </div>
          </td>
        </tr>
        `
      );
    });

    const total = S.filteredProducts.length;
    const from = total === 0 ? 0 : start + 1;
    const to = Math.min(end, total);
    pageInfo.textContent = `Menampilkan ${from}-${to} dari ${total}`;
  }

  function renderPagination() {
    const { btnPrevPage, btnNextPage, pageNumbers } = S.dom;
    if (!btnPrevPage || !btnNextPage || !pageNumbers) return;

    const totalPages = Math.max(
      1,
      Math.ceil(S.filteredProducts.length / S.pageSize)
    );

    btnPrevPage.disabled = S.currentPage <= 1;
    btnNextPage.disabled = S.currentPage >= totalPages;

    pageNumbers.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement("button");
      btn.textContent = String(i);
      btn.className = `px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg border border-indigo-600 text-sm ${
        i === S.currentPage ? "bg-white" : "hover:text-white cursor-pointer"
      }`;
      btn.disabled = i === S.currentPage;

      btn.addEventListener("click", () => {
        S.currentPage = i;
        renderProducts();
        renderPagination();
      });

      pageNumbers.appendChild(btn);
    }
  }

  /* =========================
     DELETE CONFIRM
  ========================= */
  async function confirmDeleteProduct() {
    if (!S.deleteId) return;

    try {
      const res = await fetch(`${window.PRODUCT_API}/${S.deleteId}`, {
        method: "DELETE",
        headers: authHeader({ "Content-Type": "application/json" }),
      });
      const json = await res.json();

      if (!res.ok || !json?.status)
        throw new Error(json?.message || "Gagal menghapus produk");

      ensureToast("Produk berhasil dihapus", "success");
      closeDeleteModalProduct();
      await loadProducts();
    } catch (err) {
      ensureToast(err.message || "Gagal menghapus produk", "error");
    }
  }

  /* =========================
     EDIT
  ========================= */
  function openEdit(id) {
    const d = S.dom;
    const p = S.allProducts.find((x) => String(x.id_produk) === String(id));

    if (!p) return ensureToast("Produk tidak ditemukan", "error");

    d.productModalTitle.textContent = "Edit Produk";
    d.productIdEl.value = p.id_produk;
    d.namaProdukEl.value = p.nama_produk || "";
    d.idKategoriEl.value = p.id_kategori || "";
    d.hargaEl.value = p.harga ?? 0;
    d.stokEl.value = p.stok ?? 0;
    d.deskripsiEl.value = p.deskripsi || "";
    // preview gambar existing (edit)
    if (p.gambar_produk) {
      showImagePreview(
        `http://127.0.0.1:8000/storage/${p.gambar_produk}`
      );
    } else {
      resetImagePreview();
    }
    openProductModal();
  }

  /* =========================
     BIND EVENTS (DOM-SCOPED, DIPANGGIL SETIAP INIT)
  ========================= */
  function bindDomEventsProducts() {
    const d = S.dom;

    // tombol modal close (optional)
    if (d.btnCloseProductModal && !d.btnCloseProductModal.__bound) {
      d.btnCloseProductModal.__bound = true;
      d.btnCloseProductModal.addEventListener("click", closeProductModal);
    }
    if (d.btnCancelProduct && !d.btnCancelProduct.__bound) {
      d.btnCancelProduct.__bound = true;
      d.btnCancelProduct.addEventListener("click", closeProductModal);
    }

    // backdrop click modal produk
    if (d.productModal && !d.productModal.__boundBackdrop) {
      d.productModal.__boundBackdrop = true;
      d.productModal.addEventListener("click", (e) => {
        if (e.target === d.productModal) closeProductModal();
      });
    }

    // delete modal buttons
    if (d.btnCancelDelete && !d.btnCancelDelete.__bound) {
      d.btnCancelDelete.__bound = true;
      d.btnCancelDelete.addEventListener("click", closeDeleteModalProduct);
    }
    if (d.btnConfirmDelete && !d.btnConfirmDelete.__bound) {
      d.btnConfirmDelete.__bound = true;
      d.btnConfirmDelete.addEventListener("click", confirmDeleteProduct);
    }

    // search/filter/sort/pageSize
    if (d.productSearch && !d.productSearch.__bound) {
      d.productSearch.__bound = true;
      d.productSearch.addEventListener("input", () =>
        applyFilterSortPaginate(true)
      );
    }
    if (d.categoryFilter && !d.categoryFilter.__bound) {
      d.categoryFilter.__bound = true;
      d.categoryFilter.addEventListener("change", () =>
        applyFilterSortPaginate(true)
      );
    }
    if (d.pageSizeEl && !d.pageSizeEl.__bound) {
      d.pageSizeEl.__bound = true;
      d.pageSizeEl.addEventListener("change", () => {
        S.pageSize = Number(d.pageSizeEl.value || 10);
        applyFilterSortPaginate(true);
      });
    }
    if (d.sortSelect && !d.sortSelect.__bound) {
      d.sortSelect.__bound = true;
      d.sortSelect.addEventListener("change", () => {
        const [k, dir] = String(d.sortSelect.value || "nama_produk:asc").split(
          ":"
        );
        S.sortKey = k || "nama_produk";
        S.sortDir = dir || "asc";
        applyFilterSortPaginate(true);
      });
    }

    // prev/next
    if (d.btnPrevPage && !d.btnPrevPage.__bound) {
      d.btnPrevPage.__bound = true;
      d.btnPrevPage.addEventListener("click", () => {
        S.currentPage = Math.max(1, S.currentPage - 1);
        renderProducts();
        renderPagination();
      });
    }
    if (d.btnNextPage && !d.btnNextPage.__bound) {
      d.btnNextPage.__bound = true;
      d.btnNextPage.addEventListener("click", () => {
        const totalPages = Math.max(
          1,
          Math.ceil(S.filteredProducts.length / S.pageSize)
        );
        S.currentPage = Math.min(totalPages, S.currentPage + 1);
        renderProducts();
        renderPagination();
      });
    }

    // delete modal backdrop click
    if (d.deleteModal && !d.deleteModal.__boundBackdrop) {
      d.deleteModal.__boundBackdrop = true;
      d.deleteModal.addEventListener("click", (e) => {
        if (e.target === d.deleteModal) closeDeleteModalProduct();
      });
    }
    // preview gambar saat pilih file
    if (d.gambarEl && !d.gambarEl.__boundPreview) {
      d.gambarEl.__boundPreview = true;
      d.gambarEl.addEventListener("change", () => {
        const file = d.gambarEl.files?.[0];
        if (!file) {
          resetImagePreview();
          return;
        }

        if (!file.type.startsWith("image/")) {
          ensureToast("File harus berupa gambar", "error");
          resetImagePreview();
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => showImagePreview(e.target.result);
        reader.readAsDataURL(file);
      });
    }
    if (d.btnRemoveImage && !d.btnRemoveImage.__bound) {
      d.btnRemoveImage.__bound = true;
      d.btnRemoveImage.addEventListener("click", () => {
        resetImagePreview();
      });
    }

    // submit form produk
    if (d.productForm && !d.productForm.__boundSubmit) {
      d.productForm.__boundSubmit = true;
      d.productForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // ⛔ STOP reload halaman

        const isEdit = Boolean(d.productIdEl.value);
        const url = isEdit
          ? `${window.PRODUCT_API}/${d.productIdEl.value}`
          : window.PRODUCT_API;

        const method = isEdit ? "PUT" : "POST";

        try {
          const formData = new FormData(d.productForm);

          // Laravel PUT perlu _method jika via FormData
          if (isEdit) formData.append("_method", "PUT");

          const res = await fetch(url, {
            method: "POST", // tetap POST untuk FormData
            headers: authHeader(), // JANGAN set Content-Type
            body: formData,
          });

          const json = await res.json();

          if (!res.ok || !json?.status) {
            throw new Error(json?.message || "Gagal menyimpan produk");
          }

          ensureToast(
            isEdit
              ? "Produk berhasil diperbarui"
              : "Produk berhasil ditambahkan",
            "success"
          );

          closeProductModal();
          await loadProducts();
        } catch (err) {
          ensureToast(err.message || "Gagal menyimpan produk", "error");
        }
      });
    }
  }

  /* =========================
     EVENT DELEGATION (GLOBAL, HANYA SEKALI)
  ========================= */
  if (!window.__productsEventsDelegationBound) {
    window.__productsEventsDelegationBound = true;

    document.addEventListener("click", (e) => {
      // Add product
      if (e.target?.id === "btnAddProduct") {
        cacheDomProducts(); // pastikan dom terbaru
        resetProductForm();
        openProductModal();
        return;
      }

      // table action buttons
      const action = e.target?.dataset?.action;
      const id = e.target?.dataset?.id;

      if (action === "delete") {
        openDeleteModalProduct(id);
        return;
      }
      if (action === "edit") {
        openEdit(id);
        return;
      }
    });
  }

  /* =========================
     INIT PAGE (DIPANGGIL OLEH app.js)
  ========================= */
  window.initProductsPage = async function () {
    console.log("Init Products Page");

    cacheDomProducts();
    bindDomEventsProducts();

    // reset state tiap masuk
    S.currentPage = 1;
    S.deleteId = null;

    // optional reset input UI
    if (S.dom.productSearch) S.dom.productSearch.value = "";
    if (S.dom.categoryFilter) S.dom.categoryFilter.value = "";
    if (S.dom.sortSelect) S.dom.sortSelect.value = "nama_produk:asc";
    if (S.dom.pageSizeEl) S.dom.pageSizeEl.value = String(S.pageSize || 10);

    await loadCategories();
    await loadProducts();
  };
})();