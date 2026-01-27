// ============================================
// Admin Dashboard - Seller Management
// Ultimate Store - New Structure: sellers/{sellerId}/products
// ============================================

// ============================================
// State
// ============================================
let orders = [];
let allProducts = []; // All products from all sellers
let sellers = []; // Array of seller objects {id, name, category, ...}
let currentSeller = null; // Currently viewing seller {id, name}

// ============================================
// Loading Management
// ============================================
function showLoading(text = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    if (overlay) {
        overlay.classList.add('active');
        if (loadingText) loadingText.textContent = text;
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// ============================================
// DOM Elements
// ============================================
const sellersGridView = document.getElementById('sellersGridView');
const sellerDetailView = document.getElementById('sellerDetailView');
const sellersGrid = document.getElementById('sellersGrid');
const currentSellerNameEl = document.getElementById('currentSellerName');
const ordersContainer = document.getElementById('ordersContainer');
const emptyState = document.getElementById('emptyState');
const productsContainer = document.getElementById('productsContainer');
const totalOrdersEl = document.getElementById('totalOrders');
const pendingOrdersEl = document.getElementById('pendingOrders');
const totalRevenueEl = document.getElementById('totalRevenue');
const tabBtns = document.querySelectorAll('.tab-btn');
const ordersTab = document.getElementById('ordersTab');
const productsTab = document.getElementById('productsTab');
const addProductBtn = document.getElementById('addProductBtn');
const addSellerModal = document.getElementById('addSellerModal');

// ============================================
// Initialize Dashboard
// ============================================
function initDashboard() {
    console.log('🚀 Admin Dashboard initialized (New Structure)');

    // Listen for sellers
    listenToSellers();

    // Listen for orders
    listenToOrders();

    // Set up tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Set up add product button
    if (addProductBtn) {
        addProductBtn.addEventListener('click', addProduct);
    }
}

// ============================================
// View Switching
// ============================================
function showSellersGrid() {
    sellersGridView.classList.add('active');
    sellerDetailView.classList.remove('active');
    currentSeller = null;
}

function showSellerDetail(sellerId, sellerName) {
    currentSeller = { id: sellerId, name: sellerName };
    sellersGridView.classList.remove('active');
    sellerDetailView.classList.add('active');
    currentSellerNameEl.textContent = `🏪 ${sellerName}`;

    // Auto-fill seller name in product form
    const productSellerInput = document.getElementById('productSeller');
    if (productSellerInput) {
        productSellerInput.value = sellerName;
    }

    // Listen to this seller's products
    listenToSellerProducts(sellerId);

    // Render filtered orders
    renderOrders();
    updateStats();
}

function goBackToGrid() {
    showSellersGrid();
}

function viewSeller(sellerId, sellerName) {
    showSellerDetail(sellerId, sellerName);
}

// ============================================
// Tab Switching
// ============================================
function switchTab(tabName) {
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    ordersTab.classList.toggle('active', tabName === 'orders');
    productsTab.classList.toggle('active', tabName === 'products');
}

// ============================================
// Listen to Sellers Collection
// ============================================
function listenToSellers() {
    db.collection('sellers')
        .orderBy('name')
        .onSnapshot((snapshot) => {
            sellers = [];

            snapshot.forEach((doc) => {
                sellers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log('👥 Sellers updated:', sellers.length);
            renderSellersGrid();
        }, (error) => {
            console.error('Error listening to sellers:', error);
        });
}

// ============================================
// Listen to Seller's Products (Subcollection)
// ============================================
let currentProductsUnsubscribe = null;

function listenToSellerProducts(sellerId) {
    // Unsubscribe from previous listener
    if (currentProductsUnsubscribe) {
        currentProductsUnsubscribe();
    }

    currentProductsUnsubscribe = db.collection('sellers').doc(sellerId)
        .collection('products')
        .orderBy('name')
        .onSnapshot((snapshot) => {
            allProducts = [];

            snapshot.forEach((doc) => {
                allProducts.push({
                    id: doc.id,
                    sellerId: sellerId,
                    ...doc.data()
                });
            });

            console.log('🛍️ Products for seller:', allProducts.length);
            renderProducts();
        }, (error) => {
            console.error('Error listening to products:', error);
        });
}

// ============================================
// Listen to Firestore Orders
// ============================================
function listenToOrders() {
    db.collection('orders')
        .orderBy('timestamp', 'desc')
        .onSnapshot((snapshot) => {
            orders = [];
            snapshot.forEach((doc) => {
                orders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log('📦 Orders updated:', orders.length);
            if (currentSeller) {
                renderOrders();
                updateStats();
            }
        }, (error) => {
            console.error('Error listening to orders:', error);
        });
}

// ============================================
// Render Sellers Grid
// ============================================
function renderSellersGrid() {
    sellersGrid.innerHTML = '';

    if (sellers.length === 0) {
        sellersGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #6b7280;">
                <p style="font-size: 48px; margin-bottom: 16px;">🏪</p>
                <p>No sellers yet. Click "🔄 Sync Sample Data" to add sample sellers!</p>
            </div>
        `;
        return;
    }

    // Create cards for each seller
    sellers.forEach(seller => {
        const card = document.createElement('div');
        card.className = 'seller-card';
        card.onclick = () => viewSeller(seller.id, seller.name);
        card.innerHTML = `
            <div class="seller-card-icon">🏪</div>
            <h3 class="seller-card-name">${seller.name}</h3>
            <div class="seller-card-stats">
                <span>📦 ${seller.productCount || 0} products</span>
                <span>🏷️ ${seller.category || 'General'}</span>
            </div>
        `;
        sellersGrid.appendChild(card);
    });

    // Add "New Seller" card
    const addCard = document.createElement('div');
    addCard.className = 'seller-card add-card';
    addCard.onclick = () => showAddSellerModal();
    addCard.innerHTML = `
        <div class="add-card-icon">➕</div>
        <h3 class="add-card-text">Add New Seller</h3>
    `;
    sellersGrid.appendChild(addCard);
}

// ============================================
// Add Seller Modal
// ============================================
function showAddSellerModal() {
    addSellerModal.classList.add('active');
}

function hideAddSellerModal() {
    addSellerModal.classList.remove('active');
    document.getElementById('newSellerName').value = '';
    document.getElementById('newSellerCategory').value = '';
    document.getElementById('newSellerDescription').value = '';
}

async function addSeller() {
    const name = document.getElementById('newSellerName').value.trim();
    const category = document.getElementById('newSellerCategory').value.trim() || 'General';
    const description = document.getElementById('newSellerDescription').value.trim();

    if (!name) {
        alert('Please enter a seller name.');
        return;
    }

    // Check if seller already exists
    const existing = sellers.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existing) {
        alert('A seller with this name already exists.');
        return;
    }

    try {
        // Create seller document
        const docRef = await db.collection('sellers').add({
            name: name,
            category: category,
            description: description,
            productCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ New seller added:', name);
        hideAddSellerModal();

        // Immediately view the new seller
        setTimeout(() => viewSeller(docRef.id, name), 500);

    } catch (error) {
        console.error('Failed to add seller:', error);
        alert('Failed to add seller. Please try again.');
    }
}

// ============================================
// Render Orders (Filtered by Current Seller)
// ============================================
function renderOrders() {
    const filteredOrders = currentSeller
        ? orders.filter(o => o.seller === currentSeller.name)
        : orders;

    if (filteredOrders.length === 0) {
        emptyState.style.display = 'block';
        const existingCards = ordersContainer.querySelectorAll('.order-card');
        existingCards.forEach(card => card.remove());
        return;
    }

    emptyState.style.display = 'none';
    ordersContainer.innerHTML = '';

    filteredOrders.forEach((order, index) => {
        const orderCard = createOrderCard(order, index === 0);
        ordersContainer.appendChild(orderCard);
    });
}

function createOrderCard(order, isNew = false) {
    const card = document.createElement('div');
    const isConfirmed = order.status === 'confirmed';
    card.className = `order-card ${isNew && !isConfirmed ? 'new' : ''} ${isConfirmed ? 'confirmed' : ''}`;

    const timestamp = order.timestamp ?
        formatTimestamp(order.timestamp.toDate()) :
        'Just now';

    card.innerHTML = `
        <div class="order-header">
            <div class="order-info">
                <h4>
                    ${order.productName}
                    ${isNew && !isConfirmed ? '<span class="new-badge">NEW!</span>' : ''}
                </h4>
                <div class="seller-name">🏪 ${order.seller}</div>
                <div class="order-time">🕐 ${timestamp}</div>
            </div>
            <div>
                <span class="order-price">Rp ${formatPrice(order.price)}</span>
                <span class="order-status ${order.status}">${order.status}</span>
            </div>
        </div>
        <div class="order-actions">
            <button class="action-btn chat" onclick="openChat('${order.id}', '${order.productName}')">
                💬 Chat
            </button>
            <button class="action-btn confirm" onclick="confirmOrder('${order.id}')" ${isConfirmed ? 'disabled' : ''}>
                ${isConfirmed ? '✅ Confirmed' : '✓ Confirm Order'}
            </button>
            <button class="action-btn delete" onclick="deleteOrder('${order.id}')">
                🗑️ Delete
            </button>
        </div>
    `;

    return card;
}

// ============================================
// Order Actions
// ============================================
async function confirmOrder(orderId) {
    try {
        await db.collection('orders').doc(orderId).update({
            status: 'confirmed'
        });

        // Delete chat messages when order is confirmed
        await deleteOrderMessages(orderId);

        console.log('✅ Order confirmed:', orderId);
    } catch (error) {
        console.error('Failed to confirm order:', error);
        alert('Failed to confirm order. Please try again.');
    }
}

async function deleteOrder(orderId) {
    try {
        await db.collection('orders').doc(orderId).delete();
        console.log('🗑️ Order deleted:', orderId);
    } catch (error) {
        console.error('Failed to delete order:', error);
        alert('Failed to delete order. Please try again.');
    }
}

// ============================================
// Render Products (Current Seller's Products)
// ============================================
function renderProducts() {
    // Update product count
    const productCountEl = document.getElementById('productCount');
    if (productCountEl) {
        productCountEl.textContent = `${allProducts.length} products`;
    }

    if (allProducts.length === 0) {
        productsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6b7280;">
                <p>No products for this seller yet. Add your first product above!</p>
            </div>
        `;
        return;
    }

    productsContainer.innerHTML = '';

    allProducts.forEach(product => {
        const isAvailable = product.available !== false;
        const item = document.createElement('div');
        item.className = `product-item ${!isAvailable ? 'unavailable' : ''}`;
        item.style.opacity = isAvailable ? '1' : '0.6';
        item.innerHTML = `
            <div class="product-item-info">
                <h4>${product.name} ${!isAvailable ? '<span style="color: #ef4444; font-size: 12px;">❌ Unavailable</span>' : '<span style="color: #10b981; font-size: 12px;">✅ Available</span>'}</h4>
                <div class="product-meta">
                    ${product.category || 'General'} • ${product.description || 'No description'}
                </div>
            </div>
            <div class="product-item-actions">
                <button class="toggle-btn ${isAvailable ? 'available' : 'unavailable'}" onclick="toggleAvailability('${product.id}', ${!isAvailable})" title="${isAvailable ? 'Mark Unavailable' : 'Mark Available'}">
                    ${isAvailable ? '🟢' : '🔴'}
                </button>
                <span class="product-item-price">${isAvailable ? `Rp ${formatPrice(product.price)}` : 'Sold Out'}</span>
                <button class="delete-product-btn" onclick="deleteProduct('${product.id}')" title="Delete">
                    🗑️
                </button>
            </div>
        `;
        productsContainer.appendChild(item);
    });
}

// ============================================
// Add Product (to current seller's subcollection)
// ============================================
async function addProduct() {
    if (!currentSeller) {
        alert('Please select a seller first.');
        return;
    }

    const name = document.getElementById('productName').value.trim();
    const price = parseInt(document.getElementById('productPrice').value);
    const category = document.getElementById('productCategory').value.trim() || 'General';
    const description = document.getElementById('productDescription').value.trim();
    const tagsInput = document.getElementById('productTags').value.trim();

    if (!name || !price) {
        alert('Please fill in Product Name and Price.');
        return;
    }

    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()) : [];

    try {
        // Add to seller's products subcollection
        await db.collection('sellers').doc(currentSeller.id)
            .collection('products').add({
                name,
                price,
                category,
                description,
                tags,
                available: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        // Update seller's product count
        await updateSellerProductCount(currentSeller.id);

        console.log('✅ Product added:', name);

        // Clear form
        document.getElementById('productName').value = '';
        document.getElementById('productPrice').value = '';
        document.getElementById('productCategory').value = '';
        document.getElementById('productDescription').value = '';
        document.getElementById('productTags').value = '';

        alert('Product added successfully!');
    } catch (error) {
        console.error('Failed to add product:', error);
        alert('Failed to add product. Please try again.');
    }
}

// ============================================
// Delete Product
// ============================================
async function deleteProduct(productId) {
    if (!currentSeller) return;

    try {
        await db.collection('sellers').doc(currentSeller.id)
            .collection('products').doc(productId).delete();

        // Update seller's product count
        await updateSellerProductCount(currentSeller.id);

        console.log('🗑️ Product deleted:', productId);
    } catch (error) {
        console.error('Failed to delete product:', error);
        alert('Failed to delete product. Please try again.');
    }
}

// ============================================
// Toggle Product Availability
// ============================================
async function toggleAvailability(productId, newStatus) {
    if (!currentSeller) return;

    try {
        await db.collection('sellers').doc(currentSeller.id)
            .collection('products').doc(productId).update({
                available: newStatus
            });
        console.log(`${newStatus ? '✅' : '❌'} Product availability updated:`, productId, newStatus);
    } catch (error) {
        console.error('Failed to toggle availability:', error);
        alert('Failed to update availability. Please try again.');
    }
}

// ============================================
// Update Seller Product Count
// ============================================
async function updateSellerProductCount(sellerId) {
    try {
        const snapshot = await db.collection('sellers').doc(sellerId)
            .collection('products').get();

        await db.collection('sellers').doc(sellerId).update({
            productCount: snapshot.size
        });
    } catch (error) {
        console.error('Failed to update product count:', error);
    }
}

// ============================================
// Sync Sample Data to New Structure
// ============================================
async function syncToNewStructure() {
    if (!confirm('This will sync sample data to the new structure (sellers with products subcollection). Continue?')) {
        return;
    }

    try {
        // Group products by seller
        const productsBySeller = {};
        sampleProducts.forEach(product => {
            const sellerName = product.seller;
            if (!productsBySeller[sellerName]) {
                productsBySeller[sellerName] = [];
            }
            productsBySeller[sellerName].push(product);
        });

        let sellersAdded = 0;
        let productsAdded = 0;

        for (const sellerName in productsBySeller) {
            const products = productsBySeller[sellerName];

            // Check if seller already exists
            const existingSeller = sellers.find(s => s.name.toLowerCase() === sellerName.toLowerCase());
            let sellerId;

            if (existingSeller) {
                sellerId = existingSeller.id;
                console.log(`📝 Using existing seller: ${sellerName}`);
            } else {
                // Create seller document
                const sellerDoc = await db.collection('sellers').add({
                    name: sellerName,
                    category: products[0].category || 'General',
                    productCount: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                sellerId = sellerDoc.id;
                sellersAdded++;
                console.log(`✅ Created seller: ${sellerName}`);
            }

            // Add products to seller's subcollection
            for (const product of products) {
                // Check if product already exists
                const existingProducts = await db.collection('sellers').doc(sellerId)
                    .collection('products')
                    .where('name', '==', product.name)
                    .get();

                if (existingProducts.empty) {
                    await db.collection('sellers').doc(sellerId)
                        .collection('products').add({
                            name: product.name,
                            price: product.price,
                            category: product.category,
                            description: product.description,
                            tags: product.tags || [],
                            available: product.available !== false,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    productsAdded++;
                    console.log(`  ✅ Added product: ${product.name}`);
                } else {
                    console.log(`  ⏭️ Skipped (exists): ${product.name}`);
                }
            }

            // Update product count
            await updateSellerProductCount(sellerId);
        }

        alert(`Sync complete!\n✅ Sellers added: ${sellersAdded}\n✅ Products added: ${productsAdded}`);

    } catch (error) {
        console.error('Failed to sync:', error);
        alert('Failed to sync. Please try again.');
    }
}

// ============================================
// Update Stats
// ============================================
function updateStats() {
    const filteredOrders = currentSeller
        ? orders.filter(o => o.seller === currentSeller.name)
        : orders;

    const total = filteredOrders.length;
    const pending = filteredOrders.filter(o => o.status === 'pending').length;
    const revenue = filteredOrders.reduce((sum, o) => sum + (o.price || 0), 0);

    totalOrdersEl.textContent = total;
    pendingOrdersEl.textContent = pending;
    totalRevenueEl.textContent = 'Rp ' + formatPrice(revenue);
}

// ============================================
// Format Helpers
// ============================================
function formatPrice(price) {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatTimestamp(date) {
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    }
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================
// Initialize on DOM Ready
// ============================================
document.addEventListener('DOMContentLoaded', initDashboard);

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initDashboard();
}

// ============================================
// CHAT FUNCTIONALITY
// ============================================
let currentChatOrderId = null;
let chatMessagesUnsubscribe = null;

function openChat(orderId, productName) {
    currentChatOrderId = orderId;

    // Update chat modal title
    document.getElementById('chatModalTitle').textContent = `💬 Chat: ${productName}`;

    // Clear previous messages
    document.getElementById('chatMessages').innerHTML = `
        <div class="chat-empty">Loading messages...</div>
    `;

    // Show chat modal
    document.getElementById('chatModal').classList.add('active');

    // Listen to messages for this order
    listenToChatMessages(orderId);

    // Focus chat input
    document.getElementById('chatInput').focus();

    // Set up enter key to send
    document.getElementById('chatInput').onkeypress = (e) => {
        if (e.key === 'Enter') sendChatMessage();
    };
}

function closeChatModal() {
    document.getElementById('chatModal').classList.remove('active');
    currentChatOrderId = null;

    // Unsubscribe from messages
    if (chatMessagesUnsubscribe) {
        chatMessagesUnsubscribe();
        chatMessagesUnsubscribe = null;
    }
}

function listenToChatMessages(orderId) {
    // Unsubscribe from previous listener
    if (chatMessagesUnsubscribe) {
        chatMessagesUnsubscribe();
    }

    chatMessagesUnsubscribe = db.collection('orders').doc(orderId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            const messagesContainer = document.getElementById('chatMessages');

            if (snapshot.empty) {
                messagesContainer.innerHTML = `
                    <div class="chat-empty">
                        <p>👋 No messages yet</p>
                        <p style="font-size: 12px; margin-top: 8px;">The buyer hasn't started a conversation</p>
                    </div>
                `;
                return;
            }

            messagesContainer.innerHTML = '';
            snapshot.forEach((doc) => {
                const msg = doc.data();
                const time = msg.timestamp ? formatTimestamp(msg.timestamp.toDate()) : '';
                const msgDiv = document.createElement('div');
                // Swap classes: buyer messages appear on left (from their perspective), seller on right
                msgDiv.className = `chat-message ${msg.sender === 'seller' ? 'seller-sent' : 'buyer-sent'}`;
                msgDiv.innerHTML = `
                    <div>${msg.text}</div>
                    <div class="chat-message-time">${time}</div>
                `;
                messagesContainer.appendChild(msgDiv);
            });

            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, (error) => {
            console.error('Error listening to messages:', error);
        });
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();

    if (!text || !currentChatOrderId) return;

    input.value = '';

    try {
        await db.collection('orders').doc(currentChatOrderId)
            .collection('messages').add({
                text: text,
                sender: 'seller',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        console.log('💬 Message sent');
    } catch (error) {
        console.error('Failed to send message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Delete chat messages when order is confirmed
async function deleteOrderMessages(orderId) {
    try {
        const messagesRef = db.collection('orders').doc(orderId).collection('messages');
        const snapshot = await messagesRef.get();

        const batch = db.batch();
        snapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log('🗑️ Chat messages deleted for order:', orderId);
    } catch (error) {
        console.error('Failed to delete messages:', error);
    }
}
