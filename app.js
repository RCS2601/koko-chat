// ============================================
// Ultimate Store - Chat Application
// Buyers are Kings! 
// Uses Groq API for natural language processing
// ============================================

// ============================================
// GROQ API CONFIGURATION
// ============================================
// Groq with Llama 3.3 70B - Updated February 2026
const GROQ_API_KEY = 'YOUR_GROQ_API_KEY';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ============================================
// DOM Elements
// ============================================
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const statusBar = document.getElementById('statusBar');
const statusText = document.getElementById('statusText');

// ============================================
// App State
// ============================================
let isProcessing = false;
let products = [];
let cart = []; // { product, quantity }
let selectedPaymentMethod = null;

// ============================================
// Initialize App
// ============================================
async function initApp() {
    try {
        // Show loading
        showLoading('Loading products...');

        // Load products
        products = await getProducts();

        // Hide loading
        hideLoading();

        // Update status
        updateStatus('Ready! Ask me anything', true);

        // Show welcome message
        addBotMessage(`👋 Welcome to Ultimate Store! I'm here to help you find products. You can ask me things like:

• "I want nasi padang"
• "Show me something sweet and cheap"
• "What drinks do you have?"
• "Find the cheapest food"`);

        console.log('✅ App initialized with', products.length, 'products');
    } catch (error) {
        console.error('Failed to initialize:', error);
        hideLoading();
        updateStatus('Error connecting', false);
    }
}

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

// Show typing indicator while AI is thinking
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatContainer.appendChild(typingDiv);
    scrollToBottom();
}

function hideTypingIndicator() {
    const typing = document.getElementById('typingIndicator');
    if (typing) {
        typing.remove();
    }
}

// ============================================
// Status Management
// ============================================
function updateStatus(text, connected = false) {
    statusText.textContent = text;
    if (connected) {
        statusBar.classList.add('connected');
    } else {
        statusBar.classList.remove('connected');
    }
}

// ============================================
// Message Display Functions
// ============================================
function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = content;

    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
}

function addBotMessage(text) {
    addMessage(text.replace(/\n/g, '<br>'), false);
}

function addUserMessage(text) {
    addMessage(text, true);
}

// Track last search query for feedback
let lastSearchQuery = '';

function addProductResults(products, searchQuery = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';

    let html = '<div class="message-content">';

    if (products.length === 0) {
        lastSearchQuery = searchQuery;
        html += `😅 It looks like we don't have "${searchQuery || 'that'}" yet!
        
<div class="feedback-prompt">
    <p>Help us improve! <button class="feedback-link-btn" onclick="showFeedbackModal()">📝 Give us feedback</button></p>
</div>`;
    } else {
        html += `🎯 Found ${products.length} product${products.length > 1 ? 's' : ''} for you! (sorted by best price)`;
        html += '<div class="product-list">';

        products.forEach((product, index) => {
            const isBestOffer = index === 0 && product.available !== false;
            const isUnavailable = product.available === false;
            html += `
                <div class="product-card ${isBestOffer ? 'best-offer' : ''} ${isUnavailable ? 'unavailable' : ''}" 
                     style="${isUnavailable ? 'opacity: 0.6; cursor: not-allowed;' : ''}">
                    <div class="product-info">
                        <h4>${product.name} ${isUnavailable ? '<span style="color: #ef4444; font-size: 12px;">❌ Unavailable</span>' : ''}</h4>
                        <span class="seller">${product.seller}</span>
                    </div>
                    <div class="product-price" style="${isUnavailable ? 'background: #9ca3af;' : ''}">${isUnavailable ? 'Sold Out' : `Rp ${formatPrice(product.price)}`}</div>
                    ${!isUnavailable ? `
                    <div class="product-actions">
                        <button class="action-btn add-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">
                            🛒 Add to Cart
                        </button>
                        <button class="action-btn order-now-btn" onclick="event.stopPropagation(); orderNow('${product.id}')">
                            ⚡ Order Now
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
        });

        html += '</div>';
    }

    html += '</div>';
    messageDiv.innerHTML = html;
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatContainer.appendChild(typingDiv);
    scrollToBottom();
}

function hideTypingIndicator() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ============================================
// Cart Management
// ============================================
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.product.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ product, quantity: 1 });
    }

    updateCartBadge();
    addBotMessage(`🛒 Added <strong>${product.name}</strong> to your cart!

<button class="view-cart-btn" onclick="showCartModal()">View Cart (${getCartItemCount()} items)</button>`);
    console.log('🛒 Cart updated:', cart);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.product.id !== productId);
    updateCartBadge();
    renderCartItems();
}

