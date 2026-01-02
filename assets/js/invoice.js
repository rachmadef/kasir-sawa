document.addEventListener("DOMContentLoaded", () => {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const method = localStorage.getItem("payment_method") || "-";

  const tbody = document.getElementById("invoiceItems");
  const totalEl = document.getElementById("invoiceTotal");

  let total = 0;

  cart.forEach(item => {
    const subtotal = item.price * item.qty;
    total += subtotal;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="px-4 py-2">${item.name}</td>
      <td class="px-4 py-2 text-center">${item.qty}</td>
      <td class="px-4 py-2 text-right">Rp ${item.price.toLocaleString()}</td>
      <td class="px-4 py-2 text-right">Rp ${subtotal.toLocaleString()}</td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("invoiceTotal").innerText =
    "Rp " + total.toLocaleString();

  document.getElementById("invoiceMethod").innerText = method;
  document.getElementById("invoiceDate").innerText =
    new Date().toLocaleDateString("id-ID");

  document.getElementById("invoiceCode").innerText =
    "INV-" + Math.floor(Math.random() * 100000);
});
