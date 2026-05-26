(() => {
  if (window.__checkoutPageLoaded) return;
  window.__checkoutPageLoaded = true;

  /* =========================
     KONFIGURASI API
  ========================= */
  const CUSTOMER_API = "https://annajiyah2bu.com/api-sawa/api/kasir/pelanggan";
  const TRANSACTION_API = "https://annajiyah2bu.com/api-sawa/api/kasir/transaksi";

  /* =========================
     STATE GLOBAL
  ========================= */
  let checkoutCart = [];
  let customers = [];
  let selectedCustomer = null;
  let currentReceipt = null;

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

  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function parseNumber(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    const cleaned = str.replace(/[^\d]/g, "");
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  }

  function calculateCartTotal() {
    return checkoutCart.reduce((total, item) => total + (item.price * item.qty), 0);
  }

  /* =========================
     LOAD DATA CHECKOUT
  ========================= */
  async function loadCheckoutData() {
    const cartData = localStorage.getItem("checkout_cart");
    if (!cartData) {
      toast("Keranjang belanja kosong. Kembali ke halaman Kasir.", "warning", 3000);
      setTimeout(() => {
        if (typeof loadPage === "function") loadPage("pos");
      }, 500);
      return;
    }

    checkoutCart = JSON.parse(cartData);
    if (checkoutCart.length === 0) {
      toast("Keranjang belanja kosong. Kembali ke halaman Kasir.", "warning", 3000);
      setTimeout(() => {
        if (typeof loadPage === "function") loadPage("pos");
      }, 500);
      return;
    }

    // Render rincian barang
    renderCheckoutItems();
    
    // Load customer autocomplete list
    await loadCustomers();
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
     RENDER BARANG
  ========================= */
  function renderCheckoutItems() {
    const container = document.getElementById("checkoutItems");
    const totalEl = document.getElementById("checkoutTotal");
    if (!container || !totalEl) return;

    container.innerHTML = "";
    checkoutCart.forEach(item => {
      const row = document.createElement("div");
      row.className = "flex justify-between items-center text-sm py-2 border-b border-gray-50 last:border-0";
      row.innerHTML = `
        <div class="min-w-0">
          <p class="font-semibold text-gray-800 truncate">${item.name}</p>
          <p class="text-xs text-gray-500">${item.qty} x Rp ${formatNumber(item.price)}</p>
        </div>
        <span class="font-bold text-gray-800 text-right ml-auto">
          Rp ${formatNumber(item.price * item.qty)}
        </span>
      `;
      container.appendChild(row);
    });

    totalEl.textContent = "Rp " + formatNumber(calculateCartTotal());
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
      div.className = "px-4 py-2.5 cursor-pointer hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0 flex flex-col transition";
      div.innerHTML = `
        <span class="font-bold text-gray-800">${c.nama_pelanggan}</span>
        ${c.no_telp ? `<span class="text-xs text-gray-500 mt-0.5">${c.no_telp} - ${c.alamat || 'No Address'}</span>` : ""}
      `;

      div.onclick = () => {
        selectedCustomer = c;
        input.value = c.nama_pelanggan;
        
        const addrInput = document.getElementById("customerAddress");
        const phoneInput = document.getElementById("customerPhone");
        const genderInput = document.getElementById("customerGender");
        
        if (addrInput) addrInput.value = c.alamat || "";
        if (phoneInput) phoneInput.value = c.no_telp || "";
        if (genderInput) genderInput.value = c.jenis_kelamin || "";

        suggest.classList.add("hidden");
      };

      return div;
    }

    input.addEventListener("input", () => {
      const keyword = input.value.trim();
      suggest.innerHTML = "";

      if (!keyword) {
        selectedCustomer = null;
        suggest.classList.add("hidden");
        return;
      }

      const results = customers.filter((c) =>
        String(c.nama_pelanggan || "").toLowerCase().includes(keyword.toLowerCase())
      );

      if (!results.length) {
        selectedCustomer = null;
        suggest.classList.add("hidden");
        return;
      }

      suggest.classList.remove("hidden");
      results.slice(0, 8).forEach((c) => {
        suggest.appendChild(renderItem(c));
      });
    });

    // Tutup suggestion saat klik di luar
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !suggest.contains(e.target)) {
        suggest.classList.add("hidden");
      }
    });
  }

  /* =========================
     PROSES CHECKOUT & SUBMIT
  ========================= */
  async function submitCheckoutOrder() {
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
        }
      }

      // Siapkan payload transaksi, set id_metode = 1 (QRIS)
      const payload = {
        id_pelanggan: Number(customerId),
        id_metode: 1, // 1 = QRIS
        status: "Lunas",
        items: checkoutCart.map(i => ({
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

      // Buka modal struk belanja
      openReceiptModal(json.data || {
        tanggal: new Date(),
        no_invoice: "INV-" + Date.now(),
        total_harga: calculateCartTotal(),
        detail: checkoutCart.map(i => ({
          produk: i.name,
          jumlah: i.qty,
          harga_satuan: i.price,
          total: i.price * i.qty
        }))
      });

      // Bersihkan keranjang checkout di localstorage
      localStorage.removeItem("checkout_cart");
      // Bersihkan keranjang belanja pos global di pos.js
      if (typeof window.initPosPage === "function") {
        localStorage.removeItem("pos_cart"); // Jaga-jaga jika ada backup
      }

    } catch (err) {
      console.error("Error saat submit order:", err);
      toast("Terjadi kesalahan: " + (err.message || "Periksa koneksi internet Anda."), "error", 5000);
    } finally {
      setConfirmLoading(false);
    }
  }

  function setConfirmLoading(isLoading) {
    const btn = document.getElementById("btnConfirmPayment");
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
      : "Sudah Bayar ✓";
  }

  /* =========================
     STRUK BELANJA DAN CETAK
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
      
      const items = transactionData.detail || checkoutCart.map(i => ({
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
    
    // Kembali ke halaman POS SPA
    if (typeof loadPage === "function") {
      loadPage("pos");
    }
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
     EVENT LISTENERS & BINDING
  ========================= */
  function initEventListeners() {
    document.addEventListener("click", (e) => {
      // 1. Back button top bar
      if (e.target.closest("#btnBackToPos")) {
        if (typeof loadPage === "function") loadPage("pos");
        return;
      }

      // 2. Batal button
      if (e.target.id === "btnCancelCheckout") {
        localStorage.removeItem("checkout_cart");
        if (typeof loadPage === "function") loadPage("pos");
        return;
      }

      // 3. Konfirmasi Bayar
      if (e.target.id === "btnConfirmPayment") {
        submitCheckoutOrder();
        return;
      }

      // 4. Struk Modal Actions
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
  }

  /* =========================
     INISIALISASI HALAMAN
  ========================= */
  window.initCheckoutPage = function() {
    checkoutCart = [];
    selectedCustomer = null;
    
    // Set listeners and data loading
    initEventListeners();
    initCustomerAutocomplete();
    loadCheckoutData();
  };

})();
