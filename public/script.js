// ===== Simple "auth" =====

const DEMO_EMAIL = "demo@cuecube.com";
const DEMO_PASSWORD = "Qwerty142536"; // updated
const AUTH_KEY = "cuecubeLoggedIn";

function setLoggedIn(flag) {
  if (flag) localStorage.setItem(AUTH_KEY, "true");
  else localStorage.removeItem(AUTH_KEY);
}
function isLoggedIn() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  // Protect private pages
  if ((page === "products" || page === "checkout") && !isLoggedIn()) {
    window.location.href = "index.html";
    return;
  }

  // Index (login)
  if (page === "index") {
    const form = document.getElementById("loginForm");
    const emailInput = document.getElementById("loginEmail");
    const passInput = document.getElementById("loginPassword");
    const errorEl = document.getElementById("loginError");

    // IMPORTANT: do NOT preset values (first visit = empty)
    // Browser may autofill if the user stored credentials.

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
    return;
  }

  // Shared logout
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutBtnCheckout = document.getElementById("logoutBtnCheckout");
  [logoutBtn, logoutBtnCheckout].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      setLoggedIn(false);
      window.location.href = "index.html";
    });
  });

  // Products & checkout flows
  if (page === "products" || page === "checkout") {
    initCartAndCheckout(page);
  }
});

// ===== Cart + checkout =====
const CART_KEY = "cuecubeCart";
function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}
function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}
function money(n){ return "$" + n.toFixed(2); }

function initCartAndCheckout(page) {
  const cart = loadCart();
  if (page === "products") setupProductsPage(cart);
  else if (page === "checkout") setupCheckoutPage(cart);
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
    if (cart.length === 0) {
      cartItemsEl.innerHTML = '<p class="cart-empty">No items yet. Add quantities from the catalog.</p>';
    } else {
      cart.forEach((item) => {
        const line = item.qty * item.price;
        total += line;
        const div = document.createElement("div");
        div.className = "cart-item";
        div.innerHTML = `
          <div class="cart-item-main">
            <strong>${item.name}</strong>
            <div class="cart-item-meta">${item.sku || ""} • ${item.qty} × ${money(item.price)}</div>
          </div>
          <div class="cart-item-total">${money(line)}</div>
        `;
        cartItemsEl.appendChild(div);
      });
    }
    cartTotalEl.textContent = money(total);
  }

  function addToCart(btn) {
    const id = btn.dataset.productId;
    const name = btn.dataset.name;
    const price = Number(btn.dataset.price);
    const min = Number(btn.dataset.min) || 1;
    const card = btn.closest(".product-card");
    const qtyInput = card.querySelector(".qty-input");
    let qty = Number(qtyInput.value || 0);
    if (isNaN(qty) || qty < min) { qty = min; qtyInput.value = min; }

    const item = cart.find((x) => x.id === id);
    const sku = (card.querySelector(".product-sku")?.textContent || "").replace("SKU: ", "");
    if (item) item.qty += qty;
    else cart.push({ id, name, price, qty, sku });

    saveCart(cart);
    renderCart();
  }

  addButtons.forEach((btn) => btn.addEventListener("click", () => addToCart(btn)));
  checkoutBtn.addEventListener("click", () => window.location.href = "checkout.html");
  renderCart();
}

