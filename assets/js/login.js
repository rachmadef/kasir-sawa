const API_LOGIN = "http://127.0.0.1:8000/api/kasir/login";


document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  // ✅ validasi role
  if (!role) {
    showToast("Silakan pilih role terlebih dahulu");
    return;
  }

  try {
    const res = await fetch(API_LOGIN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password, role }),
    });

    const json = await res.json();

    if (!res.ok || json.status !== true) {
      const msg =
        json?.message ||
        json?.errors?.email?.[0] ||
        json?.errors?.password?.[0] ||
        json?.errors?.role?.[0] ||
        "Login gagal";
      showToast(msg);
      return;
    }

    // ✅ backend kamu: { token, user }
    const { token, user } = json.data;

    auth.setSession(token, user);

    // redirect
    window.location.href = "main.html";
  } catch (err) {
    console.error(err);
    showToast("Server tidak dapat dihubungi");
  }
});

/* =========================================================
   TOAST
========================================================= */
function showToast(message) {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toast-message");

  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;
  toast.classList.remove("hidden", "translate-x-full");

  setTimeout(() => {
    toast.classList.add("translate-x-full");
  }, 3000);
}

/* =========================================================
   TOGGLE PASSWORD
========================================================= */
function togglePassword(e) {
  const input = document.getElementById("password");
  const icon = e.currentTarget.querySelector("i");
  if (!input || !icon) return;

  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  }
}
