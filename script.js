// ===== Simple "auth" =====

const DEMO_EMAIL = "demo@cuecube.com";
const DEMO_PASSWORD = "123Qwerty123";
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

  // Redirect protection
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

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const email = emailInput.value.trim();
      const pass = passInput.value;

      if (email === DEMO_EMAIL && pass === DEMO_PASSWORD) {
        setLoggedIn(true);
        window.location.href = "products.html";
      } else {
        errorEl.style.display = "block";
      }
    });

    return;
  }

  // Logout (shared)
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutBtnCheckout = document.getElementById("logoutBtnCheckout");
  [logoutBtn, logoutBtnCheckout].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      setLoggedIn(false);
      window.location.href = "index.html";
    });
  });

  // Products & cart
  if (page === "products" || page === "checkout") {
    initCartAndCheckout(page);
  }
});

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

  // View modal
  setupViewModal();

  function renderCart() {
    cartItemsEl.innerHTML = "";
    let total = 0;

    if (cart.length === 0) {
      cartItemsEl.innerHTML =
        '<p class="cart-empty">No items yet. Add quantities from the catalog.</p>';
    } else {
      cart.forEach((item) => {
        const line = item.qty * item.price;
        total += line;

        const div = document.createElement("div");
        div.className = "cart-item";

        div.innerHTML = `
          <div class="cart-item-main">
            <span class="cart-item-name">${item.name}</span>
            <span class="cart-item-meta">${item.sku || ""} • ${item.qty} × ${formatMoney(item.price)}</span>
          </div>
          <div class="cart-item-total">
            ${formatMoney(line)}
          </div>
        `;

        cartItemsEl.appendChild(div);
      });
    }

    cartTotalEl.textContent = formatMoney(total);
  }

  function addToCartFromButton(btn) {
    const id = btn.dataset.productId;
    const name = btn.dataset.name;
    const price = Number(btn.dataset.price);
    const min = Number(btn.dataset.min) || 1;

    const card = btn.closest(".product-card");
    const qtyInput = card.querySelector(".qty-input");
    let qty = Number(qtyInput.value || 0);

    if (isNaN(qty) || qty < min) {
      qty = min;
      qtyInput.value = min;
    }

    const existing = cart.find((item) => item.id === id);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({
        id,
        name,
        price,
        qty,
        sku: card.querySelector(".product-sku")?.textContent.replace("SKU: ", "") || "",
      });
    }

    saveCart(cart);
    renderCart();
  }

  addButtons.forEach((btn) => {
    btn.addEventListener("click", () => addToCartFromButton(btn));
  });

  checkoutBtn.addEventListener("click", () => {
    window.location.href = "checkout.html";
  });

  renderCart();
}

function setupCheckoutPage(cart) {
  const itemsEl = document.getElementById("summaryItems");
  const totalEl = document.getElementById("summaryTotal");
  const form = document.getElementById("checkoutForm");

  let total = 0;
  itemsEl.innerHTML = "";

  if (cart.length === 0) {
    itemsEl.innerHTML =
      '<p class="cart-empty">Your cart is empty. Go back to the catalog to add items.</p>';
  } else {
    cart.forEach((item) => {
      const line = item.qty * item.price;
      total += line;

      const div = document.createElement("div");
      div.className = "summary-item";
      div.innerHTML = `
        <span>${item.name} (${item.qty} × ${formatMoney(item.price)})</span>
        <span>${formatMoney(line)}</span>
      `;
      itemsEl.appendChild(div);
    });
  }

  totalEl.textContent = formatMoney(total);

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
      "img/cue-cube-grey-353-3.jpg",
    ],
    nickel418: [
      "img/cue-cube-grey-418-1.jpg",
      "img/cue-cube-grey-418-2.jpg",
      "img/cue-cube-grey-418-3.jpg",
    ],
    keychain: [
      "img/cue-cube-keychain-418-1.jpg",
      "img/cue-cube-keychain-418-2.jpg",
      "img/cue-cube-keychain-418-3.jpg",
    ],
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

      imgs.forEach((src, index) => {
        const img = document.createElement("img");
        img.src = src;
        img.className = "modal-thumb" + (index === 0 ? " active" : "");
        img.addEventListener("click", () => {
          mainImg.src = src;
          thumbsContainer
            .querySelectorAll(".modal-thumb")
            .forEach((t) => t.classList.remove("active"));
          img.classList.add("active");
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