function updateCartQuantity(productId, change) {
    const item = cart.find(item => item.product.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            renderCartItems();
        }
    }
    updateCartBadge();
}

function getCartTotal() {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
}

function getCartItemCount() {
    return cart.reduce((count, item) => count + item.quantity, 0);
}

function updateCartBadge() {
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) {
        const count = getCartItemCount();
        cartCountEl.textContent = count;
        cartCountEl.style.display = count > 0 ? 'inline' : 'none';
    }
}

function clearCart() {
    cart = [];
    updateCartBadge();
}

// ============================================
// Cart Modal
// ============================================
function showCartModal() {
    renderCartItems();
    document.getElementById('cartModal').classList.add('active');
}

function hideCartModal() {
    document.getElementById('cartModal').classList.remove('active');
}

function renderCartItems() {
    const cartItemsEl = document.getElementById('cartItems');
    const cartTotalEl = document.getElementById('cartTotal');

    if (cart.length === 0) {
        cartItemsEl.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">🛒</div>
                <p>Your cart is empty</p>
                <p style="font-size: 13px; margin-top: 8px;">Search for products and add them to cart</p>
            </div>
        `;
        cartTotalEl.textContent = 'Rp 0';
        return;
    }

    cartItemsEl.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${item.product.name}</h4>
                <span class="cart-item-seller">🏪 ${item.product.seller}</span>
                <span class="cart-item-price">Rp ${formatPrice(item.product.price)}</span>
            </div>
            <div class="cart-item-controls">
                <button class="qty-btn" onclick="updateCartQuantity('${item.product.id}', -1)">−</button>
                <span class="qty-value">${item.quantity}</span>
                <button class="qty-btn" onclick="updateCartQuantity('${item.product.id}', 1)">+</button>
            </div>
            <button class="remove-btn" onclick="removeFromCart('${item.product.id}')">🗑️</button>
        </div>
    `).join('');

    cartTotalEl.textContent = `Rp ${formatPrice(getCartTotal())}`;
}

// ============================================
// Order Now (Direct Checkout)
// ============================================
function orderNow(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Clear cart and add just this product
    cart = [{ product, quantity: 1 }];
    updateCartBadge();

    // Go directly to checkout
    proceedToCheckout();
}

// ============================================
// Checkout Flow
// ============================================
function proceedToCheckout() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }

    hideCartModal();
    selectedPaymentMethod = null;

    // Reset payment UI
    document.getElementById('qrisDisplay').style.display = 'none';
    document.getElementById('cashDisplay').style.display = 'none';
    document.getElementById('paymentQris').classList.remove('selected');
    document.getElementById('paymentCash').classList.remove('selected');
    document.getElementById('confirmCheckoutBtn').disabled = true;

    // Render checkout summary
    renderCheckoutSummary();

    document.getElementById('checkoutModal').classList.add('active');
}

function hideCheckoutModal() {
    document.getElementById('checkoutModal').classList.remove('active');
}

function renderCheckoutSummary() {
    const summaryEl = document.getElementById('checkoutSummary');

    summaryEl.innerHTML = `
        <h4>Order Summary</h4>
        <div class="checkout-items">
            ${cart.map(item => `
                <div class="checkout-item">
                    <span>${item.product.name} × ${item.quantity}</span>
                    <span>Rp ${formatPrice(item.product.price * item.quantity)}</span>
                </div>
            `).join('')}
        </div>
        <div class="checkout-total">
            <strong>Total</strong>
            <strong>Rp ${formatPrice(getCartTotal())}</strong>
        </div>
    `;
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;

    // Update UI
    document.getElementById('paymentQris').classList.toggle('selected', method === 'qris');
    document.getElementById('paymentCash').classList.toggle('selected', method === 'cash');

    // Show appropriate display
    document.getElementById('qrisDisplay').style.display = method === 'qris' ? 'block' : 'none';
    document.getElementById('cashDisplay').style.display = method === 'cash' ? 'block' : 'none';

    // Generate order number (used for both display and saving)
    if (!window.currentOrderNumber) {
        window.currentOrderNumber = Math.floor(1000 + Math.random() * 9000);
    }
    document.getElementById('tempOrderNumber').textContent = window.currentOrderNumber;

    // Enable confirm button
    document.getElementById('confirmCheckoutBtn').disabled = false;
}

