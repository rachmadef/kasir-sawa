(() => {
  // Cegah reload SPA dobel
  if (window.__posPageLoaded) return;
  window.__posPageLoaded = true;

  /* =========================
     KONFIGURASI API
  ========================= */
  const CUSTOMER_API = "https://annajiyah2bu.com/api-sawa/api/kasir/pelanggan";
  const PRODUCT_API = "https://annajiyah2bu.com/api-sawa/api/kasir/produk";
  const TRANSACTION_API = "https://annajiyah2bu.com/api-sawa/api/kasir/transaksi";
  const STORAGE_URL = "https://annajiyah2bu.com/api-sawa/storage/";

  /* =========================
     STATE GLOBAL
  ========================= */
  let cart = [];
  let products = [];
  let filteredProducts = [];
  let selectedCategory = "";
  let searchKeyword = "";
  let stockFilter = "all";
  let priceSort = "desc";
  let currentPage = 1;
  let perPage = 12;
  let totalPages = 1;
  let customers = [];
  let selectedCustomer = null;
  let isMobileCartOpen = false;
  let currentReceipt = null;
  const MAX_CASH_AMOUNT = 100000000000000; // 100 triliun

  /* =========================
     FUNGSI BANTUAN
  ========================= */
  function authHeader() {
    const token = localStorage.getItem("token");
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  function debounce(fn, delay = 300) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  function sortAZ(arr) {
    arr.sort((a, b) =>
      String(a?.nama_produk || "").localeCompare(
        String(b?.nama_produk || ""),
        "id",
        { sensitivity: "base" }
      )
    );
    return arr;
  }

  function getQtyInCart(productId) {
    const item = cart.find((i) => String(i.id) === String(productId));
    return item ? item.qty : 0;
  }

  // Fungsi untuk format angka Indonesia dengan titik pemisah ribuan
  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // Fungsi untuk parse angka dari format Indonesia
  function parseNumber(str) {
    if (!str || typeof str !== 'string') return 0;
    // Hapus semua karakter non-digit
    const cleaned = str.replace(/[^\d]/g, "");
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  }

  // Hitung total belanja dari cart
  function calculateCartTotal() {
    return cart.reduce((total, item) => total + (item.price * item.qty), 0);
  }

  // Hitung uang kembalian
  function calculateChange(cashAmount) {
    const total = calculateCartTotal();
    const cash = parseNumber(cashAmount);
    const change = cash - total;
    return change >= 0 ? change : 0;
  }

  // Validasi jumlah uang tidak melebihi batas maksimal
  function validateCashAmount(value) {
    const num = parseNumber(value);
    if (num > MAX_CASH_AMOUNT) {
      toast(`Jumlah uang tidak boleh melebihi Rp ${formatNumber(MAX_CASH_AMOUNT)}`, "error", 4000);
      return false;
    }
    return true;
  }

  // Format input saat blur (tambah titik pemisah ribuan)
  function formatInputOnBlur(inputElement) {
    if (!inputElement) return;
    
    const rawValue = inputElement.dataset.raw || inputElement.value;
    if (rawValue) {
      const num = parseNumber(rawValue);
      inputElement.value = formatNumber(num);
      
      // Update uang kembalian
      updateCashChange(inputElement.value);
    }
  }

  // Clean input saat focus (hapus titik pemisah ribuan)
  function cleanInputOnFocus(inputElement) {
    if (!inputElement) return;
    
    const rawValue = inputElement.dataset.raw || "";
    inputElement.value = rawValue;
  }

  // Format input real-time dengan titik pemisah ribuan
  function formatInputRealTime(inputElement) {
    if (!inputElement) return "";
    
    let value = inputElement.value;
    
    // Hapus semua karakter non-digit kecuali backspace/delete
    value = value.replace(/[^\d]/g, "");
    
    // Batasi panjang maksimal (15 digit untuk 100 triliun)
    if (value.length > 15) {
      value = value.substring(0, 15);
    }
    
    // Simpan nilai raw
    inputElement.dataset.raw = value;
    
    // Format dengan titik jika ada nilai
    if (value) {
      const num = parseNumber(value);
      
      // Update uang kembalian secara real-time
      setTimeout(() => updateCashChange(value), 0);
      
      return formatNumber(num);
    } else {
      // Reset uang kembalian jika input kosong
      setTimeout(() => updateCashChange(""), 0);
      return "";
    }
  }

  // Update tampilan uang kembalian
  function updateCashChange(cashAmount) {
    const cashChangeInput = document.getElementById("cashChange");
    if (!cashChangeInput) return;
    
    if (!cashAmount || cashAmount.trim() === "") {
      cashChangeInput.value = "Rp 0";
      return;
    }
    
    const change = calculateChange(cashAmount);
    cashChangeInput.value = "Rp " + formatNumber(change);
  }

  /* =========================
     LOAD DATA PRODUK
  ========================= */
  async function loadPosProducts() {
    const list = document.getElementById("productList");
    if (list)
      list.innerHTML = `<p class="text-sm text-gray-400">Loading...</p>`;

    try {
      const res = await fetch(PRODUCT_API, { headers: authHeader() });
      const json = await res.json();

      if (!res.ok || !json?.status) {
        throw new Error(json?.message || "Gagal memuat produk");
      }

      products = Array.isArray(json.data) ? json.data : [];
      sortAZ(products);

      initCategoryFilter(products);
      applyPosFilter();
    } catch (err) {
      console.error(err);
      if (list)
        list.innerHTML = `<p class="text-sm text-red-500">Gagal memuat produk</p>`;
    }
  }

  async function loadCustomers() {
    try {
      const res = await fetch(CUSTOMER_API, { headers: authHeader() });
      const json = await res.json();

      customers = json?.data?.data || json?.data || [];
    } catch (err) {
      console.error("Gagal memuat pelanggan", err);
      customers = [];
    }
  }

  /* =========================
     FILTER KATEGORI (CHIPS)
  ========================= */
  function initCategoryFilter(data) {
    const wrap = document.getElementById("posCategoryChips");
    if (!wrap) return;

    const uniqueCategories = new Map();
    data.forEach((p) => {
      const id = p?.kategori?.id_kategori;
      const name = p?.kategori?.nama_kategori;
      if (id != null && name) uniqueCategories.set(String(id), String(name));
    });

    const categories = Array.from(uniqueCategories.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "id", { sensitivity: "base" })
    );

    wrap.innerHTML = "";
    wrap.appendChild(createCategoryChip("", "Semua", true));

    categories.forEach(([id, name]) => {
      wrap.appendChild(createCategoryChip(id, name, false));
    });
  }

  function createCategoryChip(id, label, active = false) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.id = id;
    btn.className = `
      px-3 py-1 cursor-pointer rounded-full text-xs border transition whitespace-nowrap
      ${
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
      }
    `.trim();
    btn.textContent = label;
    return btn;
  }

  /* =========================
     FILTER, SORTIR, DAN RENDER
  ========================= */
  function applyPosFilter() {
    // 1. FILTER PRODUK
    filteredProducts = products.filter((p) => {
      const nama = String(p?.nama_produk || "").toLowerCase();
      const stok = Number(p?.stok ?? 0);

      const matchName = nama.includes(searchKeyword);
      const matchCategory =
        !selectedCategory ||
        String(p?.kategori?.id_kategori ?? "") === String(selectedCategory);

      let matchStock = true;
      if (stockFilter === "in") matchStock = stok > 0;
      if (stockFilter === "out") matchStock = stok <= 0;

      return matchName && matchCategory && matchStock;
    });

    // 2. SORTIR HARGA
    if (priceSort === "asc") {
      filteredProducts.sort((a, b) => Number(a.harga) - Number(b.harga));
    } else if (priceSort === "desc") {
      filteredProducts.sort((a, b) => Number(b.harga) - Number(a.harga));
    } else {
      sortAZ(filteredProducts);
    }

    // 3. PAGINATION
    totalPages = Math.max(1, Math.ceil(filteredProducts.length / perPage));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * perPage;
    const paginatedData = filteredProducts.slice(start, start + perPage);

    // 4. RENDER
    renderPosProducts(paginatedData);
    renderPagination();
  }

  function renderPagination() {
    const el = document.getElementById("productPagination");
    if (!el) return;

    el.innerHTML = "";
    if (totalPages <= 1) return;

    // Tombol Sebelumnya
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "‹";
    prevBtn.className = "px-3 py-1 rounded border text-sm";
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
      currentPage--;
      applyPosFilter();
    };
    el.appendChild(prevBtn);

    // Nomor Halaman
    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = document.createElement("button");
      pageBtn.textContent = i;
      pageBtn.className = `
        px-3 py-1 rounded text-sm border
        ${
          i === currentPage
            ? "bg-indigo-600 text-white border-indigo-600"
            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
        }
      `;
      pageBtn.onclick = () => {
        currentPage = i;
        applyPosFilter();
      };
      el.appendChild(pageBtn);
    }

    // Tombol Selanjutnya
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "›";
    nextBtn.className = "px-3 py-1 rounded border text-sm";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
      currentPage++;
      applyPosFilter();
    };
    el.appendChild(nextBtn);
  }

  /* =========================
     RENDER PRODUK
  ========================= */
  function renderPosProducts(data) {
    const list = document.getElementById("productList");
    if (!list) return;

    list.innerHTML = "";

    if (!data.length) {
      list.innerHTML = `
        <p class="text-sm text-gray-400 col-span-full text-center">
          Produk tidak ditemukan
        </p>
      `;
      return;
    }

    data.forEach((p) => {
      const img = p.gambar_produk
        ? (p.gambar_produk.startsWith('http') ? p.gambar_produk : STORAGE_URL + p.gambar_produk)
        : "./assets/images/no-image.png";
      const stok = Number(p?.stok ?? 0);
      const isOut = stok <= 0;
      const kategoriNama = p.kategori?.nama_kategori ?? "-";
      const qty = getQtyInCart(p.id_produk);

      const card = document.createElement("div");
      card.className = `
        product-card rounded-xl p-3 transition relative
        ${
          isOut
            ? "bg-gray-100 opacity-60 cursor-not-allowed"
            : "bg-white cursor-pointer shadow hover:shadow-md"
        }
      `.trim();
      card.dataset.id = p.id_produk;

      card.innerHTML = `
        <div class="relative">
          <img src="${img}" class="h-32 w-full rounded-lg object-cover">

          ${
            qty > 0
              ? `
            <span class="absolute top-2 left-2 bg-emerald-600 text-white
              text-[11px] font-semibold px-2 py-0.5 rounded-full shadow">
              ${qty} dibeli
            </span>
          `
              : ""
          }

          <div class="flex flex-row justify-between mt-2">
            <span class="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full">
              ${kategoriNama}
            </span>

            <span class="text-[10px] px-2 py-0.5 rounded-full ${
              isOut
                ? "bg-red-100 text-red-600"
                : "bg-emerald-100 text-emerald-700"
            }">
              ${isOut ? "Habis" : `Stok ${stok}`}
            </span>
          </div>
        </div>

        <div class="mt-2">
          <h4 class="text-sm font-semibold truncate leading-tight">
            ${p.nama_produk}
          </h4>
          <p class="font-bold text-indigo-600 text-sm mt-1">
            Rp ${formatNumber(Number(p.harga ?? 0))}
          </p>
        </div>

        <div class="mt-3 flex items-center justify-between gap-2 ${
          isOut ? "hidden" : ""
        }">
          <button 
            data-action="minus" 
            data-id="${p.id_produk}"
            class="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-sm transition hover:bg-sky-600 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            ${qty === 0 ? "disabled" : ""}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
              <path fill-rule="evenodd" d="M4.25 12a.75.75 0 0 1 .75-.75h14a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" />
            </svg>
          </button>

          <span class="min-w-[24px] text-center text-sm font-semibold text-gray-700">
            ${qty}
          </span>

          <button 
            data-action="plus" 
            data-id="${p.id_produk}"
            class="w-8 h-8 rounded-full bg-sky-500 text-white cursor-pointer flex items-center justify-center shadow-sm transition hover:bg-sky-600 active:scale-95"
            ${qty >= stok ? "disabled" : ""}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
              <path fill-rule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      `;

      list.appendChild(card);
    });
  }

  /* =========================
     KERANJANG BELANJA
  ========================= */
  function renderCart() {
    const cartEl = document.getElementById("cartItems");
    const totalEl = document.getElementById("cartTotal");
    if (!cartEl || !totalEl) return;

    if (cart.length === 0) {
      cartEl.innerHTML = `
        <p class="text-sm text-gray-400 text-center">Belum ada item</p>
      `;
      totalEl.textContent = "Rp 0";

      updateCartUI();
      return;
    }

    let total = 0;
    cartEl.innerHTML = "";

    cart.forEach((item) => {
      total += item.price * item.qty;

      const row = document.createElement("div");
      row.className = "flex justify-between items-center text-sm";

      row.innerHTML = `
        <div class="min-w-0">
          <p class="font-medium truncate">${item.name}</p>
          <p class="text-xs text-gray-500">
            ${item.qty} x Rp ${formatNumber(item.price)}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button 
            class="px-2 py-1 rounded border hover:bg-gray-50" 
            data-id="${item.id}" 
            data-action="minus"
          >
            -
          </button>
          <button 
            class="px-2 py-1 rounded border hover:bg-gray-50" 
            data-id="${item.id}" 
            data-action="plus"
          >
            +
          </button>
        </div>
      `;
      cartEl.appendChild(row);
    });

    totalEl.textContent = "Rp " + formatNumber(total);
    updateCartUI();
    
    // Update uang kembalian saat cart berubah
    updateCashChangeBasedOnInput();
  }

  // Update uang kembalian berdasarkan input uang yang ada
  function updateCashChangeBasedOnInput() {
    const cashInput = document.getElementById("cashAmount");
    if (cashInput && cashInput.value) {
      updateCashChange(cashInput.value);
    }
  }

  function updateCartUI() {
    updateCartLayout();
    updateCartBadge();
    renderMobileCartItems();
    syncMobileCart();
    toggleCheckoutDisabled();
  }

  function updateCartLayout() {
    const cartBox = document.getElementById("posCart");
    const overlay = document.getElementById("cartOverlay");
    const mobileBar = document.getElementById("mobileCartBar");
    if (!cartBox) return;

    const isMobile = window.innerWidth < 768;

    if (!isMobile) {
      cartBox.classList.remove("is-expanded");
      if (overlay) overlay.classList.add("hidden");
      if (mobileBar) mobileBar.classList.add("hidden");
      return;
    }

    // Di mobile, atur berdasarkan status laci keranjang
    if (isMobileCartOpen && cart.length > 0) {
      cartBox.classList.add("is-expanded");
      if (overlay) overlay.classList.remove("hidden");
      if (mobileBar) mobileBar.classList.add("hidden"); // Sembunyikan bar hijau jika laci dibuka
    } else {
      cartBox.classList.remove("is-expanded");
      if (overlay) overlay.classList.add("hidden");
      
      // Tampilkan bar hijau jika ada item di keranjang
      if (mobileBar) {
        if (cart.length > 0) {
          mobileBar.classList.remove("hidden");
        } else {
          mobileBar.classList.add("hidden");
        }
      }
    }
  }

  function updateCartBadge() {
    const badge = document.getElementById("cartBadge");
    if (!badge) return;

    const count = cart.reduce((sum, i) => sum + Number(i.qty || 0), 0);
    if (count === 0) badge.classList.add("hidden");
    else {
      badge.textContent = count;
      badge.classList.remove("hidden");
    }
  }

  function renderMobileCartItems() {
    const el = document.getElementById("mobileCartItems");
    if (!el) return;

    if (cart.length === 0) {
      el.innerHTML = `
        <p class="text-sm text-gray-400 text-center">Belum ada item</p>
      `;
      return;
    }

    el.innerHTML = "";
    cart.forEach((item) => {
      const row = document.createElement("div");
      row.className = "flex items-center justify-between gap-2";

      row.innerHTML = `
        <div class="min-w-0">
          <p class="text-sm font-medium truncate">${item.name}</p>
          <p class="px-1 py-2 rounded-lg bg-emerald-600 text-white text-xs inline-block mt-1">
            ${item.qty} x Rp ${formatNumber(item.price)}
          </p>
        </div>
      `;
      el.appendChild(row);
    });
  }

  function syncMobileCart() {
    const totalText = document.getElementById("cartTotal")?.textContent || "Rp 0";
    const count = cart.reduce((s, i) => s + i.qty, 0);

    const barTotal = document.getElementById("mobileCartBarTotal");
    const sheetTotal = document.getElementById("mobileCartTotal");
    const countEl = document.getElementById("mobileCartCount");
    const badgeEl = document.getElementById("mobileCartBadge");
    const bar = document.getElementById("mobileCartBar");

    if (barTotal) barTotal.textContent = totalText;
    if (sheetTotal) sheetTotal.textContent = totalText;
    if (countEl) countEl.textContent = count;
    if (badgeEl) badgeEl.textContent = count;
    if (bar) bar.classList.toggle("hidden", count === 0);
  }

  function toggleCheckoutDisabled() {
    const btn = document.getElementById("btnCheckout");
    const btnMobile = document.getElementById("btnMobileCheckout");
    const disabled = cart.length === 0;

    if (btn) btn.disabled = disabled;
    if (btnMobile) btnMobile.disabled = disabled;
  }

  /* =========================
     PEMBAYARAN DAN CHECKOUT
  ========================= */
  function validateStockBeforeSubmit() {
    for (const item of cart) {
      const product = products.find(
        p => String(p.id_produk) === String(item.id)
      );

      if (!product) {
        toast(`Produk tidak ditemukan: ${item.name}`, "error", 4000);
        return false;
      }

      if (item.qty > Number(product.stok)) {
        toast(`Stok ${item.name} tidak mencukupi`, "error", 4000);
        return false;
      }
    }
    return true;
  }

  function resolveCustomerPayload() {
    const nameInput = document.getElementById("customerName");
    const name = nameInput?.value?.trim();
    
    // Jika ada pelanggan terpilih dari autocomplete
    if (selectedCustomer?.id_pelanggan) {
      return selectedCustomer.id_pelanggan;
    }
    
    // Jika ada input manual, kirim sebagai integer atau string ID
    if (name) {
      // Coba cari apakah nama ini ada di daftar pelanggan
      const existingCustomer = customers.find(c => 
        c.nama_pelanggan.toLowerCase() === name.toLowerCase()
      );
      
      if (existingCustomer) {
        return existingCustomer.id_pelanggan;
      }
      
      // Jika tidak ditemukan, kemungkinan backend akan membuat baru
      // Atau kita bisa return object untuk pembuatan baru
      // Tergantung logika backend
      return name; // Atau return null untuk pelanggan umum
    }
    
    // Jika kosong, return null (umum)
    return null;
  }

  function getCustomerDisplayName() {
    if (selectedCustomer) {
      let display = selectedCustomer.nama_pelanggan;
      if (selectedCustomer.no_telp) {
        display += ` (${selectedCustomer.no_telp})`;
      }
      return display;
    }
    
    const nameInput = document.getElementById("customerName");
    const name = nameInput?.value?.trim();
    if (name) {
      return name;
    }
    
    return "Umum";
  }

  // Helper untuk konversi metode pembayaran dari string ke ID
  function convertPaymentMethodToId(methodName) {
    const methodMap = {
      "Tunai": 1,
      "Transfer": 2,
      "Kartu Kredit": 3,
      "Kartu Debit": 4,
      "E-Wallet": 5
      // Sesuaikan dengan data di tabel metode_pembayaran
    };
    
    return methodMap[methodName] || 1; // Default ke Tunai jika tidak ditemukan
  }

  async function submitOrder() {
    if (!validateStockBeforeSubmit()) return;

    const name = document.getElementById("customerName")?.value?.trim();
    if (!name) {
      toast("Nama pelanggan wajib diisi", "warning", 3000);
      document.getElementById("customerName")?.focus();
      return;
    }

    setConfirmLoading(true);

    try {
      let customerId = selectedCustomer?.id_pelanggan;

      // Daftarkan pelanggan otomatis jika belum terdaftar
      if (!customerId) {
        const existing = customers.find(c => String(c.nama_pelanggan || "").toLowerCase() === name.toLowerCase());
        if (existing) {
          customerId = existing.id_pelanggan;
        } else {
          const address = document.getElementById("customerAddress")?.value?.trim() || "";
          const phone = document.getElementById("customerPhone")?.value?.trim() || "";
          const gender = document.getElementById("customerGender")?.value || "L";

          const custRes = await fetch(CUSTOMER_API, {
            method: "POST",
            headers: authHeader(),
            body: JSON.stringify({
              nama_pelanggan: name,
              alamat: address,
              no_telp: phone,
              jenis_kelamin: gender
            })
          });

          if (!custRes.ok) {
            const custJson = await custRes.json();
            throw new Error(custJson.message || "Gagal mendaftarkan pelanggan baru");
          }

          const custJson = await custRes.json();
          customerId = custJson.data.id_pelanggan;
          
          loadCustomers(); // Refresh daftar pelanggan di background
        }
      }

      // Siapkan payload transaksi, set id_metode = 1 (QRIS)
      const payload = {
        id_pelanggan: Number(customerId),
        id_metode: 1, // 1 = QRIS
        status: "Lunas",
        items: cart.map(i => ({
          id_produk: parseInt(i.id),
          jumlah: parseInt(i.qty)
        }))
      };

      const res = await fetch(TRANSACTION_API, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(payload),
      });

      const textResponse = await res.text();
      let json;
      try {
        json = JSON.parse(textResponse);
      } catch (e) {
        throw new Error("Respon dari server tidak valid.");
      }

      if (!res.ok) {
        const errorMsg = json.message || json.error || `Gagal menyimpan transaksi (${res.status})`;
        let errorDetail = errorMsg;
        if (json.errors) {
          errorDetail = Object.entries(json.errors)
            .map(([field, errors]) => `${errors.join(', ')}`)
            .join('\n');
        }
        toast(errorDetail || errorMsg, "error", 5000);
        return;
      }

      toast("Transaksi berhasil! Struk siap dicetak.", "success", 4000);

      // Tutup modal konfirmasi
      closeConfirmModal();

      // Buka modal struk belanja
      openReceiptModal(json.data || {
        tanggal: new Date(),
        no_invoice: "INV-" + Date.now(),
        total_harga: calculateCartTotal(),
        detail: cart.map(i => ({
          produk: i.name,
          jumlah: i.qty,
          harga_satuan: i.price,
          total: i.price * i.qty
        }))
      });

    } catch (err) {
      console.error("Error saat submit order:", err);
      toast("Terjadi kesalahan: " + (err.message || "Periksa koneksi internet Anda."), "error", 5000);
    } finally {
      setConfirmLoading(false);
    }
  }

  function resetForms() {
    const customerNameInput = document.getElementById("customerName");
    if (customerNameInput) customerNameInput.value = "";
    
    const customerAddressInput = document.getElementById("customerAddress");
    if (customerAddressInput) customerAddressInput.value = "";
    
    const customerPhoneInput = document.getElementById("customerPhone");
    if (customerPhoneInput) customerPhoneInput.value = "";
    
    const customerGenderInput = document.getElementById("customerGender");
    if (customerGenderInput) customerGenderInput.value = "";
    
    const cashAmountInput = document.getElementById("cashAmount");
    if (cashAmountInput) {
      cashAmountInput.value = "";
      cashAmountInput.dataset.raw = "";
    }
    
    const cashChangeInput = document.getElementById("cashChange");
    if (cashChangeInput) {
      cashChangeInput.value = "Rp 0";
      cashChangeInput.readOnly = true;
    }
    
    const paymentMethodInput = document.getElementById("paymentMethod");
    if (paymentMethodInput) paymentMethodInput.value = "";
    
    const cashSection = document.getElementById("cashSection");
    if (cashSection) cashSection.classList.add("hidden");
    
    document.getElementById("customerDetail")?.classList.remove("hidden");
    document.getElementById("customerSuggest")?.classList.add("hidden");
  }

  /* =========================
     MODAL KONFIRMASI
  ========================= */
  function openConfirmModal() {
    const modal = document.getElementById("confirmModal");
    const itemsEl = document.getElementById("confirmItems");
    const totalEl = document.getElementById("confirmTotal");
    const methodEl = document.getElementById("confirmMethod");

    if (!modal) return;

    // Daftar item
    itemsEl.innerHTML = "";
    cart.forEach(item => {
      const row = document.createElement("div");
      row.className = "flex justify-between text-sm py-1";
      row.innerHTML = `
        <span>${item.name} x ${item.qty}</span>
        <span class="font-medium">Rp ${formatNumber(item.price * item.qty)}</span>
      `;
      itemsEl.appendChild(row);
    });

    // Total dan metode
    totalEl.textContent = document.getElementById("cartTotal")?.textContent || "Rp 0";
    if (methodEl) methodEl.textContent = "QRIS";

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  function closeConfirmModal() {
    const modal = document.getElementById("confirmModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  function setConfirmLoading(isLoading) {
    const btn = document.getElementById("btnConfirmOrder");
    if (!btn) return;

    btn.disabled = isLoading;
    btn.innerHTML = isLoading 
      ? `<span class="flex items-center gap-2">
           <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
             <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
             <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
           Memproses...
         </span>`
      : "Konfirmasi";
  }

  /* =========================
     AUTOCOMPLETE PELANGGAN
  ========================= */
  function initCustomerAutocomplete() {
    const input = document.getElementById("customerName");
    const suggest = document.getElementById("customerSuggest");
    const detail = document.getElementById("customerDetail");

    if (!input || !suggest || !detail) return;

    function renderItem(c) {
      const div = document.createElement("div");
      div.className =
        "px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm flex flex-col";

      div.innerHTML = `
        <span class="font-medium">${c.nama_pelanggan}</span>
        ${c.no_telp ? `<span class="text-xs text-gray-500">${c.no_telp}</span>` : ""}
      `;

      div.onclick = () => {
        selectedCustomer = c;

        input.value = c.nama_pelanggan;
        document.getElementById("customerAddress").value = c.alamat || "";
        document.getElementById("customerPhone").value = c.no_telp || "";
        document.getElementById("customerGender").value = c.jenis_kelamin || "";

        suggest.classList.add("hidden");
        detail.classList.remove("hidden");
      };

      return div;
    }

    input.addEventListener("input", () => {
      const keyword = input.value.trim();
      suggest.innerHTML = "";

      if (!keyword) {
        selectedCustomer = null;
        suggest.classList.add("hidden");
        detail.classList.remove("hidden");
        return;
      }

      const results = customers.filter((c) =>
        String(c.nama_pelanggan || "").toLowerCase().includes(keyword.toLowerCase())
      );

      if (!results.length) {
        selectedCustomer = null;
        suggest.classList.add("hidden");
        detail.classList.remove("hidden");
        return;
      }

      detail.classList.add("hidden");
      suggest.classList.remove("hidden");

      results.slice(0, 8).forEach((c) => {
        suggest.appendChild(renderItem(c));
      });
    });

    // Reset customer ketika form diubah manual
    input.addEventListener("change", () => {
      if (input.value.trim() && !selectedCustomer) {
        // User mengetik manual, reset selectedCustomer
        selectedCustomer = null;
      }
    });

    // Tutup suggestion saat klik di luar
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !suggest.contains(e.target)) {
        suggest.classList.add("hidden");
      }
    });
  }

  /* =========================
     HANDLER PEMBAYARAN
  ========================= */
  function initPaymentHandlers() {
    const paymentMethodEl = document.getElementById("paymentMethod");
    const uangEl = document.getElementById("cashAmount");
    const kembaliEl = document.getElementById("cashChange");

    if (!paymentMethodEl) return;

    // Ubah input type menjadi text untuk menghindari error parsing
    if (uangEl && uangEl.type === 'number') {
      uangEl.type = 'text';
      uangEl.inputMode = 'numeric';
      uangEl.pattern = '[0-9]*';
    }
    
    if (kembaliEl) {
      kembaliEl.readOnly = true;
      kembaliEl.value = "Rp 0"; // Default value
    }

    // Tampilkan/sembunyikan bagian tunai (opsional, karena backend tidak butuh uang_bayar)
    paymentMethodEl.addEventListener("change", () => {
      const cashSection = document.getElementById("cashSection");
      if (!cashSection) return;

      if (paymentMethodEl.value === "Tunai") {
        cashSection.classList.remove("hidden");
        
        // Auto-focus ke input uang
        setTimeout(() => {
          if (uangEl) {
            uangEl.focus();
            cleanInputOnFocus(uangEl);
          }
        }, 100);
      } else {
        cashSection.classList.add("hidden");
      }
    });

    // Handler input uang dengan format Indonesia (opsional, untuk display saja)
    if (uangEl && kembaliEl) {
      // Format saat blur
      uangEl.addEventListener("blur", () => {
        formatInputOnBlur(uangEl);
      });
      
      // Clean saat focus
      uangEl.addEventListener("focus", () => {
        cleanInputOnFocus(uangEl);
      });
      
      // Format real-time saat input
      uangEl.addEventListener("input", (e) => {
        // Format input
        const formattedValue = formatInputRealTime(uangEl);
        
        // Update tampilan dengan delay untuk menghindari flicker
        setTimeout(() => {
          if (formattedValue !== uangEl.value) {
            uangEl.value = formattedValue;
          }
        }, 0);
      });
      
      uangEl.addEventListener("keydown", (e) => {
        // Izinkan hanya angka dan kontrol keys
        const allowedKeys = [
          'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
          'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'
        ];
        
        if (allowedKeys.includes(e.key)) {
          return;
        }
        
        // Izinkan hanya angka
        if (!/^\d$/.test(e.key)) {
          e.preventDefault();
        }
      });
      
      uangEl.addEventListener("paste", (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const cleaned = pastedText.replace(/[^\d]/g, "");
        uangEl.value = cleaned;
        uangEl.dispatchEvent(new Event('input'));
      });
    }
  }

  /* =========================
     EVENT LISTENERS
  ========================= */
  function initEventListeners() {
    document.addEventListener("click", (e) => {
      // 1. PLUS / MINUS PRODUK
      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        e.stopPropagation();
        handleProductAction(actionBtn);
        return;
      }

      // 2. KLIK KARTU PRODUK
      const card = e.target.closest(".product-card");
      if (card && !e.target.dataset.action) {
        handleProductCardClick(card);
        return;
      }

      // 3. BATAL PESANAN
      if (e.target.id === "btnCancelOrder" || e.target.id === "btnMobileCancel") {
        handleCancelOrder();
        return;
      }

      // 4. CHECKOUT → BUKA MODAL
      if (e.target.id === "btnCheckout" || e.target.id === "btnMobileCheckout") {
        handleCheckout();
        return;
      }

      // 5. TUTUP/KONFIRMASI MODAL
      if (e.target.id === "btnCancelConfirm") {
        closeConfirmModal();
        return;
      }

      if (e.target.id === "btnConfirmOrder") {
        submitOrder();
        return;
      }

      // 6. FILTER KATEGORI
      const chip = e.target.closest("#posCategoryChips button");
      if (chip) {
        handleCategoryFilter(chip);
        return;
      }

      // 7. MOBILE CART OPEN/CLOSE
      handleMobileCartEvents(e);

      // 8. CLOSE RECEIPT / NEW TRANSACTION
      if (e.target.id === "btnCloseReceipt" || e.target.closest("#btnCloseReceipt")) {
        handleNewTransaction();
        return;
      }
      if (e.target.id === "btnNewTransaction") {
        handleNewTransaction();
        return;
      }
      if (e.target.id === "btnPrintReceipt" || e.target.closest("#btnPrintReceipt")) {
        printReceipt();
        return;
      }
      if (e.target.id === "btnShareWhatsApp" || e.target.closest("#btnShareWhatsApp")) {
        shareToWhatsApp();
        return;
      }
    });

    // FILTER STOK
    const stockEl = document.getElementById("filterStock");
    if (stockEl) {
      stockEl.addEventListener("change", () => {
        stockFilter = stockEl.value;
        currentPage = 1;
        applyPosFilter();
      });
    }

    // SORTIR HARGA
    const priceEl = document.getElementById("sortPrice");
    if (priceEl) {
      priceEl.addEventListener("change", () => {
        priceSort = priceEl.value;
        currentPage = 1;
        applyPosFilter();
      });
    }

    // PENCARIAN
    const debouncedSearch = debounce((value) => {
      searchKeyword = String(value || "").toLowerCase();
      applyPosFilter();
    }, 300);

    document.addEventListener("input", (e) => {
      if (e.target.id === "posSearch") debouncedSearch(e.target.value);
    });

    window.addEventListener("resize", () => {
      updateCartLayout();
    });
  }

  function handleProductAction(actionBtn) {
    const action = actionBtn.dataset.action;
    const id = actionBtn.dataset.id;

    const product = products.find((p) => String(p.id_produk) === String(id));
    if (!product) return;

    const existing = cart.find((i) => String(i.id) === String(id));

    if (action === "plus") {
      // Buka laci otomatis jika ini item pertama
      if (cart.length === 0) {
        isMobileCartOpen = true;
      }
      
      if (existing) {
        if (existing.qty >= Number(product.stok ?? 0)) {
          toast(`Stok ${product.nama_produk} tidak mencukupi`, "warning", 3000);
          return;
        }
        existing.qty++;
      } else {
        cart.push({
          id,
          name: product.nama_produk,
          price: Number(product.harga),
          qty: 1,
        });
      }
    }

    if (action === "minus") {
      if (!existing) return;
      existing.qty--;
      if (existing.qty <= 0) {
        cart = cart.filter((i) => String(i.id) !== String(id));
        // Jika keranjang kosong setelah dikurangi, tutup laci otomatis
        if (cart.length === 0) {
          isMobileCartOpen = false;
        }
      }
    }

    renderCart();
    applyPosFilter();
  }

  function handleProductCardClick(card) {
    if (card.classList.contains("cursor-not-allowed")) return;

    const id = card.dataset.id;
    const product = products.find((p) => String(p.id_produk) === String(id));
    if (!product) return;

    const stok = Number(product.stok ?? 0);
    const existing = cart.find((i) => String(i.id) === String(id));
    const qtyInCart = existing ? existing.qty : 0;
    if (qtyInCart >= stok) {
      toast(`Stok ${product.nama_produk} tidak mencukupi`, "warning", 3000);
      return;
    }

    // Buka laci otomatis jika ini item pertama
    if (cart.length === 0) {
      isMobileCartOpen = true;
    }

    if (existing) existing.qty++;
    else
      cart.push({
        id,
        name: product.nama_produk,
        price: Number(product.harga),
        qty: 1,
      });

    renderCart();
    applyPosFilter();
  }

  function handleCancelOrder() {
    cart = [];
    isMobileCartOpen = false; // Tutup laci
    renderCart();
    applyPosFilter();
  }

  function handleCheckout() {
    if (cart.length === 0) {
      toast("Keranjang masih kosong", "warning", 3000);
      return;
    }

    // Simpan keranjang belanja ke localStorage untuk halaman checkout
    localStorage.setItem("checkout_cart", JSON.stringify(cart));

    // Navigasi ke halaman checkout baru
    if (typeof loadPage === "function") {
      loadPage("checkout");
    }
  }

  function handleCategoryFilter(chip) {
    selectedCategory = chip.dataset.id || "";

    document.querySelectorAll("#posCategoryChips button").forEach((b) => {
      b.classList.remove("bg-indigo-600", "text-white", "border-indigo-600");
      b.classList.add("bg-white", "text-gray-600", "border-gray-300");
    });

    chip.classList.remove("bg-white", "text-gray-600", "border-gray-300");
    chip.classList.add("bg-indigo-600", "text-white", "border-indigo-600");

    applyPosFilter();
  }

  function handleMobileCartEvents(e) {
    // 1. Klik bar hijau bawah untuk buka laci
    if (e.target.closest("#mobileCartBar")) {
      isMobileCartOpen = true;
      updateCartLayout();
      return;
    }

    // 2. Klik overlay dimmed background atau tombol tutup untuk menutup laci
    if (
      e.target.closest("#btnCloseMobileCart") || 
      e.target.id === "cartOverlay" || 
      e.target.closest("#cartOverlay")
    ) {
      isMobileCartOpen = false;
      updateCartLayout();
      return;
    }

    // 3. Klik area header keranjang ungu (yang mengintip di bawah) untuk membuka kembali laci
    const cartHeader = e.target.closest(".cart-header");
    if (cartHeader && window.innerWidth < 768 && !isMobileCartOpen) {
      isMobileCartOpen = true;
      updateCartLayout();
      return;
    }
  }

  /* =========================
     STRUK BELANJA DAN CETAK (QRIS ONLY)
  ========================= */
  function openReceiptModal(transactionData) {
    currentReceipt = transactionData;
    const modal = document.getElementById("receiptModal");
    if (!modal) return;

    // Set Date & Invoice Code
    const dateEl = document.getElementById("receiptDate");
    const codeEl = document.getElementById("receiptCode");
    if (dateEl) {
      const dateObj = transactionData.tanggal ? new Date(transactionData.tanggal) : new Date();
      dateEl.textContent = dateObj.toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short"
      });
    }
    if (codeEl) codeEl.textContent = "Invoice: " + (transactionData.no_invoice || "");

    // Set Customer Info
    const name = document.getElementById("customerName")?.value?.trim() || "Umum";
    const address = document.getElementById("customerAddress")?.value?.trim() || "-";
    const phone = document.getElementById("customerPhone")?.value?.trim() || "-";
    
    const rCustName = document.getElementById("receiptCustomerName");
    if (rCustName) rCustName.textContent = name;
    
    const rCustPhone = document.getElementById("receiptCustomerPhone");
    if (rCustPhone) rCustPhone.textContent = "No. Telp: " + phone;
    
    const rCustAddress = document.getElementById("receiptCustomerAddress");
    if (rCustAddress) rCustAddress.textContent = "Alamat: " + address;

    // Set Items List
    const itemsEl = document.getElementById("receiptItems");
    if (itemsEl) {
      itemsEl.innerHTML = "";
      
      const items = transactionData.detail || cart.map(i => ({
        produk: i.name,
        jumlah: i.qty,
        harga_satuan: i.price,
        total: i.price * i.qty
      }));

      items.forEach(item => {
        const itemRow = document.createElement("div");
        itemRow.className = "space-y-0.5";
        itemRow.innerHTML = `
          <div class="flex justify-between font-medium">
            <span>${item.produk}</span>
            <span>Rp ${formatNumber(item.total)}</span>
          </div>
          <div class="text-xs text-gray-500">
            ${item.jumlah} x Rp ${formatNumber(item.harga_satuan)}
          </div>
        `;
        itemsEl.appendChild(itemRow);
      });
    }

    // Set Total
    const totalEl = document.getElementById("receiptTotal");
    if (totalEl) {
      totalEl.textContent = "Rp " + formatNumber(transactionData.total_harga || calculateCartTotal());
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  function handleNewTransaction() {
    const modal = document.getElementById("receiptModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
    
    // Clear cart and customer info
    cart = [];
    selectedCustomer = null;
    resetForms();
    renderCart();
    loadPosProducts(); // Reload products to get latest stock levels
  }

  function printReceipt() {
    const receiptContent = document.getElementById("receiptContent").innerHTML;
    
    // Create an iframe to print cleanly without messing up parent window styling
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.write(`
      <html>
        <head>
          <title>Cetak Struk - Kedai Sawa</title>
          <style>
            /* Reset & Base Thermal Paper Style (width: 58mm/80mm compatible) */
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              padding: 10px;
              width: 290px;
              margin: 0 auto;
              font-size: 12px;
              line-height: 1.4;
              color: #000;
              background-color: #fff;
            }
            
            /* Logo Circle Print - invert for high contrast thermal printing */
            .logo-container {
              display: flex;
              justify-content: center;
              margin-bottom: 6px;
            }
            .logo-circle {
              width: 48px;
              height: 48px;
              background-color: #000 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .logo-img {
              width: 32px;
              height: 32px;
              filter: brightness(0) invert(1); /* Ensure it stays crisp white */
            }

            /* Layout utilities mapping Tailwind */
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .flex { display: flex; align-items: center; }
            .justify-between { justify-content: space-between; }
            .uppercase { text-transform: uppercase; }
            .tracking-wider { letter-spacing: 1.5px; }
            .font-bold { font-weight: bold; }
            
            /* Spacing */
            .space-y-4 > * + * { margin-top: 12px; }
            .space-y-1.5 > * + * { margin-top: 5px; }
            .space-y-0.5 > * + * { margin-top: 2px; }
            .mt-1 { margin-top: 4px; }
            .mt-1.5 { margin-top: 6px; }
            .mt-2 { margin-top: 8px; }
            .mb-1 { margin-bottom: 4px; }
            .mb-2 { margin-bottom: 8px; }
            
            /* Typography sizing */
            .text-base { font-size: 13px; font-weight: bold; }
            .text-sm { font-size: 11px; }
            .text-xs { font-size: 10px; color: #333; }
            .text-\\[11px\\] { font-size: 9.5px; color: #444; }
            .text-gray-500 { color: #222; }
            .text-gray-400 { color: #444; }
            
            /* Dashed Borders for Authentic Receipt Look */
            .border-b { 
              border-bottom: 1px dashed #000; 
              padding-bottom: 8px; 
              margin-bottom: 8px; 
            }
            .border-t { 
              border-top: 1px dashed #000; 
              padding-top: 8px; 
              margin-top: 8px; 
            }
            .pb-4 { padding-bottom: 10px; }
            .pt-1 { padding-top: 2px; }
            .pb-3 { padding-bottom: 6px; }
            .pt-3 { padding-top: 6px; }
          </style>
        </head>
        <body>
          ${receiptContent}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.frameElement.remove();
              }, 100);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  }

  function cleanPhoneNumber(phone) {
    if (!phone || phone === "-") return "";
    let cleaned = phone.replace(/[^\d]/g, ""); // Hanya simpan angka
    if (cleaned.startsWith("0")) {
      cleaned = "62" + cleaned.slice(1);
    } else if (cleaned.startsWith("8")) {
      cleaned = "62" + cleaned;
    }
    return cleaned;
  }

  function shareToWhatsApp() {
    if (!currentReceipt) {
      toast("Tidak ada data struk yang aktif", "warning", 3000);
      return;
    }

    const invoiceCode = currentReceipt.no_invoice || "INV-XXXX";
    const invoiceDate = document.getElementById("receiptDate")?.textContent || new Date().toLocaleString("id-ID");
    const name = document.getElementById("receiptCustomerName")?.textContent || "Umum";
    
    // Ambil nomor telp dari input customerPhone atau dari receiptCustomerPhone
    let phone = document.getElementById("customerPhone")?.value?.trim() || "";
    if (!phone || phone === "-") {
      const receiptPhoneText = document.getElementById("receiptCustomerPhone")?.textContent || "";
      if (receiptPhoneText.includes("No. Telp:")) {
        phone = receiptPhoneText.replace("No. Telp:", "").trim();
      }
    }

    let itemsText = "";
    const items = currentReceipt.detail || [];
    items.forEach(item => {
      const pName = item.produk || item.name || "";
      const qty = item.jumlah || item.qty || 0;
      const price = item.harga_satuan || item.price || 0;
      const subtotal = item.total || (price * qty);
      itemsText += `• _${pName}_ \n  ${qty} x Rp ${formatNumber(price)} = *Rp ${formatNumber(subtotal)}*\n`;
    });

    const totalText = "Rp " + formatNumber(currentReceipt.total_harga || calculateCartTotal());

    const msg = `*KEDAI SAWA*
Coffee, Eatery & Grocery
--------------------------------------------------
*No. Invoice:* ${invoiceCode}
*Tanggal:* ${invoiceDate}
*Pelanggan:* ${name}
--------------------------------------------------
*Detail Belanja:*
${itemsText}
--------------------------------------------------
*TOTAL:* *${totalText}*
*Metode:* QRIS (Lunas)
--------------------------------------------------
Terima kasih telah berbelanja di *Kedai Sawa*! 🙏

_Struk digital ini sah dan diterbitkan otomatis._`;

    const cleanedPhone = cleanPhoneNumber(phone);

    if (cleanedPhone) {
      const url = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    } else {
      const inputNumber = prompt("Masukkan nomor WhatsApp pelanggan (contoh: 08123456789) atau kosongkan untuk memilih langsung di WhatsApp:", "");
      if (inputNumber === null) return; // Batal

      const cleanedInput = cleanPhoneNumber(inputNumber);
      if (cleanedInput) {
        const url = `https://wa.me/${cleanedInput}?text=${encodeURIComponent(msg)}`;
        window.open(url, "_blank");
      } else {
        const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, "_blank");
      }
    }
  }

  /* =========================
     INISIALISASI
  ========================= */
  window.initPosPage = function () {
    cart = [];
    selectedCategory = "";
    searchKeyword = "";
    selectedCustomer = null;
    isMobileCartOpen = false;

    const searchEl = document.getElementById("posSearch");
    if (searchEl) searchEl.value = "";

    // Ubah input uang menjadi type text jika masih number
    const cashInput = document.getElementById("cashAmount");
    if (cashInput && cashInput.type === 'number') {
      cashInput.type = 'text';
      cashInput.inputMode = 'numeric';
      cashInput.pattern = '[0-9]*';
    }

    // Inisialisasi uang kembalian ke 0
    const cashChangeInput = document.getElementById("cashChange");
    if (cashChangeInput) {
      cashChangeInput.value = "Rp 0";
      cashChangeInput.readOnly = true;
    }

    loadCustomers();
    initEventListeners();
    initCustomerAutocomplete();
    initPaymentHandlers();
    loadPosProducts();
    renderCart();
  };
})();