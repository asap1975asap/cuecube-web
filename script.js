// ===== Simple "auth" =====

const DEMO_EMAIL = "demo@cuecube.com";
const DEMO_PASSWORD = "Qwerty142536";
const AUTH_KEY = "cuecubeLoggedIn";

function setLoggedIn(flag) {
  if (flag) {
    localStorage.setItem(AUTH_KEY, "true");
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

function isLoggedIn() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if ((page === "products" || page === "checkout") && !isLoggedIn()) {
    window.location.href = "index.html";
    return;
  }

  if (page === "index") {
    setupLoginPage();
    return;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  const logoutBtnCheckout = document.getElementById("logoutBtnCheckout");
  [logoutBtn, logoutBtnCheckout].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      setLoggedIn(false);
      window.location.href = "index.html";
    });
  });

  if (page === "products" || page === "checkout") {
    initCartAndCheckout(page);
  }
});

function setupLoginPage() {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPassword");
  const errorEl = document.getElementById("loginError");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = (emailInput.value || "").trim();
    const pass = passInput.value || "";

    if (email === DEMO_EMAIL && pass === DEMO_PASSWORD) {
      setLoggedIn(true);
      window.location.href = "products.html";
    } else {
      errorEl.style.display = "block";
    }
  });
}

// ===== Cart + checkout =====

const CART_KEY = "cuecubeCart";

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

function formatMoney(num) {
  return "$" + num.toFixed(2);
}

function initCartAndCheckout(page) {
  const cart = loadCart();
  if (page === "products") {
    setupProductsPage(cart);
  } else if (page === "checkout") {
    setupCheckoutPage(cart);
  }
}

function setupProductsPage(cart) {
  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");
  const addButtons = document.querySelectorAll(".add-btn");
  const checkoutBtn = document.getElementById("checkoutBtn");

  setupViewModal();

  function renderCart() {
    cartItemsEl.innerHTML = "";
    let total = 0;
    if (!cart.length) {
      cartItemsEl.textContent = "No items yet. Add quantities from the catalog.";
    } else {
      cart.forEach((item) => {
        const line = item.qty * item.price;
        total += line;
        const row = document.createElement("div");
        row.className = "cart-item";
        row.innerHTML = `
          <span>${item.name} × ${item.qty}</span>
          <span>${formatMoney(line)}</span>
        `;
        cartItemsEl.appendChild(row);
      });
    }
    cartTotalEl.textContent = formatMoney(total);
  }

  function addFromButton(btn) {
    const id = btn.dataset.productId;
    const name = btn.dataset.name;
    const price = Number(btn.dataset.price);
    const min = Number(btn.dataset.min) || 1;

    const card = btn.closest(".product-card");
    const qtyInput = card.querySelector(".qty-input");
    let qty = Number(qtyInput.value || 0);
    if (!qty || qty < min) {
      qty = min;
      qtyInput.value = String(min);
    }

    const existing = cart.find((i) => i.id === id);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ id, name, price, qty });
    }
    saveCart(cart);
    renderCart();
  }

  addButtons.forEach((btn) => {
    btn.addEventListener("click", () => addFromButton(btn));
  });

  checkoutBtn.addEventListener("click", () => {
    window.location.href = "checkout.html";
  });

  renderCart();
}

