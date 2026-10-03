/* =====================================================
   ANARS COMPUTERS - MERGED SINGLE PAGE APP & ADMIN ENGINE
===================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_EMAIL = "marijeyalakshmi@gmail.com"; 

let currentUser = null;
let isRegisterMode = false;
let products = [];
let cachedProducts = [];
let storeBrands = ["ASUS", "HP", "LENOVO", "DELL", "KINGSTON", "CORSAIR", "SAMSUNG", "HIKVISION"];
let storeCategories = ["Laptops", "Computers", "RAM", "Storage", "Motherboard", "CCTV", "Bluetooth"];

let brandLogos = [];
let isMarqueeEnabled = true;
let uiTheme = "modern";

let currentCategory = "All";
let currentBrand = "All";
let currentSearch = "";
let wishlist = [];
let cart = [];
let orders = [];
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
        const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
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
    if (document.getElementById("cartPage") && document.getElementById("cartPage").classList.contains("active")) renderCartPage();
    if (document.getElementById("wishlistPage") && document.getElementById("wishlistPage").classList.contains("active")) renderWishlistPage();
    if (document.getElementById("ordersPage") && document.getElementById("ordersPage").classList.contains("active")) renderMyOrdersPage();
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
    if (isRegisterMode) { title.textContent = "Create New Account"; btn.textContent = "Register Account"; switchText.textContent = "Already have an account?"; } 
    else { title.textContent = "Customer Login"; btn.textContent = "Login to Store"; switchText.textContent = "Don't have an account?"; }
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
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            alert("Logged in successfully!");
        }
        closeAuthModal();
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
            if (data.uiTheme) { 
                uiTheme = data.uiTheme;
                document.body.setAttribute('data-theme', uiTheme); 
            }
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
    
    if (isMarqueeEnabled) { 
        trackWrapper.innerHTML = `<div class="brand-track brand-track-inner">${html}${html}</div>`; 
        trackWrapper.className = "brand-track-wrapper brand-track marquee-active"; 
    } else { 
        trackWrapper.innerHTML = `<div class="brand-track static">${html}</div>`; 
    }
}

async function loadProductsFromFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        products = [];
        querySnapshot.forEach((docSnap) => { products.push({ id: docSnap.id, ...docSnap.data() }); });
        renderProducts();
        if(document.getElementById("adminProductsTableBody")) loadAdminProducts();
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

window.showPage = function(pageId) {
    if ((pageId === 'cart' || pageId === 'wishlist' || pageId === 'orders') && !currentUser) {
        alert("🔒 Please login to access your cart, wishlist & orders!"); return openAuthModal();
    }
    if (pageId === 'admin' && (!currentUser || currentUser.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase())) {
        alert("Access denied! Admins only."); return;
    }
    document.querySelectorAll(".page-view").forEach(page => page.classList.remove("active"));
    if (pageId === 'home') document.getElementById("homePage").classList.add("active");
    else if (pageId === 'detail') document.getElementById("detailPage").classList.add("active");
    else if (pageId === 'cart') { renderCartPage(); document.getElementById("cartPage").classList.add("active"); }
    else if (pageId === 'wishlist') { renderWishlistPage(); document.getElementById("wishlistPage").classList.add("active"); }
    else if (pageId === 'checkout') { renderCheckoutSummary(); document.getElementById("checkoutPage").classList.add("active"); }
    else if (pageId === 'success') { document.getElementById("successPage").classList.add("active"); }
    else if (pageId === 'orders') { renderMyOrdersPage(); document.getElementById("ordersPage").classList.add("active"); }
    else if (pageId === 'admin') { document.getElementById("adminPage").classList.add("active"); loadAdminOrders(); loadAdminProducts(); loadAdminBrandLogos(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderProducts() {
    const grid = document.getElementById("productGrid");
    const noProducts = document.getElementById("noProducts");
    const heading = document.getElementById("productHeading");
    if (!grid) return;

    let filtered = products.filter(product => {
        const categoryMatch = currentCategory === "All" || product.category === currentCategory;
        const brandMatch = currentBrand === "All" || product.brand.toLowerCase() === currentBrand.toLowerCase();
        const searchText = currentSearch.toLowerCase();
        const searchMatch = searchText === "" || product.name.toLowerCase().includes(searchText) || product.brand.toLowerCase().includes(searchText) || product.category.toLowerCase().includes(searchText);
        return categoryMatch && brandMatch && searchMatch;
    });

    if (heading) heading.textContent = currentCategory === "All" ? "All Products" : currentCategory;
    if (filtered.length === 0) { grid.innerHTML = ""; if(noProducts) noProducts.style.display = "block"; return; }
    if(noProducts) noProducts.style.display = "none";
    
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

window.filterCategory = function(category) { currentCategory = category; currentBrand = "All"; currentSearch = ""; const sInput = document.getElementById("searchInput"); if(sInput) sInput.value = ""; showPage('home'); renderProducts(); scrollToProducts(); };
window.filterBrand = function(brand) { currentBrand = brand; renderProducts(); };
window.searchProducts = function() { const sInput = document.getElementById("searchInput"); if(sInput) currentSearch = sInput.value.trim(); currentCategory = "All"; currentBrand = "All"; renderProducts(); };
window.searchProductsMobile = function() { const mInput = document.getElementById("mobileSearchInputSidebar"); if(mInput) currentSearch = mInput.value.trim(); currentCategory = "All"; currentBrand = "All"; showPage('home'); renderProducts(); toggleMobileMenu(); scrollToProducts(); };
window.showAllProducts = function() { currentCategory = "All"; currentBrand = "All"; currentSearch = ""; const sInput = document.getElementById("searchInput"); if(sInput) sInput.value = ""; renderProducts(); };

window.openProductDetail = function(id) {
    const product = products.find(item => item.id == id);
    if (!product) return;
    const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    const reviews = productReviews[id] || [];

    let reviewsHtml = reviews.length === 0 ? `<p style="color:#64748b; font-size:13px; margin-top:10px;">No reviews yet. Be the first to review this product!</p>` : 
        reviews.map(r => `<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px; margin-top:10px;"><div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; color:#0f172a;"><span>${r.name}</span><span style="color:#d97706;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></div><p style="font-size:13px; color:#475569; margin-top:4px;">${r.comment}</p></div>`).join("");

    const detailContainer = document.getElementById("productDetailContainer");
    if(detailContainer) {
        detailContainer.innerHTML = `
            <div class="full-detail-card">
                <div class="full-detail-img-box"><img src="${product.image}" alt="${product.name}" onerror="imageFallback(this)" loading="lazy" width="400" height="400"></div>
                <div class="full-detail-content">
                    <span class="product-brand">${product.brand}</span><h2>${product.name}</h2>
                    <div><span class="fk-rating-badge">5.0 Star Store</span><span style="font-size:13px; color:#64748b; margin-left:8px;">Annai Complex, Kuthukalvalasai</span></div>
                    <div class="fk-price-row"><span class="fk-current-price">₹${Number(product.price).toLocaleString("en-IN")}</span><span class="fk-original-price">₹${Number(product.originalPrice).toLocaleString("en-IN")}</span><span class="fk-offer-tag">${discount}% Off</span></div>
                    <div class="fk-highlights-box"><h4>Product Overview & Specifications</h4><p>${product.description}</p></div>
                    <div class="fk-action-buttons"><button class="fk-add-cart-btn" onclick="addToCart('${product.id}')">ADD TO CART</button><button class="fk-buy-btn" onclick="addToCart('${product.id}'); showPage('cart')">PROCEED TO CART</button></div>
                </div>
            </div>
            <div class="admin-card" style="margin-top: 30px; background:white; padding:30px; border-radius:16px; border:1px solid #e2e8f0;">
                <h3 style="font-size:18px; font-weight:800; color:#0f172a; margin-bottom:15px;">Customer Reviews & Ratings</h3>
                <div style="max-height: 250px; overflow-y:auto; margin-bottom:20px;">${reviewsHtml}</div>
                <h4 style="font-size:14px; font-weight:700; color:#334155; margin-bottom:10px;">Write a Review</h4>
                <form onsubmit="submitProductReview(event, '${product.id}')" style="display:flex; flex-direction:column; gap:12px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;"><input type="text" id="revName" placeholder="Your Name" required style="padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;"><select id="revRating" required style="padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; font-weight:600;"><option value="5">5 Stars - Excellent</option><option value="4">4 Stars - Very Good</option><option value="3">3 Stars - Good</option></select></div>
                    <textarea id="revComment" placeholder="Write your feedback..." rows="3" required style="padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; outline:none; font-family:inherit;"></textarea>
                    <button type="submit" class="primary-btn" style="width:max-content; padding:10px 20px;">Post Review</button>
                </form>
            </div>
        `;
    }
    showPage('detail');
};

window.submitProductReview = function(event, productId) {
    event.preventDefault();
    if (!currentUser) { alert("🔒 Please login to post a review!"); return openAuthModal(); }
    const name = document.getElementById("revName").value.trim();
    const rating = Number(document.getElementById("revRating").value);
    const comment = document.getElementById("revComment").value.trim();
    if (!productReviews[productId]) productReviews[productId] = [];
    productReviews[productId].unshift({ name, rating, comment });
    localStorage.setItem("anarsProductReviews", JSON.stringify(productReviews));
    alert("Review submitted successfully!"); openProductDetail(productId);
};

window.toggleWishlist = function(id) {
    if (!currentUser) { alert("🔒 Please login to save items to your wishlist!"); return openAuthModal(); }
    if (wishlist.includes(id)) wishlist = wishlist.filter(item => item !== id); else wishlist.push(id);
    saveUserDataToCloud(); updateCounters(); renderProducts();
    const wPage = document.getElementById("wishlistPage");
    if (wPage && wPage.classList.contains("active")) renderWishlistPage();
};

function renderWishlistPage() {
    const content = document.getElementById("wishlistPageContent");
    if (!content) return;
    if (!currentUser) { content.innerHTML = `<div class="fk-empty-cart"><h3>Please login to view your wishlist!</h3><button class="primary-btn" style="margin:20px auto 0;" onclick="openAuthModal()">Login</button></div>`; return; }
    const items = wishlist.map(id => products.find(product => product.id == id)).filter(Boolean);
    if (items.length === 0) { content.innerHTML = `<div class="fk-empty-cart"><h3>Your wishlist is empty!</h3><button class="primary-btn" style="margin:20px auto 0;" onclick="showPage('home')">Browse Store</button></div>`; return; }
    
    content.innerHTML = items.map(product => {
        const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        return `
        <div class="fk-cart-item-card">
            <div class="fk-cart-img-wrapper" style="border:none; padding:0; margin:0;"><img src="${product.image}" alt="${product.name}" class="fk-cart-item-img" onerror="imageFallback(this)" loading="lazy" width="120" height="120"></div>
            <div class="fk-cart-item-details">
                <h4 onclick="openProductDetail('${product.id}')">${product.name}</h4>
                <div class="seller">Seller: Anars Computers • ${product.brand}</div>
                <div class="fk-cart-price-row"><span class="fk-cart-price">₹${Number(product.price).toLocaleString("en-IN")}</span><span class="fk-cart-mrp">₹${Number(product.originalPrice).toLocaleString("en-IN")}</span><span class="fk-cart-discount">${discount}% Off</span></div>
                <div class="fk-action-links">
                    <button onclick="removeWishlist('${product.id}')" class="fk-text-btn text-danger" style="color:#dc2626;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> REMOVE</button>
                    <button onclick="addToCart('${product.id}'); removeWishlist('${product.id}');" class="fk-text-btn" style="color:#2563eb;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg> MOVE TO CART</button>
                </div>
            </div>
        </div>
    `}).join("");
}

window.removeWishlist = function(id) { if (!currentUser) return; wishlist = wishlist.filter(item => item !== id); saveUserDataToCloud(); updateCounters(); renderWishlistPage(); renderProducts(); };

window.addToCart = function(id) {
    if (!currentUser) { alert("🔒 Please login to add items to your cart!"); return openAuthModal(); }
    const existing = cart.find(item => item.id == id);
    if (existing) existing.qty += 1; else cart.push({ id: id, qty: 1 });
    saveUserDataToCloud(); updateCounters();
    const button = document.activeElement;
    if (button && button.tagName === "BUTTON" && button.textContent.includes("CART")) { const oldText = button.innerHTML; button.innerHTML = "✓ ADDED"; setTimeout(() => { button.innerHTML = oldText; }, 1000); }
};

window.updateCartQty = function(id, change) {
    if (!currentUser) return;
    const item = cart.find(i => i.id == id);
    if (item) { item.qty += change; if (item.qty <= 0) cart = cart.filter(i => i.id != id); }
    saveUserDataToCloud(); updateCounters(); renderCartPage();
};

window.removeCartItem = function(id) { if (!currentUser) return; cart = cart.filter(i => i.id != id); saveUserDataToCloud(); updateCounters(); renderCartPage(); };

function renderCartPage() {
    const content = document.getElementById("cartPageContent");
    if (!content) return;
    if (!currentUser) { content.innerHTML = `<div class="fk-empty-cart"><h3>Please login to view your cart!</h3><button class="primary-btn" style="margin:20px auto 0;" onclick="openAuthModal()">Login</button></div>`; return; }
    if (cart.length === 0) { content.innerHTML = `<div class="fk-empty-cart"><h3>Your cart is empty!</h3><button class="primary-btn" style="margin:20px auto 0;" onclick="showPage('home')">Start Shopping</button></div>`; return; }

    let totalMRP = 0; let totalDiscountPrice = 0;
    let itemsHTML = cart.map(cartItem => {
        const product = products.find(p => p.id == cartItem.id);
        if (!product) return "";
        totalMRP += product.originalPrice * cartItem.qty; totalDiscountPrice += product.price * cartItem.qty;
        const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);

        return `
            <div class="fk-cart-item-card">
                <div class="fk-cart-img-wrapper">
                    <img src="${product.image}" alt="${product.name}" class="fk-cart-item-img" onerror="imageFallback(this)" loading="lazy" width="120" height="120">
                    <div class="fk-qty-controls"><button onclick="updateCartQty('${product.id}', -1)" aria-label="Decrease Quantity">-</button><span>${cartItem.qty}</span><button onclick="updateCartQty('${product.id}', 1)" aria-label="Increase Quantity">+</button></div>
                </div>
                <div class="fk-cart-item-details">
                    <h4 onclick="openProductDetail('${product.id}')">${product.name}</h4><div class="seller">Seller: Anars Computers</div>
                    <div class="fk-cart-price-row"><span class="fk-cart-price">₹${Number(product.price).toLocaleString("en-IN")}</span><span class="fk-cart-mrp">₹${Number(product.originalPrice).toLocaleString("en-IN")}</span><span class="fk-cart-discount">${discount}% Off</span></div>
                    <div class="fk-action-links"><button onclick="removeCartItem('${product.id}')" class="fk-text-btn" style="color:#dc2626;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> REMOVE</button></div>
                </div>
            </div>
        `;
    }).join("");

    const savings = totalMRP - totalDiscountPrice;
    content.innerHTML = `
        <div class="fk-cart-layout">
            <div class="fk-cart-items-list">${itemsHTML}</div>
            <div class="fk-price-sidebar">
                <h3>Order Summary</h3>
                <div class="fk-price-row-item"><span>Price (${cart.length} items)</span><span>₹${totalMRP.toLocaleString("en-IN")}</span></div>
                <div class="fk-price-row-item"><span>Store Discount</span><span style="color:#16a34a;">- ₹${savings.toLocaleString("en-IN")}</span></div>
                <div class="fk-price-row-item"><span>Delivery Charges</span><span style="color:#16a34a;">Free Delivery</span></div>
                <div class="fk-price-row-item total"><span>Total Amount</span><span>₹${totalDiscountPrice.toLocaleString("en-IN")}</span></div>
                <div class="fk-savings-banner">You will save ₹${savings.toLocaleString("en-IN")} on this order</div>
                <button class="fk-place-order-btn" onclick="proceedToCheckout()">PLACE ORDER</button>
            </div>
        </div>
    `;
}

window.proceedToCheckout = function() {
    if (!currentUser) return openAuthModal();
    if (cart.length === 0) return alert("Your cart is empty!");
    renderCheckoutSummary(); showPage('checkout');
};

function renderCheckoutSummary() {
    let totalMRP = 0; let totalDiscountPrice = 0;
    cart.forEach(cartItem => { const product = products.find(p => p.id == cartItem.id); if (product) { totalMRP += product.originalPrice * cartItem.qty; totalDiscountPrice += product.price * cartItem.qty; } });
    const sbar = document.getElementById("checkoutSummarySidebar");
    if(sbar) sbar.innerHTML = `<h3>Order Summary</h3><div class="fk-price-row-item"><span>Total MRP</span><span>₹${totalMRP.toLocaleString("en-IN")}</span></div><div class="fk-price-row-item total"><span>Payable Amount</span><span>₹${totalDiscountPrice.toLocaleString("en-IN")}</span></div>`;
}

window.submitOrder = function(event) {
    event.preventDefault();
    if (!currentUser) return openAuthModal();

    const name = document.getElementById("shipName").value.trim();
    const phone = document.getElementById("shipPhone").value.trim();
    const address = document.getElementById("shipAddress").value.trim();
    const orderId = "ANARS-" + Math.floor(1000 + Math.random() * 9000);

    const newOrder = { orderId, date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), name, phone, address, items: [...cart], statusIndex: 1 };
    
    orders.unshift(newOrder); 
    cart = []; 
    saveUserDataToCloud(); 
    updateCounters();
    const cId = document.getElementById("confirmedOrderId");
    if(cId) cId.textContent = orderId; 
    showPage('success');
};

window.cancelOrder = function(orderId) {
    if (!currentUser) return;
    if (confirm("Are you sure you want to cancel this order?")) {
        const orderIndex = orders.findIndex(o => o.orderId === orderId);
        if (orderIndex > -1) { 
            orders[orderIndex].statusIndex = 0; 
            saveUserDataToCloud(); 
            renderMyOrdersPage(); 
            updateCounters(); 
        }
    }
};

window.downloadOrderInvoice = function(orderId) {
    const order = orders.find(o => o.orderId === orderId);
    if (!order) return;
    let subtotal = 0;
    let itemsRows = order.items.map(ci => {
        const p = products.find(prod => prod.id == ci.id);
        const name = p ? p.name : "Computer Hardware";
        const price = p ? p.price : 0;
        const total = price * ci.qty; subtotal += total;
        return `<tr><td style="padding:10px; border-bottom:1px solid #e2e8f0;">${name}</td><td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:center;">${ci.qty}</td><td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right;">₹${price.toLocaleString("en-IN")}</td><td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right;">₹${total.toLocaleString("en-IN")}</td></tr>`;
    }).join("");

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Invoice - #${order.orderId}</title><style>body{font-family:'Plus Jakarta Sans',sans-serif;padding:40px;color:#0f172a;}.invoice-box{max-width:800px;margin:auto;border:1px solid #cbd5e1;padding:40px;border-radius:8px;}.header{display:flex;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:20px;margin-bottom:20px;}.store-name{font-size:24px;font-weight:900;color:#1e3a8a;}table{width:100%;border-collapse:collapse;margin-top:20px;}th{background:#f8fafc;padding:12px;text-align:left;font-size:12px;border-bottom:2px solid #cbd5e1;}.total-row{font-size:16px;font-weight:800;text-align:right;margin-top:20px;}</style></head><body><div class="invoice-box"><div class="header"><div><div class="store-name">ANARS COMPUTERS</div><p style="font-size:12px;color:#64748b;">Annai Complex, Kuthukalvalasai, TN 627803</p></div><div style="text-align:right;"><h2>TAX INVOICE</h2><p style="font-size:12px;color:#64748b;">Order ID: #${order.orderId}<br>Date: ${order.date}</p></div></div><div style="margin-bottom:20px;font-size:13px;"><strong>Billed To:</strong><br>${order.name} (${order.phone})<br>${order.address}, Kuthukalvalasai, TN</div><table><thead><tr><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead><tbody>${itemsRows}</tbody></table><div class="total-row">Grand Total: ₹${subtotal.toLocaleString("en-IN")}</div></div><script>window.print();</script></body></html>`);
    printWindow.document.close();
};

function renderMyOrdersPage() {
    const container = document.getElementById("myOrdersListContainer");
    if (!container) return;
    if (!currentUser) { container.innerHTML = `<div class="fk-empty-cart"><h3>Please login to view your orders!</h3><button class="primary-btn" style="margin:20px auto 0;" onclick="openAuthModal()">Login</button></div>`; return; }
    if (orders.length === 0) { container.innerHTML = `<div class="fk-empty-cart"><h3>No Orders Placed Yet!</h3><button class="primary-btn" style="margin:20px auto 0;" onclick="showPage('home')">Start Shopping</button></div>`; return; }

    container.innerHTML = orders.map(order => {
        let itemsHtml = order.items.map(cartItem => {
            const product = products.find(p => p.id == cartItem.id);
            if (!product) return "";
            return `<div class="order-item-row"><img src="${product.image}" class="order-item-img" onerror="imageFallback(this)" loading="lazy" width="70" height="70"><div style="flex:1;"><h4 style="font-size:15px; font-weight:700;">${product.name}</h4><p style="font-size:13px; color:#64748b;">Qty: ${cartItem.qty} | Price: ₹${Number(product.price).toLocaleString("en-IN")}</p></div></div>`;
        }).join("");

        const s = order.statusIndex;
        let statusText = s === 0 ? "Cancelled" : s === 1 ? "Order Placed" : s === 2 ? "Packed at Store" : s === 3 ? "Out for Delivery" : "Delivered";
        let statusColor = s === 0 ? "#ef4444" : s === 4 ? "#16a34a" : "#2563eb"; let statusBg = s === 0 ? "#fee2e2" : s === 4 ? "#dcfce7" : "#dbeafe";
        let cancelBtnHtml = s === 1 ? `<button class="cancel-order-btn" onclick="cancelOrder('${order.orderId}')">Cancel Order</button>` : '';

        return `<div class="order-card-box ${s === 0 ? 'cancelled-order' : ''}"><div class="order-top-row"><div><span class="order-id-badge">Order ID: #${order.orderId}</span><span style="font-size:12px; color:#64748b; margin-left:12px;">Placed on: ${order.date}</span></div><div style="display:flex; align-items:center; gap:12px;"><span style="font-size:13px; font-weight:700; color:${statusColor}; background:${statusBg}; padding:4px 10px; border-radius:6px;">Status: ${statusText}</span><button class="details-btn" onclick="downloadOrderInvoice('${order.orderId}')" style="padding:6px 12px; border-radius:6px; font-size:11px; font-weight:700;">Download Invoice 📄</button>${cancelBtnHtml}</div></div><div class="order-items-grid">${itemsHtml}</div><div style="font-size:13px; color:#334155; margin-bottom:20px; background:#f8fafc; padding:12px 16px; border-radius:8px; border:1px solid #e2e8f0;"><strong>Shipping Address:</strong> ${order.address}, Kuthukalvalasai, TN - 627803 &nbsp;|&nbsp; <strong>Phone:</strong> ${order.phone}</div>${s === 0 ? `<div style="background:#fee2e2; color:#b91c1c; padding:12px; border-radius:8px; font-size:13px; font-weight:700; text-align:center;">This order has been cancelled successfully.</div>` : `<div class="visual-timeline"><div class="v-step ${s >= 1 ? 'active' : ''}"><div class="v-dot">${s > 1 ? '✓' : '1'}</div><span>Order Placed</span></div><div class="v-step ${s >= 2 ? 'active' : ''}"><div class="v-dot">${s > 2 ? '✓' : '2'}</div><span>Packed</span></div><div class="v-step ${s >= 3 ? 'active' : ''}"><div class="v-dot">${s > 3 ? '✓' : '3'}</div><span>Out for Delivery</span></div><div class="v-step ${s >= 4 ? 'active' : ''}"><div class="v-dot">✓</div><span>Delivered</span></div></div>`}</div>`;
    }).join("");
}

function updateCounters() {
    const ordersLen = orders.filter(o => o.statusIndex !== 0).length;
    const cartLen = cart.reduce((sum, item) => sum + item.qty, 0);
    const wishLen = wishlist.length;

    if(document.getElementById("wishlistCount")) document.getElementById("wishlistCount").textContent = wishLen;
    if(document.getElementById("cartCount")) document.getElementById("cartCount").textContent = cartLen;
    if(document.getElementById("ordersCount")) document.getElementById("ordersCount").textContent = ordersLen;

    if(document.getElementById("sidebarWishlistCount")) document.getElementById("sidebarWishlistCount").textContent = wishLen;
    if(document.getElementById("sidebarCartCount")) document.getElementById("sidebarCartCount").textContent = cartLen;
    if(document.getElementById("sidebarOrdersCount")) document.getElementById("sidebarOrdersCount").textContent = ordersLen;
}

window.toggleMobileMenu = function() {
    const sidebar = document.getElementById("mobileMenuSidebar");
    const overlay = document.getElementById("mobileMenuOverlay");
    if(sidebar && overlay) { sidebar.classList.toggle("active"); overlay.classList.toggle("active"); }
};

// =====================================================
// ADMIN ENGINE MERGED
// =====================================================
window.switchAdminTab = function(tab) {
    const oSec = document.getElementById("adminTabOrders");
    const pSec = document.getElementById("adminTabProducts");
    const mSec = document.getElementById("adminTabMeta");
    if(oSec) oSec.style.display = tab === 'orders' ? 'block' : 'none';
    if(pSec) pSec.style.display = tab === 'products' ? 'block' : 'none';
    if(mSec) mSec.style.display = tab === 'meta' ? 'block' : 'none';
    
    if(document.getElementById("btnTabOrders")) document.getElementById("btnTabOrders").style.background = tab === 'orders' ? '#2563eb' : '#334155';
    if(document.getElementById("btnTabProducts")) document.getElementById("btnTabProducts").style.background = tab === 'products' ? '#2563eb' : '#334155';
    if(document.getElementById("btnTabMeta")) document.getElementById("btnTabMeta").style.background = tab === 'meta' ? '#2563eb' : '#334155';

    if(tab === 'orders') loadAdminOrders();
    if(tab === 'products') loadAdminProducts();
    if(tab === 'meta') loadAdminBrandLogos();
};

async function loadAdminOrders() {
    const tbody = document.getElementById("adminOrdersTableBody");
    if (!tbody) return;
    let allOrders = [];
    let activeCount = 0;

    try {
        const usersSnap = await getDocs(collection(db, "users"));
        usersSnap.forEach(userDoc => {
            const userData = userDoc.data();
            if (userData.orders && userData.orders.length > 0) {
                userData.orders.forEach((order, index) => {
                    allOrders.push({ ...order, uid: userDoc.id, orderIndex: index });
                    if (order.statusIndex !== 0) activeCount++;
                });
            }
        });

        if(document.getElementById("orderCountBadge")) document.getElementById("orderCountBadge").textContent = `${allOrders.length} Total Orders`;
        if(document.getElementById("statActiveOrders")) document.getElementById("statActiveOrders").textContent = activeCount;
        allOrders.sort((a, b) => b.orderId.localeCompare(a.orderId));

        if (allOrders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:30px;">No customer orders placed yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = allOrders.map((order) => {
            const s = order.statusIndex;
            const itemsList = order.items.map(i => `Qty: ${i.qty}`).join(", ");
            return `<tr>
                <td><strong>#${order.orderId}</strong><br><span style="font-size:11px; color:#64748b;">${order.date}</span></td>
                <td><strong>${order.name}</strong><br><span style="font-size:11px; color:#64748b;">Phone: ${order.phone}</span></td>
                <td style="font-size:12px; color:#334155;">${order.address}, Kuthukalvalasai</td>
                <td>${itemsList}</td>
                <td>
                    <select class="status-select" onchange="updateAdminOrderStatus('${order.uid}', ${order.orderIndex}, this.value)">
                        <option value="1" ${s === 1 ? 'selected' : ''}>1. Order Placed</option>
                        <option value="2" ${s === 2 ? 'selected' : ''}>2. Packed at Store</option>
                        <option value="3" ${s === 3 ? 'selected' : ''}>3. Out for Delivery</option>
                        <option value="4" ${s === 4 ? 'selected' : ''}>4. Delivered</option>
                        <option value="0" ${s === 0 ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
            </tr>`;
        }).join("");
    } catch (e) { console.error("Error loading admin orders:", e); }
}

window.updateAdminOrderStatus = async function (uid, orderIndex, newStatus) {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            let userData = userSnap.data();
            userData.orders[orderIndex].statusIndex = Number(newStatus);
            await updateDoc(userRef, { orders: userData.orders });
            alert("Order status updated in Live Database!");
            loadAdminOrders();
        }
    } catch (e) { alert("Failed to update status."); }
};

async function loadAdminProducts() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        cachedProducts = [];
        const tbody = document.getElementById("adminProductsTableBody");
        if(!tbody) return;
        querySnapshot.forEach((docSnap) => { cachedProducts.push({ id: docSnap.id, ...docSnap.data() }); });
        if(document.getElementById("statTotalProducts")) document.getElementById("statTotalProducts").textContent = cachedProducts.length;

        populateAdminDropdowns();
        tbody.innerHTML = cachedProducts.map(p => `<tr><td><strong>${p.name}</strong></td><td>${p.brand} / ${p.category}</td><td>₹${Number(p.price).toLocaleString("en-IN")}</td><td><button class="action-btn edit-btn" onclick="prepareUpdateProduct('${p.id}')">Update</button><button class="action-btn delete-btn" onclick="deleteProduct('${p.id}')">Delete</button></td></tr>`).join("");
    } catch (e) { console.error(e); }
}

function populateAdminDropdowns(selectedBrand = "", selectedCategory = "") {
    const brandSelect = document.getElementById("admBrandSelect");
    const catSelect = document.getElementById("admCategorySelect");
    if(!brandSelect || !catSelect) return;
    brandSelect.innerHTML = `<option value="">Select Brand</option>` + storeBrands.map(b => `<option value="${b}" ${b === selectedBrand ? 'selected' : ''}>${b}</option>`).join("");
    catSelect.innerHTML = `<option value="">Select Category</option>` + storeCategories.map(c => `<option value="${c}" ${c === selectedCategory ? 'selected' : ''}>${c}</option>`).join("");
}

window.deleteProduct = async function(productId) {
    if(confirm("Delete this product?")) {
        await deleteDoc(doc(db, "products", productId));
        loadAdminProducts();
        loadProductsFromFirebase();
    }
};

window.prepareUpdateProduct = function(productId) {
    const p = cachedProducts.find(item => item.id === productId);
    if(!p) return;
    document.getElementById("editProductId").value = p.id;
    document.getElementById("admName").value = p.name;
    populateAdminDropdowns(p.brand, p.category);
    document.getElementById("admPrice").value = p.price;
    document.getElementById("admOrigPrice").value = p.originalPrice;
    document.getElementById("admImage").value = p.image;
    document.getElementById("admDesc").value = p.description;
    if(document.getElementById("formHeading")) document.getElementById("formHeading").textContent = "Update Existing Product";
    if(document.getElementById("submitProductBtn")) document.getElementById("submitProductBtn").textContent = "Save Changes";
    if(document.getElementById("cancelEditBtn")) document.getElementById("cancelEditBtn").style.display = "inline-block";
};

window.resetProductForm = function() {
    const form = document.getElementById("productForm");
    if(form) form.reset();
    document.getElementById("editProductId").value = "";
    if(document.getElementById("formHeading")) document.getElementById("formHeading").textContent = "Add New Product to Firebase Database";
    if(document.getElementById("submitProductBtn")) document.getElementById("submitProductBtn").textContent = "Upload to Live Store";
    if(document.getElementById("cancelEditBtn")) document.getElementById("cancelEditBtn").style.display = "none";
    populateAdminDropdowns();
};

const prodForm = document.getElementById("productForm");
if(prodForm) {
    prodForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        const id = document.getElementById("editProductId").value;
        const data = {
            name: document.getElementById("admName").value.trim(),
            brand: document.getElementById("admBrandSelect").value,
            category: document.getElementById("admCategorySelect").value,
            price: Number(document.getElementById("admPrice").value),
            originalPrice: Number(document.getElementById("admOrigPrice").value),
            image: document.getElementById("admImage").value.trim(),
            description: document.getElementById("admDesc").value.trim()
        };
        if(id) {
            await updateDoc(doc(db, "products", id), data);
            alert("Product updated successfully!");
        } else {
            await addDoc(collection(db, "products"), data);
            alert("Product added successfully!");
        }
        resetProductForm();
        loadAdminProducts();
        loadProductsFromFirebase();
    });
}

function loadAdminBrandLogos() {
    const toggle = document.getElementById("admMarqueeToggle");
    if(toggle) toggle.checked = isMarqueeEnabled;
    const tbody = document.getElementById("adminBrandLogosTable");
    if(!tbody) return;
    const sortedLogos = [...brandLogos].sort((a, b) => a.pos - b.pos);
    tbody.innerHTML = sortedLogos.map(l => `<tr><td>${l.pos}</td><td><img src="${l.url}" style="height:25px;" alt="logo"></td><td>${l.name}</td><td><button class="action-btn delete-btn" onclick="deleteBrandLogo('${l.name}')">Delete</button></td></tr>`).join("");
}

window.toggleMarquee = async function() {
    isMarqueeEnabled = document.getElementById("admMarqueeToggle").checked;
    await setDoc(doc(db, "store_metadata", "config"), { brands: storeBrands, categories: storeCategories, brandLogos, isMarqueeEnabled, uiTheme }, { merge: true });
    renderBrandLogosFrontEnd();
};

window.addBrandLogo = async function() {
    const name = document.getElementById("logoName").value.trim();
    const url = document.getElementById("logoUrl").value.trim();
    const pos = Number(document.getElementById("logoPos").value);
    if(!name || !url) return alert("Fill name & URL");
    brandLogos.push({ name, url, pos });
    await setDoc(doc(db, "store_metadata", "config"), { brands: storeBrands, categories: storeCategories, brandLogos, isMarqueeEnabled, uiTheme }, { merge: true });
    loadAdminBrandLogos();
    renderBrandLogosFrontEnd();
    alert("Logo added!");
};

window.deleteBrandLogo = async function(name) {
    brandLogos = brandLogos.filter(l => l.name !== name);
    await setDoc(doc(db, "store_metadata", "config"), { brands: storeBrands, categories: storeCategories, brandLogos, isMarqueeEnabled, uiTheme }, { merge: true });
    loadAdminBrandLogos();
    renderBrandLogosFrontEnd();
};

window.updateUITheme = async function(val) {
    uiTheme = val;
    document.body.setAttribute('data-theme', uiTheme);
    await setDoc(doc(db, "store_metadata", "config"), { brands: storeBrands, categories: storeCategories, brandLogos, isMarqueeEnabled, uiTheme }, { merge: true });
    alert("Theme updated to " + val);
};

function setupHeroSlider() { setInterval(() => { changeSlide(1); }, 5000); }
function changeSlide(direction) {
    const slides = document.querySelectorAll(".hero-slide"); const dots = document.querySelectorAll(".dot");
    if (!slides.length) return;
    slides[currentSlide].classList.remove("active"); dots[currentSlide].classList.remove("active");
    currentSlide += direction;
    if (currentSlide >= slides.length) currentSlide = 0; if (currentSlide < 0) currentSlide = slides.length - 1;
    slides[currentSlide].classList.add("active"); dots[currentSlide].classList.add("active");
}
function goToSlide(index) {
    const slides = document.querySelectorAll(".hero-slide"); const dots = document.querySelectorAll(".dot");
    if (!slides[index]) return;
    slides[currentSlide].classList.remove("active"); dots[currentSlide].classList.remove("active");
    currentSlide = index;
    slides[currentSlide].classList.add("active"); dots[currentSlide].classList.add("active");
}

function scrollToProducts() { showPage('home'); document.getElementById("products").scrollIntoView({ behavior: "smooth" }); }
function scrollToCategories() { showPage('home'); document.getElementById("categories").scrollIntoView({ behavior: "smooth" }); }
function scrollToAbout() { showPage('home'); document.getElementById("about").scrollIntoView({ behavior: "smooth" }); }
function scrollToContact() { showPage('home'); document.getElementById("contact").scrollIntoView({ behavior: "smooth" }); }
function focusSearch() { showPage('home'); const s = document.getElementById("searchInput"); s.focus(); s.scrollIntoView({ behavior: "smooth", block: "center" }); }
function imageFallback(img) { if (img.dataset.fallbackUsed) return; img.dataset.fallbackUsed = "true"; img.src = "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=900&q=80"; }