async function confirmCheckout() {
    if (!selectedPaymentMethod || cart.length === 0) return;

    const confirmBtn = document.getElementById('confirmCheckoutBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';

    try {
        // Get the order number
        const orderNumber = window.currentOrderNumber || Math.floor(1000 + Math.random() * 9000);

        // Save each cart item as an order
        for (const item of cart) {
            await db.collection('orders').add({
                orderId: orderNumber,
                productId: item.product.id,
                productName: item.product.name,
                seller: item.product.seller,
                price: item.product.price,
                quantity: item.quantity,
                totalPrice: item.product.price * item.quantity,
                category: item.product.category,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending',
                paymentMethod: selectedPaymentMethod,
                buyerSession: getBuyerSessionId()
            });
        }

        // Reset order number for next checkout
        window.currentOrderNumber = null;

        console.log('✅ All orders saved to Firestore');

        // Clear cart and close modal
        const totalAmount = getCartTotal();
        const itemCount = getCartItemCount();
        clearCart();
        hideCheckoutModal();

        // Show success message
        addBotMessage(`✅ <strong>Order Confirmed!</strong>

💰 Total: <strong>Rp ${formatPrice(totalAmount)}</strong>
💳 Payment: <strong>${selectedPaymentMethod === 'qris' ? 'QRIS' : 'Cash'}</strong>
📦 Items: ${itemCount} item${itemCount > 1 ? 's' : ''}

${selectedPaymentMethod === 'qris'
                ? '📱 Please complete your payment via QRIS'
                : '💵 Please pay at the counter when your order is ready'}

📢 The seller has been notified! Check "My Orders" to track your order.`);

    } catch (error) {
        console.error('Failed to save orders:', error);
        alert('Failed to process order. Please try again.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Order';
    }
}

// Generate unique session ID for buyer (uses localStorage for persistence)
function getBuyerSessionId() {
    let sessionId = localStorage.getItem('buyerSessionId');
    if (!sessionId) {
        sessionId = 'buyer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('buyerSessionId', sessionId);
    }
    return sessionId;
}

// ============================================
// Format Helpers
// ============================================
function formatPrice(price) {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ============================================
// Groq AI Integration
// ============================================
async function processWithGroq(userMessage) {
    // Create a system prompt that helps Groq understand the context
    const systemPrompt = `You are a shopping assistant for an Indonesian food marketplace. Your job is to understand what the user wants and extract search keywords.

Available product categories: nasi padang, snack, minuman (drinks), makanan (food)
Available tags: sweet, manis, cheap, murah, spicy, chicken, ayam, beef, nasi, drink, cold, hot, healthy, vegetable

Respond with a JSON object containing:
1. "intent": one of "search", "greeting", "help", "order", "unknown"
2. "keywords": array of search keywords extracted from the message (in Indonesian or English)
3. "response": a friendly response message if intent is not "search"

Examples:
- "I want nasi padang" -> {"intent": "search", "keywords": ["nasi", "padang"]}
- "something sweet and cheap" -> {"intent": "search", "keywords": ["sweet", "manis", "cheap", "murah"]}
- "hello" -> {"intent": "greeting", "keywords": [], "response": "Hello! How can I help you find products today?"}

IMPORTANT: Only respond with the JSON object, nothing else.`;

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.3,
                max_tokens: 256
            })
        });

        if (!response.ok) {
            throw new Error('Groq API request failed');
        }

        const data = await response.json();
        const text = data.choices[0].message.content;

        // Parse the JSON response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        throw new Error('Invalid response format');
    } catch (error) {
        console.error('Groq API error:', error);
        // Fallback to simple keyword extraction
        return fallbackProcessing(userMessage);
    }
}

