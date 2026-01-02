(() => {
  const orderTable = document.getElementById("orderTable");
  const modal = document.getElementById("orderDetailModal");
  const modalContent = document.getElementById("orderDetailContent");
  const orderLoading = document.getElementById("orderLoading");
  const orderCount = document.getElementById("orderCount");

  if (!orderTable) return;
  
  // Global variables
  let allOrders = [];
  let currentPage = 1;
  let lastPage = 1;
  let perPage = 50;
  let totalOrders = 0;
  
  const filterState = {
    keyword: '',
    status: 'all',
    method: 'all',
    date: '',
    sort: 'date-desc'
  };
  
  let __ordersPageInitialized = false;

  /* ================================
    FETCH DATA TRANSAKSI - Pure Server-side
  ================================ */
  async function loadOrders(page = 1) {
    try {
      orderLoading?.classList.remove("hidden");
      
      // SELALU kirim filter ke API
      const params = new URLSearchParams({
        page,
        per_page: perPage,
      });
      
      // Tambahkan filter hanya jika bukan default
      if (filterState.keyword) params.append('keyword', filterState.keyword);
      if (filterState.status !== 'all') params.append('status', filterState.status);
      if (filterState.method !== 'all') params.append('metode', filterState.method);
      if (filterState.date) params.append('tanggal', filterState.date);
      if (filterState.sort !== 'date-desc') params.append('sort', filterState.sort);
      
      const url = `http://127.0.0.1:8000/api/kasir/transaksi?${params.toString()}`;
      
      console.log("Fetching URL:", url);
      
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const json = await res.json();
      console.log("API Response:", json);

      // Process response
      let ordersData = [];
      
      if (json.data && Array.isArray(json.data)) {
        ordersData = json.data;
        currentPage = 1;
        lastPage = 1;
        totalOrders = json.data.length;
      }
      else if (json.data && json.data.data && Array.isArray(json.data.data)) {
        ordersData = json.data.data;
        currentPage = json.data.current_page || 1;
        lastPage = json.data.last_page || 1;
        totalOrders = json.data.total || 0;
      }
      else if (Array.isArray(json)) {
        ordersData = json;
        currentPage = 1;
        lastPage = 1;
        totalOrders = json.length;
      }

      allOrders = ordersData;
      
      // Render langsung data yang diterima dari API
      renderOrders(allOrders);
      renderPagination();

    } catch (err) {
      console.error("Gagal memuat transaksi:", err);
      showErrorMessage(err.message || "Gagal memuat data");
    } finally {
      if (orderLoading) {
        orderLoading.classList.add("hidden");
      }
    }
  }

  /* ================================
    CHECK IF FILTER IS ACTIVE - Simplified
  ================================ */
  function isFilterActive() {
    return (
      filterState.keyword.trim() !== '' ||
      filterState.status !== 'all' ||
      filterState.method !== 'all' ||
      filterState.date !== ''
    );
  }

  /* ================================
    RENDER TABLE - Optimized
  ================================ */
  function renderOrders(orders) {
    if (!orderTable) return;
    
    orderTable.innerHTML = '';

    if (!orders || !orders.length) {
      const noOrderFound = document.getElementById("noOrderFound");
      if (noOrderFound) {
        noOrderFound.classList.remove("hidden");
      }
      updateOrderCount(0);
      return;
    }

    const noOrderFound = document.getElementById("noOrderFound");
    if (noOrderFound) {
      noOrderFound.classList.add("hidden");
    }

    // Sort data sebelum render
    const sortedOrders = sortOrders(orders);

    // Use DocumentFragment untuk batch DOM operations
    const fragment = document.createDocumentFragment();

    sortedOrders.forEach(order => {
      const row = createOrderRow(order);
      fragment.appendChild(row);
    });

    orderTable.appendChild(fragment);
    
    // Update counter
    if (orderCount) {
      let counterText = `${totalOrders} transaksi`;
      if (isFilterActive()) {
        counterText += ' (dengan filter)';
      }
      counterText += ` • halaman ${currentPage} dari ${lastPage}`;
      orderCount.textContent = counterText;
    }
  }

  function createOrderRow(order) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition-colors duration-150 order-row';
    row.dataset.id = order.id_transaksi || order.id || "";
    row.dataset.invoice = order.no_invoice || "";
    row.dataset.customer = (order.pelanggan?.nama_pelanggan || "").toLowerCase();
    row.dataset.method = (order.metode?.nama_metode || "").toLowerCase();
    row.dataset.status = (order.status || "").toLowerCase();
    row.dataset.date = order.tanggal || "";
    row.dataset.total = order.total_harga || 0;

    const statusBadge = order.status === "Lunas"
      ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
          <span class="w-2 h-2 bg-emerald-500 rounded-full mr-1.5"></span>
          Lunas
        </span>`
      : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <span class="w-2 h-2 bg-amber-500 rounded-full mr-1.5"></span>
          Belum Lunas
        </span>`;

    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center">
          <div class="bg-indigo-50 p-1.5 rounded mr-3">
            <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div class="text-sm font-medium text-gray-900 font-mono">${order.no_invoice || "-"}</div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${formatDate(order.tanggal)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center">
    
          <div class="text-sm font-medium text-gray-900">${order.pelanggan?.nama_pelanggan || "-"}</div>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ${order.metode?.nama_metode || "-"}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
        Rp ${Number(order.total_harga || 0).toLocaleString()}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        ${statusBadge}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        <button class="text-emerald-600 hover:text-white cursor-pointer border border-emerald-600 hover:bg-emerald-600  rounded-lg hover:text-indigo-900 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors duration-150"
                data-action="detail"
                data-id="${order.id_transaksi || order.id}">
          <span class="flex items-center gap-1.5">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Detail
          </span>
        </button>
      </td>
    `;

    return row;
  }

  /* ================================
    FILTER FUNCTIONS - Realtime
  ================================ */
  function applyAllFilters() {
    try {
      const orderSearch = document.getElementById('orderSearch');
      const orderStatusFilter = document.getElementById('orderStatusFilter');
      const orderMethodFilter = document.getElementById('orderMethodFilter');
      const orderDateFilter = document.getElementById('orderDateFilter');
      const orderSort = document.getElementById('orderSort');
      
      if (!orderSearch || !orderStatusFilter || !orderMethodFilter) {
        return;
      }
      
      // Update filter state
      filterState.keyword = orderSearch.value.trim();
      filterState.status = orderStatusFilter.value;
      filterState.method = orderMethodFilter.value;
      filterState.date = orderDateFilter ? orderDateFilter.value : '';
      filterState.sort = orderSort ? orderSort.value : 'date-desc';
      
      // Reset ke halaman 1 dan load dari API dengan filter
      currentPage = 1;
      loadOrders(1);
      
    } catch (err) {
      console.error('Error applying filters:', err);
    }
  }

  /* ================================
    SORTING FUNCTION
  ================================ */
  function sortOrders(orders) {
    try {
      if (!orders.length) return orders;
      
      const sortBy = filterState.sort || 'date-desc';
      
      return [...orders].sort((a, b) => {
        switch (sortBy) {
          case 'date-desc':
            return new Date(b.tanggal || 0) - new Date(a.tanggal || 0);
          case 'date-asc':
            return new Date(a.tanggal || 0) - new Date(b.tanggal || 0);
          case 'total-desc':
            return (b.total_harga || 0) - (a.total_harga || 0);
          case 'total-asc':
            return (a.total_harga || 0) - (b.total_harga || 0);
          default:
            return new Date(b.tanggal || 0) - new Date(a.tanggal || 0);
        }
      });
    } catch (err) {
      console.error('Error sorting orders:', err);
      return orders;
    }
  }

  /* ================================
    HELPER FUNCTIONS
  ================================ */
  function updateOrderCount(count) {
    if (!orderCount) return;
    
    if (isFilterActive()) {
      orderCount.textContent = `${count || 0} transaksi (dengan filter) • halaman ${currentPage} dari ${lastPage}`;
    } else {
      orderCount.textContent = `${count || 0} transaksi • halaman ${currentPage} dari ${lastPage}`;
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function showErrorMessage(message = '') {
    const orderLoading = document.getElementById("orderLoading");
    if (orderLoading) {
      orderLoading.innerHTML = `
        <div class="text-center py-8">
          <svg class="h-12 w-12 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="mt-4 text-sm font-medium text-gray-900">Gagal Memuat Data</h3>
          <p class="mt-1 text-sm text-gray-500">${message || 'Silakan coba lagi nanti'}</p>
          <button onclick="window.location.reload()" 
                  class="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100">
            Muat Ulang
          </button>
        </div>
      `;
      orderLoading.classList.remove('hidden');
    }
  }

  /* ================================
    PAGINATION - Pure Server-side
  ================================ */
  function renderPagination() {
    const container = document.getElementById("pagination");
    if (!container) return;

    container.innerHTML = "";

    if (lastPage <= 1) return;

    // PREV
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "‹";
    prevBtn.className = "px-3 py-1 rounded bg-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed";
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => loadOrders(currentPage - 1);
    container.appendChild(prevBtn);

    // PAGE NUMBERS (max 5)
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(lastPage, currentPage + 2);

    for (let i = start; i <= end; i++) {
      const btn = document.createElement("button");
      btn.textContent = i;
      btn.className = `
        px-3 py-1 rounded mx-1
        ${i === currentPage
          ? "px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm "
          : "border border-indigo-600 bg-white rounded-lg cursor-pointer"}
      `;
      btn.onclick = () => loadOrders(i);
      container.appendChild(btn);
    }

    // NEXT
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "›";
    nextBtn.className = "px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed";
    nextBtn.disabled = currentPage === lastPage;
    nextBtn.onclick = () => loadOrders(currentPage + 1);
    container.appendChild(nextBtn);
  }

  /* ================================
    CLEAR FILTERS FUNCTION
  ================================ */
  function clearAllFilters() {
    try {
      const orderSearch = document.getElementById('orderSearch');
      const orderStatusFilter = document.getElementById('orderStatusFilter');
      const orderMethodFilter = document.getElementById('orderMethodFilter');
      const orderDateFilter = document.getElementById('orderDateFilter');
      const orderSort = document.getElementById('orderSort');
      
      if (orderSearch) orderSearch.value = '';
      if (orderStatusFilter) orderStatusFilter.value = 'all';
      if (orderMethodFilter) orderMethodFilter.value = 'all';
      if (orderDateFilter) orderDateFilter.value = '';
      if (orderSort) orderSort.value = 'date-desc';
      
      // Reset filter state
      filterState.keyword = '';
      filterState.status = 'all';
      filterState.method = 'all';
      filterState.date = '';
      filterState.sort = 'date-desc';
      
      // Reset ke halaman 1 dan load ulang data tanpa filter
      currentPage = 1;
      loadOrders(1);
      
    } catch (err) {
      console.error('Error clearing filters:', err);
    }
  }
  /* ================================
    DETAIL MODAL - Enhanced
    + Tambahan data pelanggan (alamat, no_telp, jenis_kelamin)
  ================================ */
  async function openOrderDetail(id) {
    if (!modal || !modalContent) return;
    
    modal.classList.remove("hidden");
    modalContent.innerHTML = `
      <div class="flex items-center justify-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p class="ml-3 text-sm text-gray-500">Memuat detail...</p>
      </div>
    `;

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/kasir/transaksi/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const result = await res.json();
      const data = result.data || result;

      // BUGFIX: data.detail bisa undefined
      const detailList = data.detail || [];

      const items = detailList.map(d => `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 text-sm">
            <div class="font-medium text-gray-900">
              ${typeof d.produk === 'object'
                ? d.produk.nama_produk
                : d.produk}
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-center">${d.jumlah}</td>
          <td class="px-4 py-3 text-sm">
            Rp ${Number(d.harga_satuan).toLocaleString()}
          </td>
          <td class="px-4 py-3 text-sm font-medium">
            Rp ${Number(d.total).toLocaleString()}
          </td>
        </tr>
      `).join('');

      // Tambahan field pelanggan
      const pelanggan = data.pelanggan || {};
      const alamat = pelanggan.alamat || "-";
      const noTelp = pelanggan.no_telp || "-";
      const jenisKelamin = formatGender(pelanggan.jenis_kelamin) || "-";

      modalContent.innerHTML = `
        <div class="space-y-6">
          <!-- Header Info -->
          <div class="rounded-xl p-6 shadow-sm">
            <div class="space-y-6">
              <!-- Baris 1: Invoice dan Tanggal -->
              <div class="grid grid-cols-2 gap-6">
                <!-- Invoice -->
                <div class="space-y-2">
                  <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</p>
                  <div class="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p class="text-sm font-semibold text-gray-900 font-mono truncate">
                      ${data.no_invoice || '-'}
                    </p>
                  </div>
                </div>

                <!-- Tanggal -->
                <div class="space-y-2">
                  <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</p>
                  <div class="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p class="text-sm font-semibold text-gray-900">
                      ${formatDate(data.tanggal)}
                    </p>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-6">
                <div class="flex flex-row justify-between gap-6">
                  <div class="space-y-2">
                    <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</p>

                    ${(data.status?.toLowerCase() === "lunas")
                      ? `<span class="flex items-center justify-center w-full px-4 py-3 rounded-lg text-sm font-medium
                          bg-emerald-50 text-emerald-700 shadow-sm">
                          <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full mr-2"></span>
                          Lunas
                        </span>`
                      : `<span class="flex items-center justify-center w-full px-4 py-3 rounded-lg text-sm font-medium
                          bg-amber-50 text-amber-700 shadow-sm">
                          <span class="w-2.5 h-2.5 bg-amber-500 rounded-full mr-2"></span>
                          Belum Lunas
                        </span>`}
                  </div>

                  <!-- Metode Bayar -->
                  <div class="space-y-2">
                    <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Metode Bayar</p>
                    <span class="flex items-center justify-center w-full px-4 py-3 rounded-lg text-sm font-medium
                      bg-blue-50 text-blue-700  shadow-sm">
                      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      ${data.metode?.nama_metode || '-'}
                    </span>
                  </div>
                </div>
                <!-- Total Transaksi -->
                <div class="space-y-2">
                  <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Transaksi</p>
                  <div class="p-4 bg-indigo-600 rounded-lg shadow-sm">
                    <p class="text-2xl font-bold text-white text-center truncate">
                      Rp ${Number(data.total_harga || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Grid Layout untuk Detail Lengkap -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Informasi Pelanggan -->
            <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div class="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                <div class="p-2 bg-blue-100 rounded-lg">
                  <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h4 class="text-sm font-semibold text-gray-900">Informasi Pelanggan</h4>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Bagian Kiri: Nama dan Alamat -->
                <div class="space-y-4">
                  <p class="text-xs text-gray-500 mb-1">Pelanggan</p>
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <div>
                      <p class="text-sm font-semibold text-gray-900 mt-1">${pelanggan.nama_pelanggan || "-"}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p class="text-xs text-gray-500 mb-1">Alamat Lengkap</p>
                    <div class="flex items-start gap-2">
                      <svg class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p class="text-sm text-gray-900">${alamat}</p>
                    </div>
                  </div>
                </div>
                
                <!-- Bagian Kanan: No. Telepon dan Jenis Kelamin -->
                <div class="space-y-4">
                  <div>
                    <p class="text-xs text-gray-500 mb-1">No. Telepon</p>
                    <div class="flex items-center gap-2">
                      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <p class="text-sm font-medium text-gray-900">${noTelp}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p class="text-xs text-gray-500 mb-1">Jenis Kelamin</p>
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      jenisKelamin === 'Laki-laki' ? 'bg-blue-100 text-white bg-blue-600' :
                      jenisKelamin === 'Perempuan' ? 'bg-pink-100 text-white bg-pink-600' :
                      'bg-gray-100 text-gray-800'
                    }">
                      ${jenisKelamin}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Informasi Produk -->
            <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div class="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                <div class="p-2 bg-green-100 rounded-lg">
                  <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h4 class="text-sm font-semibold text-gray-900">Detail Produk</h4>
              </div>
              
              <div class="border border-gray-200 my-2 rounded-lg overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="min-w-full">
                    <thead class="bg-blue-600">
                      <tr>
                        <th class="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Produk</th>
                        <th class="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Qty</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Harga</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                      ${items || '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500">Tidak ada data produk</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <!-- Ringkasan Pembayaran -->
              <div class="mt-6 pt-5">
                <div class="flex justify-end">
                  <div class="w-full md:w-64 space-y-3">
                    <div class="flex justify-between items-center pt-3">
                      <span class="text-base font-semibold text-gray-900">Total Pembayaran</span>
                      <span class="text-lg font-bold text-indigo-600">Rp ${Number(data.total_harga || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error("Error loading order detail:", err);
      modalContent.innerHTML = `
        <div class="text-center py-8">
          <svg class="h-12 w-12 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="mt-4 text-sm font-medium text-gray-900">Gagal Memuat Detail</h3>
          <p class="mt-1 text-sm text-gray-500">Terjadi kesalahan saat memuat data transaksi</p>
        </div>
      `;
    }
  }

  function formatGender(gender) {
    if (!gender) return 'Tidak diketahui';
    
    switch (gender.toUpperCase()) {
      case 'L':
        return 'Laki-laki';
      case 'P':
        return 'Perempuan';
      case 'M':
        return 'Laki-laki';
      case 'F':
        return 'Perempuan';
      default:
        return gender;
    }
  }

  /* ================================
    CLEAR FILTERS FUNCTION
  ================================ */
  function clearAllFilters() {
    try {
      const orderSearch = document.getElementById('orderSearch');
      const orderStatusFilter = document.getElementById('orderStatusFilter');
      const orderMethodFilter = document.getElementById('orderMethodFilter');
      const orderDateFilter = document.getElementById('orderDateFilter');
      const orderSort = document.getElementById('orderSort');
      
      if (orderSearch) orderSearch.value = '';
      if (orderStatusFilter) orderStatusFilter.value = 'all';
      if (orderMethodFilter) orderMethodFilter.value = 'all';
      if (orderDateFilter) orderDateFilter.value = '';
      if (orderSort) orderSort.value = 'date-desc';
      
      applyAllFilters();
    } catch (err) {
      console.error('Error clearing filters:', err);
    }
  }

  /* ================================
    INIT (guarded) + EVENT LISTENERS
  ================================ */
  function initOrdersPage() {
    if (__ordersPageInitialized) return;
    __ordersPageInitialized = true;

    console.log("Initializing orders page...");

    // Inisialisasi event listeners
    const orderSearch = document.getElementById('orderSearch');
    const orderStatusFilter = document.getElementById('orderStatusFilter');
    const orderMethodFilter = document.getElementById('orderMethodFilter');
    const orderDateFilter = document.getElementById('orderDateFilter');
    const orderSort = document.getElementById('orderSort');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const perPageSelect = document.getElementById('perPageSelect');

    if (perPageSelect) {
      perPageSelect.value = perPage;

      perPageSelect.addEventListener('change', () => {
        perPage = parseInt(perPageSelect.value, 10) || 50;
        currentPage = 1;
        loadOrders(1);
      });
    }

    // Debounced filter function
    const debouncedFilter = debounce(applyAllFilters, 300);

    // Event listeners untuk filter
    if (orderSearch) orderSearch.addEventListener('input', debouncedFilter);
    if (orderStatusFilter) orderStatusFilter.addEventListener('change', applyAllFilters);
    if (orderMethodFilter) orderMethodFilter.addEventListener('change', applyAllFilters);
    if (orderDateFilter) orderDateFilter.addEventListener('change', applyAllFilters);
    if (orderSort) orderSort.addEventListener('change', applyAllFilters);

    // Clear filters button
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearAllFilters);
    // Event delegation untuk detail buttons
    document.addEventListener("click", e => {
      try {
        const detailBtn = e.target.closest('[data-action="detail"]');
        if (detailBtn) {
          openOrderDetail(detailBtn.dataset.id);
          return;
        }

        if (e.target.id === "closeOrderModal" || e.target.id === "closeOrderModalBtn" ||
            e.target.closest('#closeOrderModal') || e.target.closest('#closeOrderModalBtn')) {
          e.preventDefault();
          if (modal) modal.classList.add("hidden");
        }
      } catch (err) {
        console.error('Error handling click:', err);
      }
    });

    // Close modal on background click
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    }
    loadOrders();
  }

  /* ================================
    EVENT LISTENERS
  ================================ */
  // Start immediately if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initOrdersPage);
  } else {
    // DOM already loaded
    initOrdersPage();
  }
})();