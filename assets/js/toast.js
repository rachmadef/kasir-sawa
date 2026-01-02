/* =====================================================
   GLOBAL TOAST SYSTEM (PROFESSIONAL DESIGN)
===================================================== */
(function () {
  if (window.toast) return;

  const CONFIG = {
    position: "top-right", // top-right | top-left | bottom-right | bottom-left
    duration: 4000,
    gap: 16,
    animationDuration: 300,
    maxToasts: 4
  };

  const queue = [];
  let activeToasts = 0;

  // Styles untuk animasi
  const styles = document.createElement('style');
  styles.textContent = `
    @keyframes toastSlideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes toastSlideInLeft {
      from {
        transform: translateX(-100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes toastSlideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    @keyframes toastSlideOutLeft {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(-100%);
        opacity: 0;
      }
    }
    
    @keyframes toastSlideInBottom {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    @keyframes toastSlideOutBottom {
      from {
        transform: translateY(0);
        opacity: 1;
      }
      to {
        transform: translateY(100%);
        opacity: 0;
      }
    }
    
    @keyframes toastProgress {
      from {
        width: 100%;
      }
      to {
        width: 0%;
      }
    }
    
    .toast-progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: rgba(255, 255, 255, 0.3);
      animation: toastProgress ${CONFIG.duration}ms linear forwards;
    }
    
    .toast-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(styles);

  function getPositionClass() {
    switch (CONFIG.position) {
      case "top-left": return "top-5 left-5 items-start";
      case "bottom-right": return "bottom-5 right-5 items-end";
      case "bottom-left": return "bottom-5 left-5 items-start";
      default: return "top-5 right-5 items-end";
    }
  }

  function getAnimationClass(position, isIn = true) {
    if (isIn) {
      switch (position) {
        case "top-left": return "animate-toastSlideInLeft";
        case "bottom-left": return "animate-toastSlideInLeft";
        case "bottom-right": return "animate-toastSlideInBottom";
        default: return "animate-toastSlideInRight";
      }
    } else {
      switch (position) {
        case "top-left": return "animate-toastSlideOutLeft";
        case "bottom-left": return "animate-toastSlideOutLeft";
        case "bottom-right": return "animate-toastSlideOutBottom";
        default: return "animate-toastSlideOutRight";
      }
    }
  }

  function getIcon(type) {
    switch (type) {
      case "success": return `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      `;
      case "error": return `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      `;
      case "warning": return `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
      `;
      default: return `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      `;
    }
  }

  function getColor(type) {
    switch (type) {
      case "success": 
        return {
          bg: "bg-gradient-to-r from-emerald-500 to-emerald-600",
          icon: "bg-emerald-700",
          text: "text-white"
        };
      case "error": 
        return {
          bg: "bg-gradient-to-r from-red-500 to-red-600",
          icon: "bg-red-700",
          text: "text-white"
        };
      case "warning": 
        return {
          bg: "bg-gradient-to-r from-amber-500 to-amber-600",
          icon: "bg-amber-700",
          text: "text-white"
        };
      default: 
        return {
          bg: "bg-gradient-to-r from-sky-500 to-sky-600",
          icon: "bg-sky-700",
          text: "text-white"
        };
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
        pointer-events-none
      `;
      document.body.appendChild(box);
    }
    return box;
  }

  function showNext() {
    if (queue.length === 0 || activeToasts >= CONFIG.maxToasts) return;

    const { message, type, duration } = queue.shift();
    const box = ensureContainer();
    activeToasts++;

    const colors = getColor(type);
    const toastId = `toast-${Date.now()}`;
    
    const toast = document.createElement("div");
    toast.id = toastId;
    toast.className = `
      flex items-start gap-3
      px-4 py-3 min-w-[280px] max-w-sm
      rounded-xl shadow-xl ${colors.bg} ${colors.text}
      pointer-events-auto
      ${getAnimationClass(CONFIG.position, true)}
      relative overflow-hidden
    `;

    // Tambah progress bar
    const progressBar = document.createElement("div");
    progressBar.className = "toast-progress-bar";
    progressBar.style.animationDuration = `${duration}ms`;

    const iconDiv = document.createElement("div");
    iconDiv.className = `toast-icon ${colors.icon} ${colors.text}`;
    iconDiv.innerHTML = getIcon(type);

    const contentDiv = document.createElement("div");
    contentDiv.className = "flex-1 min-w-0";
    contentDiv.innerHTML = `
      <p class="text-sm font-medium leading-tight">${message}</p>
    `;

    const closeBtn = document.createElement("button");
    closeBtn.className = "ml-2 text-white/80 hover:text-white transition-colors";
    closeBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    `;
    closeBtn.onclick = () => removeToast(toastId);

    toast.appendChild(progressBar);
    toast.appendChild(iconDiv);
    toast.appendChild(contentDiv);
    toast.appendChild(closeBtn);

    box.appendChild(toast);

    // Auto remove
    const autoRemoveTimeout = setTimeout(() => {
      removeToast(toastId);
    }, duration);

    // Simpan timeout ID untuk bisa di-cancel jika di-close manual
    toast.dataset.timeoutId = autoRemoveTimeout;
  }

  function removeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (!toast) return;

    const timeoutId = toast.dataset.timeoutId;
    if (timeoutId) clearTimeout(timeoutId);

    toast.classList.remove(getAnimationClass(CONFIG.position, true));
    toast.classList.add(getAnimationClass(CONFIG.position, false));

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      activeToasts--;
      showNext();
    }, CONFIG.animationDuration);
  }

  window.toast = function (message, type = "success", duration = CONFIG.duration) {
    // Validasi message
    if (!message || typeof message !== 'string') {
      console.warn('Toast message must be a non-empty string');
      return;
    }

    queue.push({ 
      message: message.trim(), 
      type: ["success", "error", "warning", "info"].includes(type) ? type : "info",
      duration: Math.max(2000, Math.min(10000, duration)) // Min 2s, max 10s
    });
    
    showNext();
  };

  /* OPTIONAL: expose config */
  window.toastConfig = function (opts = {}) {
    Object.assign(CONFIG, opts);
  };

  /* OPTIONAL: helper functions */
  window.toastSuccess = function(message, duration) {
    window.toast(message, "success", duration);
  };

  window.toastError = function(message, duration) {
    window.toast(message, "error", duration);
  };

  window.toastWarning = function(message, duration) {
    window.toast(message, "warning", duration);
  };

  window.toastInfo = function(message, duration) {
    window.toast(message, "info", duration);
  };

  // Inisialisasi styles untuk Tailwind
  if (typeof window.tailwind !== 'undefined') {
    const tailwindConfig = window.tailwind.config;
    if (tailwindConfig && tailwindConfig.theme) {
      tailwindConfig.theme.extend = tailwindConfig.theme.extend || {};
      tailwindConfig.theme.extend.animation = tailwindConfig.theme.extend.animation || {};
      tailwindConfig.theme.extend.animation['toastSlideInRight'] = 'toastSlideInRight 0.3s ease-out';
      tailwindConfig.theme.extend.animation['toastSlideInLeft'] = 'toastSlideInLeft 0.3s ease-out';
      tailwindConfig.theme.extend.animation['toastSlideInBottom'] = 'toastSlideInBottom 0.3s ease-out';
      tailwindConfig.theme.extend.animation['toastSlideOutRight'] = 'toastSlideOutRight 0.3s ease-in';
      tailwindConfig.theme.extend.animation['toastSlideOutLeft'] = 'toastSlideOutLeft 0.3s ease-in';
      tailwindConfig.theme.extend.animation['toastSlideOutBottom'] = 'toastSlideOutBottom 0.3s ease-in';
    }
  }
})();