// Fallback processing if Gemini API fails
function fallbackProcessing(message) {
    const lowerMessage = message.toLowerCase();

    // Check for greetings (whole word match only)
    const greetings = ['hello', 'hi', 'halo', 'hey', 'selamat'];
    const words = lowerMessage.replace(/[^\w\s]/g, '').split(/\s+/);
    if (greetings.some(g => words.includes(g))) {
        return {
            intent: 'greeting',
            keywords: [],
            response: 'Hello! 👋 How can I help you find products today?'
        };
    }

    // Check for help
    if (lowerMessage.includes('help') || lowerMessage.includes('bantuan')) {
        return {
            intent: 'help',
            keywords: [],
            response: `I can help you find products! Try asking:
• "I want nasi padang"
• "Show me something sweet"
• "Find cheap food"
• "What drinks do you have?"`
        };
    }

    // Semantic keyword expansion for better fallback search
    const keywordMap = {
        'sweet': ['sweet', 'manis', 'dessert', 'chocolate', 'coklat'],
        'manis': ['sweet', 'manis', 'dessert', 'chocolate', 'coklat'],
        'cheap': ['cheap', 'murah'],
        'murah': ['cheap', 'murah'],
        'drink': ['drink', 'minuman', 'cold', 'coffee', 'kopi'],
        'minuman': ['drink', 'minuman', 'cold', 'coffee', 'kopi'],
        'healthy': ['healthy', 'vegetable', 'sayur', 'gado'],
        'sehat': ['healthy', 'vegetable', 'sayur', 'gado'],
        'spicy': ['spicy', 'pedas', 'balado', 'rendang'],
        'pedas': ['spicy', 'pedas', 'balado', 'rendang'],
        'chicken': ['chicken', 'ayam'],
        'ayam': ['chicken', 'ayam'],
        'beef': ['beef', 'daging', 'sapi', 'rendang'],
        'daging': ['beef', 'daging', 'sapi', 'rendang'],
        'rice': ['nasi', 'rice'],
        'nasi': ['nasi', 'rice'],
        'snack': ['snack', 'pisang', 'klepon', 'martabak'],
        'coffee': ['coffee', 'kopi'],
        'kopi': ['coffee', 'kopi']
    };

    // Extract and expand keywords
    let keywords = lowerMessage
        .replace(/[^\w\s]/g, '')
        .split(' ')
        .filter(word => word.length > 2);

    // Expand keywords using the map
    let expandedKeywords = [];
    keywords.forEach(word => {
        if (keywordMap[word]) {
            expandedKeywords.push(...keywordMap[word]);
        } else {
            expandedKeywords.push(word);
        }
    });

    // Remove duplicates
    expandedKeywords = [...new Set(expandedKeywords)];

    return {
        intent: 'search',
        keywords: expandedKeywords.length > 0 ? expandedKeywords : keywords
    };
}

// ============================================
// Message Handling
// ============================================
async function handleUserMessage() {
    const message = userInput.value.trim();
    if (!message || isProcessing) return;

    // Clear input and show user message
    userInput.value = '';
    addUserMessage(message);

    // Set processing state
    isProcessing = true;
    sendBtn.disabled = true;
    showTypingIndicator();
    updateStatus('Thinking...', true);

    try {
        // Process with AI
        const result = await processWithGroq(message);

        hideTypingIndicator();

        if (result.intent === 'search' && result.keywords.length > 0) {
            // Search for products
            const searchQuery = result.keywords.join(' ');
            const foundProducts = await searchProducts(searchQuery);
            addProductResults(foundProducts.slice(0, 5), searchQuery); // Show top 5
        } else if (result.response) {
            // Show AI response
            addBotMessage(result.response);
        } else {
            // Search with original message
            const foundProducts = await searchProducts(message);
            if (foundProducts.length > 0) {
                addProductResults(foundProducts.slice(0, 5), message);
            } else {
                addProductResults([], message);
            }
        }

        updateStatus('Ready! Ask me anything', true);
    } catch (error) {
        console.error('Error processing message:', error);
        hideTypingIndicator();
        addBotMessage('Sorry, something went wrong. Please try again!');
        updateStatus('Error occurred', false);
    }

    // Reset processing state
    isProcessing = false;
    sendBtn.disabled = false;
}

// ============================================
// Event Listeners
// ============================================
sendBtn.addEventListener('click', handleUserMessage);

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleUserMessage();
    }
});

// Focus input on load
userInput.focus();

// ============================================
// Initialize on DOM Ready
// ============================================
document.addEventListener('DOMContentLoaded', initApp);

// Also initialize immediately if DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initApp();
}

console.log('🚀 Ultimate Store App loaded');

// ============================================
// MY ORDERS FUNCTIONALITY
// ============================================
let myOrders = [];
let currentChatOrderId = null;
let chatMessagesUnsubscribe = null;

