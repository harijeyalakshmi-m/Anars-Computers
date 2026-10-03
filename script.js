/* =====================================================
   ANARS COMPUTERS - SINGLE PAGE MERGED APP SCRIPT
===================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_EMAIL = "mharijeyalakshmi@gmail.com"; 

let currentUser = null;
let isRegisterMode = false;
let products = [];
let storeBrands = ["ASUS", "HP", "LENOVO", "DELL", "KINGSTON", "CORSAIR", "SAMSUNG", "HIKVISION"];
let storeCategories = ["Laptops", "Computers", "RAM", "Storage", "Motherboard", "CCTV", "Bluetooth"];

let brandLogos = [];
let isMarqueeEnabled = true;

let currentCategory = "All";
let currentBrand = "All";
let currentSearch = "";
let wishlist = [];
let cart = [];
let orders = []; 
let allUsersOrders = []; // For Admin View
let productReviews = JSON.parse(localStorage.getItem("anarsProductReviews") || "{}");
let currentSlide = 0;

document.addEventListener("DOMContentLoaded", async function () {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('active'); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal, .reveal-zoom').forEach((el) => { observer.observe(el); });

    await loadStoreMetadata();
    await loadProductsFromFirebase();
    setupHeroSlider();
});

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const authBtnContainer = document.getElementById("authButtonContainer");

    if (user) {
        const isAdmin = (user.email === ADMIN_EMAIL);
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            cart = data.cart || [];
            wishlist = data.wishlist || [];
            orders = data.orders || []; 
        } else {
            await setDoc(userDocRef, { email: user.email, name: "", phone: "", cart: [], wishlist: [], orders: [] });
            cart = []; wishlist = []; orders = [];
        }

        if (isAdmin) {
            await loadAllUsersOrdersForAdmin();
        }

        if (authBtnContainer) {
            authBtnContainer.innerHTML = `
                <button class="profile-icon-btn" id="profileToggleBtn" aria-label="My Profile">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </button>
                <div id="profileDropdownMenu" class="profile-dropdown-menu">
                    <button onclick="openAccountModal()">My Profile</button>
                    ${isAdmin ? `<button onclick="showPage('admin')" style="color:#16a34a; font-weight:800;">⚙️ Admin Dashboard</button>` : ''}
                    <button onclick="handleLogout()" style="color:#dc2626;">Logout</button>
                </div>
            `;
            document.getElementById("profileToggleBtn").addEventListener("click", (e) => {
                e.stopPropagation(); toggleProfileDropdown();
            });
        }
    } else {
        if (authBtnContainer) {
            authBtnContainer.innerHTML = `
                <button class="profile-icon-btn" id="loginToggleBtn" aria-label="Login">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                </button>
            `;
            document.getElementById("loginToggleBtn").addEventListener("click", () => { openAuthModal(); });
        }
        cart = []; wishlist = []; orders = [];
    }
    updateCounters();
    if (document.getElementById("cartPage").classList.contains("active")) renderCartPage();
    if (document.getElementById("wishlistPage").classList.contains("active")) renderWishlistPage();
    if (document.getElementById("ordersPage").classList.contains("active")) renderMyOrdersPage();
});

async function saveUserDataToCloud() {
    if (!currentUser) return;
    try { await updateDoc(doc(db, "users", currentUser.uid), { cart, wishlist, orders }); } 
    catch (e) { console.error("Error saving to cloud:", e); }
}

window.addEventListener("click", () => { const menu = document.getElementById("profileDropdownMenu"); if (menu) menu.classList.remove("active"); });
window.toggleProfileDropdown = function() { const menu = document.getElementById("profileDropdownMenu"); if (menu) menu.classList.toggle("active"); };

window.openAuthModal = function() { document.getElementById("authModal").classList.add("active"); };
window.closeAuthModal = function() { document.getElementById("authModal").classList.remove("active"); };

window.toggleAuthMode = function() {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById("authModalTitle");
    const btn = document.getElementById("authSubmitBtn");
    const switchText = document.getElementById("authSwitchText");

    if (isRegisterMode) {
        title.textContent = "Create New Account"; btn.textContent = "Register Account"; switchText.textContent = "Already have an account?";
    } else {
        title.textContent = "Customer Login"; btn.textContent = "Login to Store"; switchText.textContent = "Don't have an account?";
    }
};

window.handleEmailAuth = async function(event) {
    event.preventDefault();
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value.trim();
    try {
        if (isRegisterMode) {
            const res = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", res.user.uid), { email, name: "", phone: "", cart: [], wishlist: [], orders: [] });
            alert("Account registered successfully!");
            closeAuthModal();
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            alert("Logged in successfully!");
            closeAuthModal();
        }
    } catch (e) { console.error("Auth Error:", e); alert("Authentication failed: " + e.message); }
};

window.handleLogout = async function() {
    try { await signOut(auth); alert("Logged out successfully."); showPage('home'); } 
    catch (e) { console.error("Logout Error:", e); }
};

window.openAccountModal = async function() {
    const menu = document.getElementById("profileDropdownMenu");
    if (menu) menu.classList.remove("active");
    if (!currentUser) return;

    const modal = document.getElementById("accountModal");
    const content = document.getElementById("accountModalContent");
    const userDocRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userDocRef);
    const data = snap.exists() ? snap.data() : {};

    content.innerHTML = `
        <div class="fs-profile-group"><label>Full Legal Name</label><input type="text" id="profName" value="${data.name || ''}" placeholder="Enter your full name"></div>
        <div class="fs-profile-group"><label>Primary Email Address</label><input type="email" value="${currentUser.email}" disabled style="background:#e2e8f0; cursor:not-allowed; color:#64748b;"></div>
        <div class="fs-profile-group"><label>Mobile Number</label><input type="tel" id="profPhone" value="${data.phone || ''}" placeholder="10-digit mobile number"></div>
        <div class="fs-profile-group"><label>Secure User ID</label><input type="text" value="${currentUser.uid}" disabled style="background:#e2e8f0; font-size:12px; cursor:not-allowed; color:#64748b;"></div>
    `;
    modal.classList.add("active");
};

window.saveUserProfile = async function() {
    if (!currentUser) return;
    const name = document.getElementById("profName").value.trim();
    const phone = document.getElementById("profPhone").value.trim();
    try { await updateDoc(doc(db, "users", currentUser.uid), { name, phone }); alert("Profile updated successfully!"); closeAccountModal(); } 
    catch (e) { console.error("Error updating profile:", e); alert("Failed to update profile."); }
};
window.closeAccountModal = function() { document.getElementById("accountModal").classList.remove("active"); };

async function loadStoreMetadata() {
    try {
        const metaRef = doc(db, "store_metadata", "config");
        const snap = await getDoc(metaRef);
        if (snap.exists()) {
            const data = snap.data();
            if (data.brands) storeBrands = data.brands;
            if (data.categories) storeCategories = data.categories;
            if (data.brandLogos) brandLogos = data.brandLogos;
            if (data.isMarqueeEnabled !== undefined) isMarqueeEnabled = data.isMarqueeEnabled;
            if (data.uiTheme) { document.body.setAttribute('data-theme', data.uiTheme); }
        }
    } catch (e) { console.error("Error loading metadata: ", e); }
    renderBrandFilters(); renderCategoriesGrid(); renderBrandLogosFrontEnd();
}

function renderBrandLogosFrontEnd() {
    const section = document.getElementById("brandsLogoSection");
    const trackWrapper = document.getElementById("brandLogosTrack");
    if (!section || !trackWrapper) return;
    if (brandLogos.length === 0) { section.style.display = "none"; return; }
    section.style.display = "block";
    const sortedLogos = [...brandLogos].sort((a, b) => a.pos - b.pos);
    let html = sortedLogos.map(l => `<div class="brand-logo-item" title="${l.name}"><img src="${l.url}" alt="${l.name}" width="120" height="40" loading="lazy"></div>`).join("");
    if (isMarqueeEnabled) { trackWrapper.innerHTML = `<div class="brand-track-inner">${html}</div><div class="brand-track-inner">${html}</div>`; trackWrapper.className = "brand-track marquee-active"; } 
    else { trackWrapper.innerHTML = html; trackWrapper.className = "brand-track static"; }
}

async function loadProductsFromFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        products = [];
        querySnapshot.forEach((docSnap) => { products.push({ id: docSnap.id, ...docSnap.data() }); });
        renderProducts();
        renderAdminProductsList();
    } catch (e) { console.error("Error loading products: ", e); }
}

function renderBrandFilters() {
    const brandContainer = document.getElementById("brandFilters");
    if (!brandContainer) return;
    brandContainer.innerHTML = `<button onclick="filterBrand('All')" class="${currentBrand === 'All' ? 'active' : ''}">All Brands</button>` +
        storeBrands.map(b => `<button onclick="filterBrand('${b}')" class="${currentBrand.toLowerCase() === b.toLowerCase() ? 'active' : ''}">${b}</button>`).join("");
}

function renderCategoriesGrid() {
    const catContainer = document.getElementById("categoryGridContainer");
    if (!catContainer) return;
    const stockImages = { "Laptops": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=700&q=80", "Computers": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=700&q=80", "RAM": "https://images.unsplash.com/photo-1592664474505-51c549ad15c5?auto=format&fit=crop&w=700&q=80", "Storage": "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=700&q=80", "Motherboard": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=700&q=80", "CCTV": "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=700&q=80", "Bluetooth": "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=700&q=80" };
    catContainer.innerHTML = storeCategories.map(cat => {
        const img = stockImages[cat] || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=700&q=80";
        return `<button onclick="filterCategory('${cat}')" class="category-card"><div class="category-image"><img src="${img}" alt="${cat}" loading="lazy" width="200" height="150"></div><div><h3>${cat}</h3><p>Verified Stock</p></div></button>`;
    }).join("");
}

function showPage(pageId) {
    if (pageId === 'admin') {
        if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
            alert("🔒 Unauthorized access! Admin only.");
            return;
        }
        renderAdminProductsList();
        renderAdminOrdersList();
    }

    if ((pageId === 'cart' || pageId === 'wishlist' || pageId === 'orders') && !currentUser) {
        alert("🔒 Please login to access your cart, wishlist & orders!"); return openAuthModal();
    }
    document.querySelectorAll(".page-view").forEach(page => page.classList.remove("active"));
    if (pageId === 'home') document.getElementById("homePage").classList.add("active");
    else if (pageId === 'detail') document.getElementById("detailPage").classList.add("active");
    else if (pageId === 'cart') { renderCartPage(); document.getElementById("cartPage").classList.add("active"); }
    else if (pageId === 'wishlist') { renderWishlistPage(); document.getElementById("wishlistPage").classList.add("active"); }
    else if (pageId === 'checkout') { renderCheckoutSummary(); document.getElementById("checkoutPage").classList.add("active"); }
    else if (pageId === 'success') { document.getElementById("successPage").classList.add("active"); }
    else if (pageId === 'orders') { renderMyOrdersPage(); document.getElementById("ordersPage").classList.add("active"); }
    else if (pageId === 'admin') document.getElementById("adminPage").classList.add("active");
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderProducts() {
    const grid = document.getElementById("productGrid");
    const noProducts = document.getElementById("noProducts");
    const heading = document.getElementById("productHeading");
    let filtered = products.filter(product => {
        const categoryMatch = currentCategory === "All" || product.category === currentCategory;
        const brandMatch = currentBrand === "All" || product.brand.toLowerCase() === currentBrand.toLowerCase();
        const searchText = currentSearch.toLowerCase();
        const searchMatch = searchText === "" || product.name.toLowerCase().includes(searchText) || product.brand.toLowerCase().includes(searchText) || product.category.toLowerCase().includes(searchText);
        return categoryMatch && brandMatch && searchMatch;
    });

    heading.textContent = currentCategory === "All" ? "All Products" : currentCategory;
    if (filtered.length === 0) { grid.innerHTML = ""; noProducts.style.display = "block"; return; }
    noProducts.style.display = "none";
    grid.innerHTML = filtered.map(product => {
        const isWishlisted = wishlist.includes(product.id);
        const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        return `
            <article class="product-card">
                <div class="product-image"><img src="${product.image}" alt="${product.name}" onerror="imageFallback(this)" loading="lazy" width="300" height="220"><button class="wishlist-button ${isWishlisted ? "active" : ""}" onclick="toggleWishlist('${product.id}')" aria-label="Toggle Wishlist">♥</button></div>
                <div class="product-info"><div class="product-brand">${product.brand}</div><h3 onclick="openProductDetail('${product.id}')">${product.name}</h3><div class="product-price">₹${Number(product.price).toLocaleString("en-IN")} <span style="font-size:12px; color:#94a3b8; text-decoration:line-through; margin-left:6px;">₹${Number(product.originalPrice).toLocaleString("en-IN")}</span> <span style="font-size:12px; color:#16a34a; margin-left:6px; font-weight:700;">${discount}% off</span></div><div class="product-actions"><button class="details-btn" onclick="openProductDetail('${product.id}')">Details</button><button class="cart-btn" onclick="addToCart('${product.id}')">Add to Cart</button></div></div>
            </article>
        `;
    }).join("");
    renderBrandFilters();
}

function filterCategory(category) { currentCategory = category; currentBrand = "All"; currentSearch = ""; document.getElementById("searchInput").value = ""; showPage('home'); renderProducts(); scrollToProducts(); }
function filterBrand(brand) { currentBrand = brand; renderProducts(); }
function searchProducts() { currentSearch = document.getElementById("searchInput").value.trim(); currentCategory = "All"; currentBrand = "All"; renderProducts(); }
function showAllProducts() { currentCategory = "All"; currentBrand = "All"; currentSearch = ""; document.getElementById("searchInput").value = ""; renderProducts(); }

function openProductDetail(id) {
    const product = products.find(item => item.id == id);
    if (!product) return;
    const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    const reviews = productReviews[id] || [];

    let reviewsHtml = reviews.length === 0 ? `<p style="color:#64748b; font-size:13px; margin-top:10px;">No reviews yet.</p>` : 
        reviews.map(r => `<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px; margin-top:10px;"><div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700;"><span>${r.name}</span><span style="color:#d97706;">${'★'.repeat(r.rating)}</span></div><p style="font-size:13px; color:#475569; margin-top:4px;">${r.comment}</p></div>`).join("");

    document.getElementById("productDetailContainer").innerHTML = `
        <div class="full-detail-card">
            <div class="full-detail-img-box"><img src="${product.image}" alt="${product.name}" onerror="imageFallback(this)" loading="lazy" width="400" height="400"></div>
            <div class="full-detail-content">
                <span class="product-brand">${product.brand}</span><h2>${product.name}</h2>
                <div class="fk-price-row"><span class="fk-current-price">₹${Number(product.price).toLocaleString("en-IN")}</span><span class="fk-original-price">₹${Number(product.originalPrice).toLocaleString("en-IN")}</span><span class="fk-offer-tag">${discount}% Off</span></div>
                <div class="fk-highlights-box"><h4>Specifications</h4><p>${product.description}</p></div>
                <div class="fk-action-buttons"><button class="fk-add-cart-btn" onclick="addToCart('${product.id}')">ADD TO CART</button></div>
            </div>
        </div>
        <div class="admin-card" style="margin-top: 30px; background:white; padding:30px; border-radius:16px; border:1px solid #e2e8f0;">
            <h3>Customer Reviews</h3>
            <div style="max-height: 250px; overflow-y:auto; margin-bottom:20px;">${reviewsHtml}</div>
        </div>
    `;
    showPage('detail');
}

function toggleWishlist(id) {
    if (!currentUser) return openAuthModal();
    if (wishlist.includes(id)) wishlist = wishlist.filter(item => item !== id); else wishlist.push(id);
    saveUserDataToCloud(); updateCounters(); renderProducts();
    if (document.getElementById("wishlistPage").classList.contains("active")) renderWishlistPage();
}

function renderWishlistPage() {
    const content = document.getElementById("wishlistPageContent");
    if (!currentUser) return;
    const items = wishlist.map(id => products.find(product => product.id == id)).filter(Boolean);
    if (items.length === 0) { content.innerHTML = `<div class="fk-empty-cart"><h3>Your wishlist is empty!</h3></div>`; return; }
    content.innerHTML = items.map(product => `
        <div class="fk-cart-item-card">
            <img src="${product.image}" alt="${product.name}" width="100" height="100" style="object-fit:cover; border-radius:8px;">
            <div class="fk-cart-item-details">
                <h4>${product.name}</h4>
                <p>₹${Number(product.price).toLocaleString("en-IN")}</p>
                <button onclick="removeWishlist('${product.id}')" style="color:red; background:none; border:none; cursor:pointer;">Remove</button>
            </div>
        </div>`).join("");
}

function removeWishlist(id) { wishlist = wishlist.filter(item => item !== id); saveUserDataToCloud(); updateCounters(); renderWishlistPage(); renderProducts(); }

function addToCart(id) {
    if (!currentUser) return openAuthModal();
    const existing = cart.find(item => item.id == id);
    if (existing) existing.qty += 1; else cart.push({ id: id, qty: 1 });
    saveUserDataToCloud(); updateCounters();
    alert("Added to Cart!");
}

function updateCartQty(id, change) {
    const item = cart.find(i => i.id == id);
    if (item) { item.qty += change; if (item.qty <= 0) cart = cart.filter(i => i.id != id); }
    saveUserDataToCloud(); updateCounters(); renderCartPage();
}

function removeCartItem(id) { cart = cart.filter(i => i.id != id); saveUserDataToCloud(); updateCounters(); renderCartPage(); }

function renderCartPage() {
    const content = document.getElementById("cartPageContent");
    if (!currentUser) return;
    if (cart.length === 0) { content.innerHTML = `<div class="fk-empty-cart"><h3>Cart is empty!</h3></div>`; return; }

    let totalMRP = 0; let totalDiscountPrice = 0;
    let itemsHTML = cart.map(cartItem => {
        const product = products.find(p => p.id == cartItem.id);
        if (!product) return "";
        totalMRP += product.originalPrice * cartItem.qty; totalDiscountPrice += product.price * cartItem.qty;
        return `
            <div class="fk-cart-item-card" style="display:flex; gap:15px; align-items:center; background:white; padding:15px; border-radius:12px; margin-bottom:12px; border:1px solid #e2e8f0;">
                <img src="${product.image}" width="80" height="80" style="object-fit:cover; border-radius:8px;">
                <div style="flex:1;">
                    <h4>${product.name}</h4>
                    <p>₹${Number(product.price).toLocaleString("en-IN")} x ${cartItem.qty}</p>
                    <div style="display:flex; gap:10px; margin-top:8px;">
                        <button onclick="updateCartQty('${product.id}', -1)" style="padding:2px 8px;">-</button>
                        <span>${cartItem.qty}</span>
                        <button onclick="updateCartQty('${product.id}', 1)" style="padding:2px 8px;">+</button>
                        <button onclick="removeCartItem('${product.id}')" style="color:red; border:none; background:none; cursor:pointer; margin-left:15px;">Remove</button>
                    </div>
                </div>
            </div>`;
    }).join("");

    content.innerHTML = `<div class="fk-cart-layout">${itemsHTML}</div><button class="primary-btn" onclick="showPage('checkout')" style="margin-top:20px; padding:12px 24px;">Proceed to Checkout</button>`;
}

function renderCheckoutSummary() {
    let total = 0;
    cart.forEach(ci => { const p = products.find(x => x.id == ci.id); if(p) total += p.price * ci.qty; });
    document.getElementById("checkoutSummarySidebar").innerHTML = `<h4>Payable Amount: <strong>₹${total.toLocaleString("en-IN")}</strong></h4>`;
}

async function submitOrder(event) {
    event.preventDefault();
    if (!currentUser) return;
    const name = document.getElementById("shipName").value.trim();
    const phone = document.getElementById("shipPhone").value.trim();
    const address = document.getElementById("shipAddress").value.trim();
    const orderId = "ANARS-" + Math.floor(1000 + Math.random() * 9000);

    const newOrder = { orderId, date: new Date().toLocaleDateString('en-IN'), name, phone, address, items: [...cart], statusIndex: 1, userId: currentUser.uid };
    
    orders.unshift(newOrder); 
    cart = []; 
    await saveUserDataToCloud(); 
    updateCounters();
    document.getElementById("confirmedOrderId").textContent = orderId; 
    showPage('success');
}

function renderMyOrdersPage() {
    const container = document.getElementById("myOrdersListContainer");
    if (!currentUser || orders.length === 0) { container.innerHTML = `<p>No orders found.</p>`; return; }
    container.innerHTML = orders.map(o => `
        <div style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0; margin-bottom:15px;">
            <h4>Order ID: #${o.orderId}</h4>
            <p>Date: ${o.date} | Status: ${o.statusIndex === 1 ? 'Order Placed' : 'Processed'}</p>
            <p>Address: ${o.address}</p>
        </div>`).join("");
}

// ================= ADMIN FUNCTIONS =================
window.switchAdminTab = function(tab) {
    if(tab === 'products') {
        document.getElementById("adminProductsSection").style.display = "block";
        document.getElementById("adminOrdersSection").style.display = "none";
        document.getElementById("adminTabProdBtn").className = "primary-btn";
        document.getElementById("adminTabOrdersBtn").className = "secondary-btn";
    } else {
        document.getElementById("adminProductsSection").style.display = "none";
        document.getElementById("adminOrdersSection").style.display = "block";
        document.getElementById("adminTabProdBtn").className = "secondary-btn";
        document.getElementById("adminTabOrdersBtn").className = "primary-btn";
    }
};

window.handleAddNewProduct = async function(event) {
    event.preventDefault();
    const name = document.getElementById("adminProdName").value.trim();
    const brand = document.getElementById("adminProdBrand").value.trim();
    const category = document.getElementById("adminProdCategory").value;
    const price = Number(document.getElementById("adminProdPrice").value);
    const originalPrice = Number(document.getElementById("adminProdOriginalPrice").value);
    const image = document.getElementById("adminProdImage").value.trim();
    const description = document.getElementById("adminProdDesc").value.trim();

    try {
        await addDoc(collection(db, "products"), { name, brand, category, price, originalPrice, image, description });
        alert("Product added successfully!");
        event.target.reset();
        await loadProductsFromFirebase();
    } catch(e) { console.error(e); alert("Failed to add product."); }
};

window.deleteProduct = async function(id) {
    if(confirm("Are you sure you want to delete this product?")) {
        try {
            await deleteDoc(doc(db, "products", id));
            alert("Product deleted.");
            await loadProductsFromFirebase();
        } catch(e) { alert("Failed to delete."); }
    }
};

function renderAdminProductsList() {
    const grid = document.getElementById("adminProductListGrid");
    if(!grid) return;
    grid.innerHTML = products.map(p => `
        <div style="background:white; padding:15px; border-radius:12px; border:1px solid #e2e8f0;">
            <img src="${p.image}" width="100%" height="150" style="object-fit:cover; border-radius:8px;">
            <h4 style="margin-top:10px;">${p.name}</h4>
            <p>₹${p.price} (${p.brand})</p>
            <button onclick="deleteProduct('${p.id}')" style="background:#dc2626; color:white; border:none; padding:6px 12px; border-radius:6px; margin-top:8px; cursor:pointer;">Delete Product</button>
        </div>`).join("");
}

async function loadAllUsersOrdersForAdmin() {
    try {
        const snap = await getDocs(collection(db, "users"));
        allUsersOrders = [];
        snap.forEach(d => {
            const data = d.data();
            if(data.orders && Array.isArray(data.orders)) {
                allUsersOrders.push(...data.orders);
            }
        });
        renderAdminOrdersList();
    } catch(e) { console.error(e); }
}

function renderAdminOrdersList() {
    const container = document.getElementById("adminOrdersListContainer");
    if(!container) return;
    if(allUsersOrders.length === 0) { container.innerHTML = `<p>No customer orders yet.</p>`; return; }
    container.innerHTML = allUsersOrders.map(o => `
        <div style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0; margin-bottom:15px;">
            <h4>Order ID: #${o.orderId}</h4>
            <p><strong>Customer:</strong> ${o.name} (${o.phone})</p>
            <p><strong>Address:</strong> ${o.address}</p>
            <p><strong>Date:</strong> ${o.date}</p>
        </div>`).join("");
}

function updateCounters() {
    const ordersLen = orders.filter(o => o.statusIndex !== 0).length;
    const cartLen = cart.reduce((sum, item) => sum + item.qty, 0);
    const wishLen = wishlist.length;

    if(document.getElementById("wishlistCount")) document.getElementById("wishlistCount").textContent = wishLen;
    if(document.getElementById("cartCount")) document.getElementById("cartCount").textContent = cartLen;
    if(document.getElementById("ordersCount")) document.getElementById("ordersCount").textContent = ordersLen;
}

window.showPage = showPage; window.filterCategory = filterCategory; window.filterBrand = filterBrand; window.searchProducts = searchProducts; window.showAllProducts = showAllProducts; window.openProductDetail = openProductDetail; window.toggleWishlist = toggleWishlist; window.removeWishlist = removeWishlist; window.addToCart = addToCart; window.updateCartQty = updateCartQty; window.removeCartItem = removeCartItem; window.submitOrder = submitOrder; window.openAuthModal = openAuthModal; window.closeAuthModal = closeAuthModal; window.toggleAuthMode = toggleAuthMode; window.handleEmailAuth = handleEmailAuth; window.handleLogout = handleLogout; window.toggleProfileDropdown = toggleProfileDropdown; window.openAccountModal = openAccountModal; window.closeAccountModal = closeAccountModal; window.saveUserProfile = saveUserProfile;