async function setupCheckoutPage(cart) {
  const itemsEl = document.getElementById("summaryItems");
  const totalEl = document.getElementById("summaryTotal");
  const shipCostEl = document.getElementById("shippingCost");
  const grandTotalEl = document.getElementById("grandTotal");
  const form = document.getElementById("checkoutForm");
  const calcShipBtn = document.getElementById("calcShippingBtn");
  const shipOptionsEl = document.getElementById("shippingOptions");
  const shipErrorEl = document.getElementById("shippingError");

  let merchandiseTotal = 0;
  itemsEl.innerHTML = "";

  if (!cart.length) {
    itemsEl.textContent = "Your cart is empty. Go back to the catalog.";
  } else {
    cart.forEach((item) => {
      const line = item.qty * item.price;
      merchandiseTotal += line;
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <span>${item.name} × ${item.qty}</span>
        <span>${formatMoney(line)}</span>
      `;
      itemsEl.appendChild(row);
    });
  }
  totalEl.textContent = formatMoney(merchandiseTotal);

  let selectedRate = null;

  function updateTotals() {
    const ship = selectedRate ? selectedRate.totalCost : 0;
    shipCostEl.textContent = formatMoney(ship);
    grandTotalEl.textContent = formatMoney(merchandiseTotal + ship);
  }
  updateTotals();

  async function handleCalcShipping() {
    shipErrorEl.style.display = "none";
    shipErrorEl.textContent = "";
    shipOptionsEl.innerHTML = "Calculating shipping...";

    const toCity = document.getElementById("dealerCity").value.trim();
    const toState = document.getElementById("dealerState").value.trim();
    const toPostalCode = document.getElementById("dealerZip").value.trim();
    const toCountry = document.getElementById("dealerCountry").value.trim() || "US";

    if (!toPostalCode || !toCountry) {
      shipOptionsEl.innerHTML = "";
      shipErrorEl.textContent = "Please enter at least ZIP/postal code and country.";
      shipErrorEl.style.display = "block";
      return;
    }

    try {
      const resp = await fetch("/api/shipping-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toCity, toState, toPostalCode, toCountry })
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "Request failed");
      }

      const data = await resp.json();
      const rates = data.rates || [];
      if (!rates.length) {
        shipOptionsEl.innerHTML = "";
        shipErrorEl.textContent = "No rates returned. Please check the address or contact sales.";
        shipErrorEl.style.display = "block";
        selectedRate = null;
        updateTotals();
        return;
      }

      shipOptionsEl.innerHTML = "";
      rates.forEach((rate, idx) => {
        const id = `rate_${idx}`;
        const row = document.createElement("div");
        row.className = "shipping-option-row";
        row.innerHTML = `
          <input type="radio" name="shipRate" id="${id}">
          <label for="${id}">
            ${rate.carrier || ""} ${rate.serviceName || ""}
            — ${formatMoney(rate.totalCost || 0)}
            ${rate.deliveryDays ? `(${rate.deliveryDays} days)` : ""}
          </label>
        `;
        const radio = row.querySelector("input");
        radio.addEventListener("change", () => {
          selectedRate = rate;
          updateTotals();
        });
        shipOptionsEl.appendChild(row);
        if (idx === 0) {
          radio.checked = true;
          selectedRate = rate;
        }
      });
      updateTotals();
    } catch (err) {
      console.error("Shipping error", err);
      shipOptionsEl.innerHTML = "";
      shipErrorEl.textContent = "Error getting shipping rates. Please try again.";
      shipErrorEl.style.display = "block";
      selectedRate = null;
      updateTotals();
    }
  }

  calcShipBtn.addEventListener("click", handleCalcShipping);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selectedRate) {
      alert("Please calculate and select a shipping option before submitting.");
      return;
    }
    alert(
      `Order request submitted.\n\nShipping: ${selectedRate.carrier || ""} ${
        selectedRate.serviceName || ""
      } (${formatMoney(selectedRate.totalCost || 0)}).\n\nWe will contact you to confirm payment.`
    );
    localStorage.removeItem(CART_KEY);
    window.location.href = "products.html";
  });
}

// ===== View modal (simple placeholder images) =====

function setupViewModal() {
  const modal = document.getElementById("viewModal");
  if (!modal) return;

  const mainImg = document.getElementById("modalMainImg");
  const titleEl = document.getElementById("modalTitle");
  const skuEl = document.getElementById("modalSku");
  const descEl = document.getElementById("modalDesc");
  const thumbsContainer = document.getElementById("modalThumbs");

  const productImages = {
    dime353: [
      "img/cue-cube-grey-353-1.jpg",
      "img/cue-cube-grey-353-2.jpg",
      "img/cue-cube-grey-353-3.jpg"
    ],
    nickel418: [
      "img/cue-cube-grey-418-1.jpg",
      "img/cue-cube-grey-418-2.jpg",
      "img/cue-cube-grey-418-3.jpg"
    ],
    keychain: [
      "img/cue-cube-keychain-418-1.jpg",
      "img/cue-cube-keychain-418-2.jpg",
      "img/cue-cube-keychain-418-3.jpg"
    ]
  };

  function openModalForProduct(id) {
    const card = document.querySelector(`.product-card[data-product-id="${id}"]`);
    if (!card) return;

    const name = card.querySelector("h2")?.textContent || "";
    const sku = card.querySelector(".sku")?.textContent || "";
    const desc = card.querySelector(".desc")?.textContent || "";

    titleEl.textContent = name;
    skuEl.textContent = sku;
    descEl.textContent = desc;

    const imgs = productImages[id] || [];
    thumbsContainer.innerHTML = "";
    if (imgs.length) {
      mainImg.src = imgs[0];
      imgs.forEach((src, idx) => {
        const img = document.createElement("img");
        img.src = src;
        img.addEventListener("click", () => {
          mainImg.src = src;
        });
        thumbsContainer.appendChild(img);
      });
    } else {
      mainImg.src = "";
    }

    modal.classList.add("show");
  }

  function closeModal() {
    modal.classList.remove("show");
  }

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.productView;
      openModalForProduct(id);
    });
  });

  modal.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      closeModal();
    }
  });
}
