
// ===== Auth (simple demo) =====
const DEMO_EMAIL = "demo@cuecube.com";
const DEMO_PASSWORD = "Qwerty142536"; // per user request
const AUTH_KEY = "cuecubeLoggedIn";
const SEEN_KEY = "cuecubeSeenLogin";

function setLoggedIn(flag){ flag ? localStorage.setItem(AUTH_KEY,"true") : localStorage.removeItem(AUTH_KEY); }
function isLoggedIn(){ return localStorage.getItem(AUTH_KEY) === "true"; }

document.addEventListener("DOMContentLoaded",()=>{
  const page = document.body.dataset.page;

  // Clear autofill on true first-visit for new browsers
  if(page === "index"){
    const email = document.getElementById("loginEmail");
    const pass = document.getElementById("loginPassword");
    if(!localStorage.getItem(SEEN_KEY)){
      if(email) email.value = "";
      if(pass) pass.value = "";
      localStorage.setItem(SEEN_KEY,"1");
    }
    const form = document.getElementById("loginForm");
    const errorEl = document.getElementById("loginError");
    form.addEventListener("submit",(e)=>{
      e.preventDefault();
      const ok = email.value.trim() === DEMO_EMAIL && pass.value === DEMO_PASSWORD;
      if(ok){ setLoggedIn(true); location.href = "products.html"; } else { errorEl.style.display = "block"; }
    });
    return;
  }

  // Redirect protection
  if ((page === "products" || page === "checkout") && !isLoggedIn()) {
    location.href = "index.html"; return;
  }

  // Logout buttons
  [document.getElementById("logoutBtn"), document.getElementById("logoutBtnCheckout")].forEach(btn=>{
    if(btn) btn.addEventListener("click",()=>{ setLoggedIn(false); location.href="index.html"; });
  });

  // Cart / checkout
  if(page === "products" || page === "checkout"){ initCartAndCheckout(page); }
});

// ===== Cart + checkout =====
const CART_KEY = "cuecubeCart";
function loadCart(){ try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch{ return []; } }
function saveCart(items){ localStorage.setItem(CART_KEY, JSON.stringify(items)); }
function formatMoney(n){ return "$" + n.toFixed(2); }

function initCartAndCheckout(page){
  const cart = loadCart();
  if(page === "products"){ setupProductsPage(cart); }
  if(page === "checkout"){ setupCheckoutPage(cart); }
}

function setupProductsPage(cart){
  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");
  const addButtons = document.querySelectorAll(".add-btn");
  const checkoutBtn = document.getElementById("checkoutBtn");

  function renderCart(){
    cartItemsEl.innerHTML = "";
    let total = 0;
    if(cart.length===0){
      cartItemsEl.innerHTML = '<p class="cart-empty">No items yet. Add quantities from the catalog.</p>';
    }else{
      cart.forEach(it=>{
        const line = it.qty * it.price; total += line;
        const div = document.createElement("div");
        div.className = "cart-item";
        div.innerHTML = '<div><div class="product-name">'+it.name+'</div><div class="product-sku">'+(it.sku||"")+' • '+it.qty+' × '+formatMoney(it.price)+'</div></div><div>'+formatMoney(line)+'</div>';
        cartItemsEl.appendChild(div);
      });
    }
    cartTotalEl.textContent = formatMoney(total);
  }

  function add(btn){
    const card = btn.closest(".product-card");
    const qty = Math.max(parseInt(card.querySelector(".qty-input").value||0,10), 10);
    const id = btn.dataset.productId;
    const name = btn.dataset.name;
    const price = Number(btn.dataset.price);

    const existing = cart.find(x=>x.id===id);
    if(existing){ existing.qty += qty; } else {
      cart.push({id,name,price,qty, sku: card.querySelector(".product-sku")?.textContent.replace("SKU: ","") || ""});
    }
    saveCart(cart); renderCart();
  }

  addButtons.forEach(b=>b.addEventListener("click",()=>add(b)));
  checkoutBtn.addEventListener("click",()=> location.href="checkout.html");
  renderCart();
}

async function setupCheckoutPage(cart){
  const itemsEl = document.getElementById("summaryItems");
  const totalEl = document.getElementById("summaryTotal");
  const form = document.getElementById("checkoutForm");
  const ratesBox = document.getElementById("ratesBox");

  let total = 0; itemsEl.innerHTML = "";
  if(cart.length===0){
    itemsEl.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
  }else{
    cart.forEach(it=>{
      const line = it.qty * it.price; total += line;
      const div = document.createElement("div");
      div.className = "summary-item";
      div.innerHTML = '<span>'+it.name+' ('+it.qty+' × '+formatMoney(it.price)+')</span><span>'+formatMoney(line)+'</span>';
      itemsEl.appendChild(div);
    });
  }
  totalEl.textContent = formatMoney(total);

  // Load rates once the user leaves the postal/city/state fields
  const addressFields = ["address1","address2","city","state","postalCode","country"];
  addressFields.forEach(n=>{
    const el = form.querySelector('[name="'+n+'"]');
    el.addEventListener("change", ()=>rateIt());
    el.addEventListener("blur", ()=>rateIt());
  });

  let selectedRate = null;

  async function rateIt(){
    const payload = {
      to: {
        name: (form.firstName.value+' '+form.lastName.value).trim() || "Dealer",
        company: form.company.value || undefined,
        address1: form.address1.value,
        address2: form.address2.value || undefined,
        city: form.city.value,
        state: form.state.value,
        postalCode: form.postalCode.value,
        country: form.country.value || "US",
        phone: form.phone.value || "0000000000",
        email: form.email.value || "dealer@example.com"
      },
      // Defaults per user request
      package: {
        weightLb: 10,
        dimIn: { length: 10, width: 10, height: 10 }
      },
      cartValue: total
    };
    if(!payload.to.address1 || !payload.to.city || !payload.to.state || !payload.to.postalCode) return;

    ratesBox.innerHTML = '<div style="color:#9fb7ad">Loading live rates…</div>';
    try{
      const res = await fetch("/api/rates", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
      if(!res.ok) throw new Error("Bad response");
      const data = await res.json();
      if(!Array.isArray(data) || data.length===0){ throw new Error("No rates"); }
      ratesBox.innerHTML = "";
      data.forEach((r,idx)=>{
        const el = document.createElement("div");
        el.className = "ship-rate";
        el.dataset.index = idx;
        el.innerHTML = '<div><strong>'+r.carrier+' • '+r.service+'</strong><div style="color:#9fb7ad;font-size:13px">'+(r.eta || "No ETA")+'</div></div><div><strong>'+formatMoney(r.amount)+'</strong></div>';
        el.addEventListener("click",()=>{
          selectedRate = r;
          ratesBox.querySelectorAll(".ship-rate").forEach(x=>x.classList.remove("active"));
          el.classList.add("active");
        });
        ratesBox.appendChild(el);
      });
      // preselect cheapest
      const list = ratesBox.querySelectorAll(".ship-rate");
      if(list.length){ list[0].click(); }
    }catch(e){
      ratesBox.innerHTML = '<div style="color:#ffb4b4">Could not load rates. We will confirm shipping manually.</div>';
      selectedRate = null;
    }
  }

  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    alert("Order request submitted. Shipping: "+(selectedRate ? (selectedRate.carrier+' '+selectedRate.service+' '+formatMoney(selectedRate.amount)) : "TBD by sales")+". We will contact you to confirm pricing and shipping.");
    localStorage.removeItem(CART_KEY);
    location.href = "products.html";
  });
}
