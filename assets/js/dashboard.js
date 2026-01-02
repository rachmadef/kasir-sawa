(() => {
  // ===============================
  // API ENDPOINT
  // ===============================
  if (typeof API_DASH === "undefined") {
    var API_DASH = "http://127.0.0.1:8000/api/kasir/dashboard";
  }

  // ===============================
  // HELPER (ANTI NULL)
  // ===============================
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  };

  // ===============================
  // MAIN LOGIC (LANGSUNG JALAN)
  // ===============================
  (async () => {
    try {
      // AUTH CHECK
      if (typeof auth === "undefined" || !auth.isAuthenticated()) {
        window.location.href = "index.html";
        return;
      }

      const headers = auth.getAuthHeader();

      // ===============================
      // SUMMARY
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
      // CHART
      // ===============================
      const chartCanvas = document.getElementById("chartPendapatan");

      if (chartCanvas && typeof Chart !== "undefined") {
        const chartRes = await fetch(`${API_DASH}/chart-weekly`, { headers });
        if (!chartRes.ok) throw new Error("Gagal load chart");

        const chartJson = await chartRes.json();
        const chartData = chartJson.data ?? chartJson;

        if (!chartData || chartData.length === 0) {
          chartCanvas.parentElement.innerHTML = `
            <p class="text-center text-gray-400 py-10">
              Tidak ada data grafik
            </p>`;
        } else {
          new Chart(chartCanvas, {
            type: "line",
            data: {
              labels: chartData.map(i => i.tanggal),
              datasets: [{
                label: "Pendapatan",
                data: chartData.map(i => i.total),
                tension: 0.4,
                fill: true
              }]
            }
          });
        }
      }

      // ===============================
      // METODE PEMBAYARAN
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
            <li class="text-center text-gray-400">
              Belum ada transaksi
            </li>`;
        } else {
          metodeData.forEach(item => {
            list.innerHTML += `
              <li class="flex justify-between">
                <span>${item.metode}</span>
                <span class="font-semibold">${item.total}</span>
              </li>`;
          });
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
          <li class="text-center text-red-400">
            Gagal memuat data dashboard
          </li>`;
      }
    }
  })();
})();
