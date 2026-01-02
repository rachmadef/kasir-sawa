document.addEventListener("DOMContentLoaded", () => {
  if (!auth.isAuthenticated()) {
    window.location.href = "index.html";
    return;
  }

  const user = auth.getUser();
  document.getElementById("welcomeRole").innerText = user.role;
});
