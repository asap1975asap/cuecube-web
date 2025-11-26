// ===== CONFIG =====
const DEMO_EMAIL = "demo@cuecube.com";
const DEMO_PASSWORD = "Qwerty142536"; // твой демо-пароль
const AUTH_KEY = "cuecubeLoggedIn";
const CART_KEY = "cuecubeCart";

// адрес бэкенда (можно переопределить через window.API_BASE в index.html)
const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");

// ===== HELPERS =====
function money(n) {
  return "$" + Number(n || 0).toFixed(2);
}
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}
function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}
function setLoggedIn(flag) {
  if (flag) localStorage.setItem(AUTH_KEY, "true");
  else localStorage.removeItem(AUTH_KEY);
}
function isLoggedIn() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if ((page === "products" || page === "checkout") && !isLoggedIn()) {
    location.href = "index.html";
    return;
  }

  if (page === "index") initLogin();
  if (page === "products") initProducts();
  if (page === "checkout") initCheckout();
});

// ===== LOGIN =====
function initLogin() {
  const form = document.getElementById("loginForm");
  const email = document.getElementById("loginEmail");
  const pass = document.getElementById("loginPassword");
  const errorEl = document.getElementById("loginError");

  // при первом заходе очищаем поля (но браузер может предложить автозаполнение)
  email.value = "";
  pass.value = "";

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (email.value.trim() === DEMO_EMAIL && pass.value === DEMO_PASSWORD) {
      setLoggedIn(true);
      location.href = "products.html";
    } else {
      errorEl.style.display = "block";
    }
  });
}

// ===== PRODUCTS + CART =====
function initProducts() {
  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn?.addEventListener("click", () => {
    setLoggedIn(false);
    location.href = "index.html";
  });

  const cart = loadCart();
  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");
  const addBtns = document.querySelectorAll(".add-btn");
  const checkoutBtn = document.getElementById("checkoutBtn");

  function renderCart() {
    cartItemsEl.innerHTML = "";
    let total = 0;
    if (!cart.length) {
      cartItemsEl.textContent = "Cart is empty. Add items from the catalog.";
      cartTotalEl.textContent = "$0.00";
      return;
    }

    cart.forEach((item) => {
      const line = item.qty * item.price;
      total += line;
      const row = document.createElement("div");
      row.className = "cart-line";
      row.innerHTML = `
        <div>
          <div>${item.name}</div>
          <div class="sku">${item.sku || ""}</div>
        </div>
        <div>${money(line)}</div>
      `;
      cartItemsEl.appendChild(row);
    });
    cartTotalEl.textContent = money(total);
  }

  function addToCart(btn) {
    const card = btn.closest(".product-card");
    const id = btn.dataset.productId;
    const name = btn.dataset.name;
    const price = Number(btn.dataset.price);
    const qtyInput = card.querySelector(".qty-input");
    let qty = Number(qtyInput.value || 0);
    if (isNaN(qty) || qty < 10) qty = 10;

    const skuText = card.querySelector(".sku")?.textContent.replace("SKU: ", "") || "";

    const existing = cart.find((i) => i.id === id);
    if (existing) existing.qty += qty;
    else cart.push({ id, name, price, qty, sku: skuText });

    saveCart(cart);
    renderCart();
  }

  addBtns.forEach((btn) => {
    btn.addEventListener("click", () => addToCart(btn));
  });

  checkoutBtn.addEventListener("click", () => {
    if (!cart.length) {
      alert("Cart is empty.");
      return;
    }
    location.href = "checkout.html";
  });

  renderCart();
}

// ===== CHECKOUT + RATES =====
async function fetchRatesForAddress(to) {
  if (!API_BASE) {
    throw new Error("API_BASE is not set");
  }
  const resp = await fetch(API_BASE + "/api/rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error("Rate error: " + text);
  }
  return resp.json();
}

function initCheckout() {
  const logoutBtn = document.getElementById("logoutBtnCheckout");
  logoutBtn?.addEventListener("click", () => {
    setLoggedIn(false);
    location.href = "index.html";
  });

  // вывод корзины
  const cart = loadCart();
  const itemsEl = document.getElementById("summaryItems");
  const totalEl = document.getElementById("summaryTotal");
  let total = 0;

  if (!cart.length) {
    itemsEl.textContent = "Cart is empty. Go back to catalog.";
  } else {
    itemsEl.innerHTML = "";
    cart.forEach((item) => {
      const line = item.qty * item.price;
      total += line;
      const row = document.createElement("div");
      row.className = "cart-line";
      row.innerHTML = `
        <span>${item.name} (${item.qty} × ${money(item.price)})</span>
        <span>${money(line)}</span>
      `;
      itemsEl.appendChild(row);
    });
  }
  totalEl.textContent = money(total);

  const form = document.getElementById("checkoutForm");
  const box = document.getElementById("shippingOptions");

  function getToAddress() {
    return {
      name: document.getElementById("shipName").value.trim(),
      phone: document.getElementById("shipPhone").value.trim(),
      street1: document.getElementById("shipAddr1").value.trim(),
      street2: document.getElementById("shipAddr2").value.trim(),
      city: document.getElementById("shipCity").value.trim(),
      state: document.getElementById("shipState").value.trim(),
      postalCode: document.getElementById("shipPostal").value.trim(),
      country: (document.getElementById("shipCountry").value || "US").trim()
    };
  }

  let rateTimer = null;
  function scheduleRates() {
    clearTimeout(rateTimer);
    rateTimer = setTimeout(async () => {
      const to = getToAddress();
      if (!to.street1 || !to.city || !to.state || !to.postalCode || !to.country) {
        box.textContent = "Enter full address to see shipping options.";
        return;
      }
      box.textContent = "Loading shipping options...";
      try {
        const data = await fetchRatesForAddress({
          city: to.city,
          state: to.state,
          postalCode: to.postalCode,
          country: to.country
        });
        const rates = data.rates || [];
        if (!rates.length) {
          box.textContent = "No rates returned. We will confirm shipping manually.";
          return;
        }
        box.innerHTML = rates
          .map((r, i) => {
            const id = "rate-" + i;
            return `
              <label class="rate-line">
                <input type="radio" name="shipRate" id="${id}" value="${r.carrierCode}|${r.serviceCode}" ${i === 0 ? "checked" : ""}>
                <strong>${r.carrierCode || ""} ${r.serviceName || ""}</strong>
                <span style="float:right;">${money(r.total)}</span>
              </label>
            `;
          })
          .join("");
      } catch (e) {
        console.error(e);
        box.textContent = "Could not load rates. We will confirm shipping manually.";
      }
    }, 500);
  }

  ["shipAddr1", "shipCity", "shipState", "shipPostal", "shipCountry"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("blur", scheduleRates);
      el.addEventListener("change", scheduleRates);
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    alert("Order request submitted. We will contact you to confirm pricing and shipping.");
    localStorage.removeItem(CART_KEY);
    location.href = "products.html";
  });
}
