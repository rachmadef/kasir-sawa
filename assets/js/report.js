(() => {
  // ==============================
  // ANTI DOUBLE LOAD (SPA SAFE)
  // ==============================
  if (window.__reportPageLoaded) return;
  window.__reportPageLoaded = true;

  // ==============================
  // CONFIG
  // ==============================
  const API_ACTIVITY = "http://127.0.0.1:8000/api/kasir/aktivitas-user";

  // ==============================
  // DOM ELEMENTS
  // ==============================
  const tabActivity = document.getElementById("tabActivity");
  const tabReport = document.getElementById("tabReport");
  const activitySection = document.getElementById("activitySection");
  const reportSection = document.getElementById("reportSection");
  const activityTable = document.getElementById("activityTable");

  if (!activityTable) return;

  // ==============================
  // TAB HANDLER
  // ==============================
  function setActiveTab(tab) {
    if (tab === "activity") {
      tabActivity.classList.add("border-indigo-600", "text-indigo-600");
      tabActivity.classList.remove("text-gray-500");

      tabReport.classList.remove("border-indigo-600", "text-indigo-600");
      tabReport.classList.add("text-gray-500");

      activitySection.classList.remove("hidden");
      reportSection.classList.add("hidden");
    } else {
      tabReport.classList.add("border-indigo-600", "text-indigo-600");
      tabReport.classList.remove("text-gray-500");

      tabActivity.classList.remove("border-indigo-600", "text-indigo-600");
      tabActivity.classList.add("text-gray-500");

      reportSection.classList.remove("hidden");
      activitySection.classList.add("hidden");
    }
  }

  tabActivity?.addEventListener("click", () => setActiveTab("activity"));
  tabReport?.addEventListener("click", () => setActiveTab("report"));

  // ==============================
  // FETCH AKTIVITAS USER
  // ==============================
  async function loadAktivitasUser() {
    try {
      activityTable.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-6 text-center text-gray-500">
            Memuat aktivitas user...
          </td>
        </tr>
      `;

      const response = await fetch(API_ACTIVITY, {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      if (!response.ok) {
        throw new Error("Gagal mengambil data aktivitas user");
      }

      const json = await response.json();
      renderAktivitasUser(json.data || []);
    } catch (error) {
      console.error(error);
      activityTable.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-6 text-center text-red-500">
            Gagal memuat aktivitas user
          </td>
        </tr>
      `;
    }
  }

  // ==============================
  // RENDER TABLE
  // ==============================
  function renderAktivitasUser(data) {
    if (!data.length) {
      activityTable.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-6 text-center text-gray-500">
            Tidak ada aktivitas user
          </td>
        </tr>
      `;
      return;
    }

    activityTable.innerHTML = data
      .map((row) => {
        return `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 font-medium text-gray-800">
              ${row.user?.nama ?? "-"}
            </td>
            <td class="px-6 py-4 text-gray-600">
              ${row.user?.role ?? "-"}
            </td>
            <td class="px-6 py-4">
              ${renderAksiBadge(row.aksi)}
            </td>
            <td class="px-6 py-4 text-gray-700">
              ${row.modul}
            </td>
            <td class="px-6 py-4 text-gray-600 max-w-[300px] truncate">
              ${row.deskripsi ?? "-"}
            </td>
            <td class="px-6 py-4 text-gray-500 whitespace-nowrap">
              ${formatDate(row.created_at)}
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // ==============================
  // HELPERS
  // ==============================
  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function renderAksiBadge(aksi) {
    const map = {
      CREATE: "bg-emerald-100 text-emerald-700",
      UPDATE: "bg-blue-100 text-blue-700",
      DELETE: "bg-red-100 text-red-700",
      LOGIN: "bg-indigo-100 text-indigo-700",
      LOGOUT: "bg-gray-200 text-gray-700",
    };

    const cls = map[aksi] || "bg-gray-100 text-gray-700";

    return `
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}">
        ${aksi}
      </span>
    `;
  }

  // ==============================
  // INIT
  // ==============================
  setActiveTab("activity");
  loadAktivitasUser();
})();
