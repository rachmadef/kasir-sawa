(() => {
  // ===============================
  // API ENDPOINT
  // ===============================
  if (typeof API_DASH === "undefined") {
    var API_DASH = "https://annajiyah2bu.com/api-sawa/api/kasir/dashboard";
  }

  // ===============================
  // HELPER (ANTI NULL)
  // ===============================
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  };

  // ===============================
  // EXPOSED INITIALIZATION FUNCTION (SPA-FRIENDLY)
  // ===============================
  window.initDashboardPage = async () => {
    try {
      // AUTH CHECK
      if (typeof auth === "undefined" || !auth.isAuthenticated()) {
        window.location.href = "index.html";
        return;
      }

      // Cleanup existing Chart instance if it exists
      if (window.dashboardChartInstance) {
        window.dashboardChartInstance.destroy();
        window.dashboardChartInstance = null;
      }

      // Set Date
      const dateEl = document.getElementById("dashboardDate");
      if (dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.innerText = new Date().toLocaleDateString('id-ID', options);
      }

      // Set Welcome User Name
      const user = auth.getUser();
      const welcomeUserEl = document.getElementById("welcomeUserName");
      if (welcomeUserEl && user) {
        welcomeUserEl.innerText = user.nama || user.name || user.username || "Kasir Sawa";
      }

      const headers = auth.getAuthHeader();

      // ===============================
      // 1. SUMMARY STATS
      // ===============================
      const summaryRes = await fetch(`${API_DASH}/summary`, { headers });
      if (!summaryRes.ok) throw new Error("Gagal load summary");

      const summaryJson = await summaryRes.json();
      const summary = summaryJson.data ?? summaryJson;

      setText("totalTransaksi", summary.total_transaksi ?? 0);
      setText("transaksiHariIni", summary.transaksi_hari_ini ?? 0);
      setText("transaksiLunas", summary.transaksi_lunas ?? 0);
      setText("totalKategori", summary.total_kategori ?? 0);

      // ===============================
      // 2. CHART GRAPH (WEEKLY REVENUE)
      // ===============================
      const chartCanvas = document.getElementById("chartPendapatan");

      if (chartCanvas && typeof Chart !== "undefined") {
        const chartRes = await fetch(`${API_DASH}/chart-weekly`, { headers });
        if (!chartRes.ok) throw new Error("Gagal load chart");

        const chartJson = await chartRes.json();
        const chartData = chartJson.data ?? chartJson;

        if (!chartData || chartData.length === 0) {
          chartCanvas.parentElement.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-gray-400">
              <i class="fa-solid fa-chart-line text-4xl mb-2 text-gray-300"></i>
              <p class="text-sm">Tidak ada data pendapatan mingguan</p>
            </div>`;
        } else {
          const ctx = chartCanvas.getContext('2d');
          
          // Custom Canvas Gradients for ultra-premium design
          const lineGradient = ctx.createLinearGradient(0, 0, 0, 300);
          lineGradient.addColorStop(0, '#4f46e5'); // Indigo
          lineGradient.addColorStop(1, '#3b82f6'); // Sky

          const fillGradient = ctx.createLinearGradient(0, 0, 0, 260);
          fillGradient.addColorStop(0, 'rgba(79, 70, 229, 0.16)');
          fillGradient.addColorStop(0.5, 'rgba(79, 70, 229, 0.04)');
          fillGradient.addColorStop(1, 'rgba(79, 70, 229, 0)');

          window.dashboardChartInstance = new Chart(chartCanvas, {
            type: "line",
            data: {
              labels: chartData.map(i => {
                const date = new Date(i.tanggal);
                return isNaN(date.getTime()) ? i.tanggal : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
              }),
              datasets: [{
                label: "Pendapatan",
                data: chartData.map(i => i.total),
                borderColor: lineGradient,
                borderWidth: 3.5,
                backgroundColor: fillGradient,
                tension: 0.38,
                fill: true,
                pointBackgroundColor: '#4f46e5',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4.5,
                pointHoverRadius: 7.5,
                pointHoverBackgroundColor: '#4f46e5',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3.5
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false
                },
                tooltip: {
                  backgroundColor: '#1e1b4b', // Dark indigo theme tooltip
                  titleColor: '#e0e7ff',
                  bodyColor: '#ffffff',
                  titleFont: { size: 12, weight: 'bold', family: 'Outfit, Inter, sans-serif' },
                  bodyFont: { size: 13, family: 'Outfit, Inter, sans-serif' },
                  padding: 12,
                  cornerRadius: 12,
                  displayColors: false,
                  callbacks: {
                    label: function(context) {
                      let label = context.dataset.label || '';
                      if (label) label += ': ';
                      if (context.parsed.y !== null) {
                        label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(context.parsed.y);
                      }
                      return label;
                    }
                  }
                }
              },
              scales: {
                x: {
                  grid: {
                    display: false
                  },
                  ticks: {
                    color: '#9ca3af',
                    font: { size: 10, weight: '500', family: 'Outfit, Inter, sans-serif' }
                  }
                },
                y: {
                  grid: {
                    color: '#f3f4f6'
                  },
                  ticks: {
                    color: '#9ca3af',
                    font: { size: 10, weight: '500', family: 'Outfit, Inter, sans-serif' },
                    callback: function(value) {
                      return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
                    }
                  }
                }
              }
            }
          });
        }
      }

      // ===============================
      // 3. PAYMENT METHODS
      // ===============================
      const list = document.getElementById("metodePembayaran");

      if (list) {
        const metodeRes = await fetch(`${API_DASH}/payment-methods`, { headers });
        if (!metodeRes.ok) throw new Error("Gagal load metode");

        const metodeJson = await metodeRes.json();
        const metodeData = metodeJson.data ?? metodeJson;

        list.innerHTML = "";

        if (!metodeData || metodeData.length === 0) {
          list.innerHTML = `
            <li class="text-center text-gray-400 py-4">
              Belum ada transaksi
            </li>`;
        } else {
          // Calculate Grand Total to yield percentages
          const grandTotal = metodeData.reduce((sum, item) => sum + (parseInt(item.total) || 0), 0);

          metodeData.forEach(item => {
            const totalCount = parseInt(item.total) || 0;
            const percent = grandTotal > 0 ? Math.round((totalCount / grandTotal) * 100) : 0;

            list.innerHTML += `
              <li class="space-y-1.5">
                <div class="flex justify-between text-sm font-semibold text-gray-700">
                  <span class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    ${item.metode}
                  </span>
                  <span class="text-gray-500 text-xs">${totalCount} Transaksi (${percent}%)</span>
                </div>
                <div class="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div class="bg-gradient-to-r from-emerald-400 to-teal-500 h-full rounded-full transition-all duration-500" style="width: ${percent}%"></div>
                </div>
              </li>`;
          });
        }
      }

      // ===============================
      // 4. RECENT TRANSACTIONS (5 RECORDS)
      // ===============================
      const recentTable = document.getElementById("dashboardRecentTransactions");
      if (recentTable) {
        const transRes = await fetch("https://annajiyah2bu.com/api-sawa/api/kasir/transaksi?per_page=5", { headers });
        if (transRes.ok) {
          const transJson = await transRes.json();
          let transData = [];

          if (transJson.data && Array.isArray(transJson.data)) {
            transData = transJson.data;
          } else if (transJson.data && transJson.data.data && Array.isArray(transJson.data.data)) {
            transData = transJson.data.data;
          }

          recentTable.innerHTML = "";

          if (transData.length === 0) {
            recentTable.innerHTML = `
              <tr>
                <td colspan="5" class="py-8 text-center text-gray-400">
                  <i class="fa-solid fa-receipt text-3xl mb-2 text-gray-300 block"></i>
                  Belum ada transaksi terdaftar
                </td>
              </tr>`;
          } else {
            transData.forEach(item => {
              const clientName = item.pelanggan?.nama_pelanggan || "Umum";
              const initials = String(clientName)
                .split(" ")
                .map(w => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              // Format date and time
              let formattedTime = "-";
              if (item.tanggal) {
                const tDate = new Date(item.tanggal);
                if (!isNaN(tDate.getTime())) {
                  formattedTime = tDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ", " + 
                                  tDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                }
              }

              const totalVal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.total_harga || 0);

              const statusBadge = item.status === "Lunas"
                ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Lunas
                  </span>`
                : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Belum Lunas
                  </span>`;

              recentTable.innerHTML += `
                <tr class="hover:bg-gray-50/50 transition-colors">
                  <td class="py-3 px-4 font-mono font-bold text-gray-900 text-xs">${item.no_invoice || "-"}</td>
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold border border-indigo-100 flex-shrink-0">
                        ${initials}
                      </div>
                      <span class="font-medium text-gray-700">${clientName}</span>
                    </div>
                  </td>
                  <td class="py-3 px-4 text-xs text-gray-500">${formattedTime}</td>
                  <td class="py-3 px-4 text-right font-bold text-gray-800">${totalVal}</td>
                  <td class="py-3 px-4 text-center">${statusBadge}</td>
                </tr>`;
            });
          }
        }
      }

      // ===============================
      // 5. EMPLOYEE ACTIVITY LOGS
      // ===============================
      const activityLogs = document.getElementById("dashboardActivityLogs");
      if (activityLogs) {
        const actRes = await fetch("https://annajiyah2bu.com/api-sawa/api/kasir/aktivitas-user", { headers });
        if (actRes.ok) {
          const actJson = await actRes.json();
          const actData = actJson.data ?? actJson;

          activityLogs.innerHTML = "";

          if (!actData || actData.length === 0) {
            activityLogs.innerHTML = `
              <li class="text-center text-gray-400 py-6">
                <i class="fa-solid fa-clock text-2xl text-gray-300 block mb-2"></i>
                Tidak ada aktivitas tercatat
              </li>`;
          } else {
            // Take top 5 logs
            const topActivities = actData.slice(0, 5);

            topActivities.forEach(item => {
              const cashierName = item.user?.nama || item.user?.name || "Kasir";
              const action = item.aksi || "Melakukan Aksi";
              const modul = item.modul || "Sistem";
              const desc = item.deskripsi || "Aktivitas kasir";

              // Format relative time
              let timeDelta = "Baru saja";
              if (item.created_at) {
                const diffMs = new Date() - new Date(item.created_at);
                const diffMins = Math.floor(diffMs / 60000);
                const diffHrs = Math.floor(diffMins / 60);

                if (diffMins > 0 && diffMins < 60) {
                  timeDelta = `${diffMins} menit lalu`;
                } else if (diffHrs > 0 && diffHrs < 24) {
                  timeDelta = `${diffHrs} jam lalu`;
                } else if (diffHrs >= 24) {
                  timeDelta = new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                }
              }

              activityLogs.innerHTML += `
                <li class="relative pb-4 flex gap-x-3">
                  <div class="relative flex h-6 w-6 flex-none items-center justify-center">
                    <div class="h-2.5 w-2.5 rounded-full bg-indigo-600 ring-4 ring-indigo-50"></div>
                  </div>
                  <div class="flex-auto py-0.5 text-xs leading-5 text-gray-500">
                    <div class="flex justify-between gap-x-4">
                      <span class="font-bold text-gray-800">${cashierName}</span>
                      <span class="flex-none text-gray-400">${timeDelta}</span>
                    </div>
                    <p class="text-gray-600 mt-0.5">
                      <span class="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-indigo-50 text-indigo-700 mr-1 uppercase">
                        ${action} ${modul}
                      </span> 
                      ${desc}
                    </p>
                  </div>
                </li>`;
            });
          }
        }
      }

    } catch (err) {
      console.error("Dashboard Error:", err);

      setText("totalTransaksi", "-");
      setText("transaksiHariIni", "-");
      setText("transaksiLunas", "-");
      setText("totalKategori", "-");

      const list = document.getElementById("metodePembayaran");
      if (list) {
        list.innerHTML = `
          <li class="text-center text-red-500 py-4">
            Gagal memuat data dashboard
          </li>`;
      }
    }
  };

  // Immediate SPA self-initialization hook
  if (document.getElementById("totalTransaksi")) {
    window.initDashboardPage();
  }
})();
