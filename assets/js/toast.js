/* =====================================================
   GLOBAL TOAST SYSTEM (PRO)
===================================================== */
(function () {
  if (window.toast) return;

  const CONFIG = {
    position: "top-right", // top-right | top-left | bottom-right | bottom-left
    duration: 3000,
    gap: 12
  };

  const queue = [];
  let isShowing = false;

  function getPositionClass() {
    switch (CONFIG.position) {
      case "top-left": return "top-5 left-5 items-start";
      case "bottom-right": return "bottom-5 right-5 items-end";
      case "bottom-left": return "bottom-5 left-5 items-start";
      default: return "top-5 right-5 items-end";
    }
  }

  function getIcon(type) {
    switch (type) {
      case "success": return "✔";
      case "error": return "✖";
      case "warning": return "⚠";
      default: return "i";
    }
  }

  function getColor(type) {
    switch (type) {
      case "success": return "bg-emerald-600";
      case "error": return "bg-red-600";
      case "warning": return "bg-yellow-500 text-black";
      default: return "bg-sky-600";
    }
  }

  function ensureContainer() {
    let box = document.getElementById("toastContainer");
    if (!box) {
      box = document.createElement("div");
      box.id = "toastContainer";
      box.className = `
        fixed z-[9999] flex flex-col gap-${CONFIG.gap}
        ${getPositionClass()}
      `;
      document.body.appendChild(box);
    }
    return box;
  }

  function showNext() {
    if (isShowing || queue.length === 0) return;
    isShowing = true;

    const { message, type, duration } = queue.shift();
    const box = ensureContainer();

    const toast = document.createElement("div");
    toast.className = `
      flex items-center gap-3
      px-4 py-3 min-w-[220px] max-w-sm
      rounded-lg shadow-lg text-sm text-white
      animate-toastIn ${getColor(type)}
    `;

    toast.innerHTML = `
      <span class="text-lg">${getIcon(type)}</span>
      <span class="flex-1">${message}</span>
    `;

    box.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("animate-toastOut");
      setTimeout(() => {
        toast.remove();
        isShowing = false;
        showNext();
      }, 250);
    }, duration);
  }

  window.toast = function (message, type = "success", duration = CONFIG.duration) {
    queue.push({ message, type, duration });
    showNext();
  };

  /* OPTIONAL: expose config */
  window.toastConfig = function (opts = {}) {
    Object.assign(CONFIG, opts);
  };
})();