// Listen to my orders
function listenToMyOrders() {
    const sessionId = getBuyerSessionId();
    console.log('🔍 Listening to orders for session:', sessionId);

    db.collection('orders')
        .where('buyerSession', '==', sessionId)
        .onSnapshot((snapshot) => {
            myOrders = [];
            snapshot.forEach((doc) => {
                myOrders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Sort client-side by timestamp (newest first)
            myOrders.sort((a, b) => {
                const timeA = a.timestamp?.toDate?.() || new Date(0);
                const timeB = b.timestamp?.toDate?.() || new Date(0);
                return timeB - timeA;
            });

            // Update order count badge
            const orderCountEl = document.getElementById('orderCount');
            if (orderCountEl) {
                const pendingCount = myOrders.filter(o => o.status === 'pending').length;
                orderCountEl.textContent = pendingCount;
                orderCountEl.style.display = pendingCount > 0 ? 'inline' : 'none';
            }

            console.log('📦 My orders updated:', myOrders.length);
        }, (error) => {
            console.error('Error listening to orders:', error);
        });
}

// Show orders modal
function showOrdersModal() {
    const modal = document.getElementById('ordersModal');
    const ordersList = document.getElementById('ordersList');

    if (myOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="empty-orders">
                <div class="empty-orders-icon">📦</div>
                <p>No orders yet!</p>
                <p style="font-size: 13px; margin-top: 8px;">Chat with us to find products you'll love</p>
            </div>
        `;
    } else {
        ordersList.innerHTML = myOrders.map(order => {
            const timestamp = order.timestamp ? formatTimestamp(order.timestamp.toDate()) : 'Just now';
            return `
                <div class="order-item">
                    <div class="order-item-header">
                        <span class="order-item-name">${order.productName}</span>
                        <span class="order-item-status ${order.status}">${order.status}</span>
                    </div>
                    <div class="order-item-meta">
                        🏪 ${order.seller} • Rp ${formatPrice(order.price)} • ${timestamp}
                    </div>
                    <div class="order-item-actions">
                        <button class="order-chat-btn" onclick="openChat('${order.id}', '${order.seller}', '${order.productName}')">
                            💬 Chat with Seller
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    modal.classList.add('active');
}

function hideOrdersModal() {
    document.getElementById('ordersModal').classList.remove('active');
}

// Format timestamp for display
function formatTimestamp(date) {
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins}m ago`;
    }
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    }
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ============================================
// CHAT FUNCTIONALITY
// ============================================

function openChat(orderId, sellerName, productName) {
    currentChatOrderId = orderId;

    // Update chat modal title
    document.getElementById('chatModalTitle').textContent = `💬 Chat: ${productName}`;

    // Clear previous messages
    document.getElementById('chatMessages').innerHTML = `
        <div class="chat-empty">Loading messages...</div>
    `;

    // Show chat modal
    document.getElementById('chatModal').classList.add('active');

    // Hide orders modal
    hideOrdersModal();

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
                        <p>👋 Start the conversation!</p>
                        <p style="font-size: 12px; margin-top: 8px;">Ask about your order or say hello</p>
                    </div>
                `;
                return;
            }

            messagesContainer.innerHTML = '';
            snapshot.forEach((doc) => {
                const msg = doc.data();
                const time = msg.timestamp ? formatTimestamp(msg.timestamp.toDate()) : '';
                const msgDiv = document.createElement('div');
                msgDiv.className = `chat-message ${msg.sender}`;
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
                sender: 'buyer',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        console.log('💬 Message sent');
    } catch (error) {
        console.error('Failed to send message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Start listening to orders when app loads
setTimeout(() => {
    listenToMyOrders();
}, 500);

// ============================================
// FEEDBACK FUNCTIONALITY
// ============================================

function showFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    const searchQueryEl = document.getElementById('feedbackSearchQuery');

    if (searchQueryEl) {
        searchQueryEl.textContent = lastSearchQuery || 'your request';
    }

    modal.classList.add('active');
    document.getElementById('feedbackText').focus();
}

function hideFeedbackModal() {
    document.getElementById('feedbackModal').classList.remove('active');
    document.getElementById('feedbackText').value = '';
}

async function submitFeedback() {
    const feedbackText = document.getElementById('feedbackText').value.trim();

    if (!feedbackText) {
        alert('Please enter your feedback.');
        return;
    }

    try {
        await db.collection('feedback').add({
            searchQuery: lastSearchQuery || '',
            text: feedbackText,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            buyerSession: getBuyerSessionId()
        });

        console.log('✅ Feedback submitted');
        hideFeedbackModal();
        addBotMessage('🙏 Thank you for your feedback! We appreciate you helping us improve.');
    } catch (error) {
        console.error('Failed to submit feedback:', error);
        alert('Failed to submit feedback. Please try again.');
    }
}