function setupCheckoutPage(cart) {
  const itemsEl = document.getElementById("summaryItems");
  const subEl = document.getElementById("summarySubtotal");
  const shipEl = document.getElementById("summaryShipping");
  const totalEl = document.getElementById("summaryTotal");
  const form = document.getElementById("checkoutForm");
  const rateForm = document.getElementById("rateForm");
  const getRatesBtn = document.getElementById("getRatesBtn");
  const ratesBox = document.getElementById("ratesBox");

  // Render items
  let subtotal = 0;
  itemsEl.innerHTML = "";
  if (cart.length === 0) {
    itemsEl.innerHTML = '<p class="cart-empty">Your cart is empty. Go back to the catalog to add items.</p>';
  } else {
    cart.forEach((item) => {
      const line = item.qty * item.price;
      subtotal += line;
      const div = document.createElement("div");
      div.className = "line";
      div.innerHTML = `<span>${item.name} (${item.qty} × ${money(item.price)})</span><strong>${money(line)}</strong>`;
      itemsEl.appendChild(div);
    });
  }
  subEl.textContent = money(subtotal);

  let shippingCents = 0;
  function updateTotals(){
    shipEl.textContent = money(shippingCents / 100);
    totalEl.textContent = money(subtotal + (shippingCents/100));
  }
  updateTotals();

  async function fetchRates() {
    ratesBox.innerHTML = "Fetching live rates…";
    const data = Object.fromEntries(new FormData(rateForm).entries());
    try{
      const resp = await fetch("/api/rates", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          toAddress: {
            name: data.name || "",
            company: data.company || "",
            street1: data.street1,
            street2: data.street2 || "",
            city: data.city,
            state: data.state,
            postalCode: data.postalCode,
            country: data.country || "US",
          },
          // Default parcel: 10×10×10 in, 10 lb (user requirement)
          parcel: { length:10, width:10, height:10, weightLbs:10 }
        })
      });
      const res = await resp.json();
      if (!resp.ok) throw new Error(res.error || "Failed to fetch rates");
      const rates = res.rates || [];
      if (!rates.length){
        ratesBox.innerHTML = "<p class='tiny'>No rates returned for this address. Please verify the address or try again.</p>";
        return;
      }
      // Build options
      ratesBox.innerHTML = "";
      rates.forEach((r, idx) => {
        const id = "rate_" + idx;
        const row = document.createElement("label");
        row.className = "rate-row";
        row.htmlFor = id;
        const radio = document.createElement("input");
        radio.type = "radio"; radio.name = "rate"; radio.id = id;
        radio.value = r.shippingAmount?.amount || r.amount || 0;
        if (idx===0) radio.checked = true;
        radio.addEventListener("change", () => {
          shippingCents = Math.round(Number(radio.value) * 100);
          updateTotals();
        });
        const carrier = document.createElement("div");
        carrier.className = "rate-carrier";
        const label = (r.serviceName || r.serviceCode || r.service || "Service");
        const carrierName = (r.carrierFriendlyName || r.carrierCode || r.carrier || "Carrier");
        const price = (r.shippingAmount?.amount ?? r.amount ?? 0);
        const eta = r.estimatedDeliveryDate ? new Date(r.estimatedDeliveryDate).toLocaleDateString() : (r.deliveryDays ? `${r.deliveryDays} days` : "");
        carrier.innerHTML = `<strong>${carrierName}</strong> • ${label}`;
        const right = document.createElement("div");
        right.innerHTML = `<div><strong>${money(Number(price))}</strong></div><div class="rate-eta">${eta}</div>`;
        row.appendChild(radio);
        row.appendChild(carrier);
        row.appendChild(right);
        ratesBox.appendChild(row);
      });
      // trigger update using first rate
      const first = ratesBox.querySelector("input[name=rate]:checked");
      if (first) { shippingCents = Math.round(Number(first.value) * 100); updateTotals(); }
    }catch(err){
      ratesBox.innerHTML = `<p class="tiny">Rate request failed: ${err.message}</p>`;
    }
  }

  getRatesBtn.addEventListener("click", fetchRates);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    alert("Order request submitted. We will contact you to confirm pricing and shipping.");
    localStorage.removeItem(CART_KEY);
    window.location.href = "products.html";
  });
}

// ===== View modal with thumbnails =====
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
    const name = card.querySelector(".product-name")?.textContent || "";
    const sku = card.querySelector(".product-sku")?.textContent || "";
    const desc = card.querySelector(".product-desc")?.textContent || "";

    titleEl.textContent = name;
    skuEl.textContent = sku;
    descEl.textContent = desc;

    const imgs = productImages[id] || [];
    thumbsContainer.innerHTML = "";
    if (imgs.length) {
      mainImg.src = imgs[0];
      imgs.forEach((src, i) => {
        const img = document.createElement("img");
        img.src = src;
        img.className = "modal-thumb" + (i===0 ? " active" : "");
        img.addEventListener("click", () => {
          mainImg.src = src;
          thumbsContainer.querySelectorAll(".modal-thumb").forEach(t => t.classList.remove("active"));
          img.classList.add("active");
        });
        thumbsContainer.appendChild(img);
      });
    } else {
      mainImg.src = "";
    }
    modal.classList.add("show");
  }
  function closeModal(){ modal.classList.remove("show"); }

  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => openModalForProduct(btn.dataset.productView));
  });
  modal.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && modal.classList.contains("show")) closeModal(); });
}
