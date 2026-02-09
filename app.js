// ============================================
// Ultimate Store - Chat Application
// Buyers are Kings! 
// Uses Groq API for natural language processing
// ============================================

// ============================================
// AI PROVIDER CONFIGURATION
// ============================================
// Primary: Groq with GPT-OSS-20B
const GROQ_API_KEY = 'YOUR_GROQ_API_KEY';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-20b';

// Fallback: OpenRouter (when Groq fails)
const OPENROUTER_API_KEY = 'YOUR_OPENROUTER_API_KEY';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'openai/gpt-4o-mini';

/**
 * Call chat API: tries Groq first, then OpenRouter on failure. Same interface for both.
 * @param {{ messages: Array<{role:string, content:string}>, temperature?: number, max_tokens?: number, response_format?: { type: string }, useOpenRouterOnly?: boolean }} options
 * @returns {Promise<{ content: string }>}
 */
async function callChatAPI(options) {
    const { messages, temperature = 0.4, max_tokens = 300, response_format, useOpenRouterOnly = false } = options;
    const body = { model: GROQ_MODEL, messages, temperature, max_tokens };
    if (response_format) body.response_format = response_format;

    let lastError;
    // Try Groq first (skip if useOpenRouterOnly)
    if (!useOpenRouterOnly) try {
        const res = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`Groq API ${res.status}`);
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content != null) return { content: typeof content === 'string' ? content : String(content) };
        throw new Error('Groq API empty content');
    } catch (e) {
        lastError = e;
        console.warn('Groq API failed, trying OpenRouter:', e.message);
    }

    // Fallback: OpenRouter (or primary when useOpenRouterOnly)
    try {
        const res = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages,
                temperature,
                max_tokens,
                ...(response_format && { response_format })
            })
        });
        if (!res.ok) throw new Error(`OpenRouter API ${res.status}`);
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content != null) return { content: typeof content === 'string' ? content : String(content) };
        throw new Error('OpenRouter API empty content');
    } catch (e) {
        console.error('OpenRouter API failed:', e);
        throw lastError || e;
    }
}

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
let conversationHistory = []; // Store conversation context for AI
const MAX_HISTORY = 10; // Keep last 10 messages for context

const KOKO_AI_MEMORY_KEY = 'koko_ai_memory';

// ai_memory: persist last user intent/summary for continuity across page reloads
function getKokoAiMemory() {
    try {
        const raw = localStorage.getItem(KOKO_AI_MEMORY_KEY);
        if (!raw) return '';
        const data = JSON.parse(raw);
        const parts = [];
        if (data.userWant) parts.push(data.userWant);
        if (data.intent) parts.push(`last intent: ${data.intent}`);
        if (data.summary) parts.push(data.summary);
        return parts.length ? parts.join('; ') : '';
    } catch (_) {
        return '';
    }
}

function setKokoAiMemory(payload) {
    try {
        localStorage.setItem(KOKO_AI_MEMORY_KEY, JSON.stringify({
            userWant: payload.userWant || '',
            intent: payload.intent || '',
            summary: payload.summary || '',
            at: Date.now()
        }));
    } catch (_) { }
}

/**
 * Parse JSON from AI response; handles markdown code blocks and extra text.
 * @param {string} text - Raw response from chat API
 * @returns {object|null} Parsed object or null
 */
function parseKokoResponseJson(text) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f45191c0-8997-4d71-a40e-6c72414ba925', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:parseKokoResponseJson:entry', message: 'parseKokoResponseJson entry', data: { textType: typeof text, textLen: text == null ? null : (typeof text === 'string' ? text.length : 0), textPreview: typeof text === 'string' ? String(text).slice(0, 300) : null }, timestamp: Date.now(), hypothesisId: 'A,C' }) }).catch(() => { });
    // #endregion
    if (!text || typeof text !== 'string') return null;
    let raw = text.trim();
    // Strip markdown code blocks: ```json ... ``` or ``` ... ```
    const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) raw = codeBlock[1].trim();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f45191c0-8997-4d71-a40e-6c72414ba925', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:parseKokoResponseJson:afterStrip', message: 'after code block strip', data: { codeBlockMatched: !!codeBlock, rawLen: raw.length, rawPreview: raw.slice(0, 250) }, timestamp: Date.now(), hypothesisId: 'D' }) }).catch(() => { });
    // #endregion
    // Find first { and then matching } by brace count
    const start = raw.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let end = -1;
    for (let i = start; i < raw.length; i++) {
        if (raw[i] === '{') depth++;
        else if (raw[i] === '}') {
            depth--;
            if (depth === 0) { end = i; break; }
        }
    }
    const jsonStr = end !== -1 ? raw.slice(start, end + 1) : raw.slice(start);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f45191c0-8997-4d71-a40e-6c72414ba925', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:parseKokoResponseJson:extracted', message: 'json extracted', data: { start, end, jsonStrLen: jsonStr.length, jsonStrPreview: jsonStr.slice(0, 280) }, timestamp: Date.now(), hypothesisId: 'A,E' }) }).catch(() => { });
    // #endregion
    try {
        const parsed = JSON.parse(jsonStr);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f45191c0-8997-4d71-a40e-6c72414ba925', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:parseKokoResponseJson:ok', message: 'parse success', data: { keys: Object.keys(parsed), hasIntent: 'intent' in parsed, intentVal: parsed.intent, hasResponse: 'response' in parsed, responseType: typeof parsed.response }, timestamp: Date.now(), hypothesisId: 'B' }) }).catch(() => { });
        // #endregion
        return parsed;
    } catch (_) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f45191c0-8997-4d71-a40e-6c72414ba925', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:parseKokoResponseJson:parseFail', message: 'JSON.parse threw', data: { jsonStrPreview: jsonStr.slice(0, 200) }, timestamp: Date.now(), hypothesisId: 'A,E' }) }).catch(() => { });
        // #endregion
        return null;
    }
}

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

        // Show welcome message in current language
        refreshWelcomeMessage();

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

function addProductResults(products, searchQuery = '', productComment = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';

    let html = '<div class="message-content">';

    if (products.length === 0) {
        lastSearchQuery = searchQuery;
        html += `Waduh, "${searchQuery || 'itu'}" kayaknya belum ada di database saya, Bos. 😅

Mungkin typo? Atau emang lagi nyari sesuatu yang super rare?

<div class="feedback-prompt">
    <p>Kalau emang harusnya ada, kasih tau saya dong! <button class="feedback-link-btn" onclick="showFeedbackModal()">📝 Kirim Feedback</button></p>
</div>`;
    } else {
        // Use Koko's productComment if available, otherwise generic
        const comment = productComment || `Nih ${products.length} pilihan buat Bos. Yang paling worth it ada di atas! 👆`;
        html += `🎯 ${comment}`;
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

// Add feedback prompt as separate message (for confused intent)
function addFeedbackPrompt(searchQuery) {
    lastSearchQuery = searchQuery;
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="message-content feedback-prompt-msg">
            <p>💡 Kalau ada yang kurang jelas atau saya salah paham, kasih tau ya!</p>
            <button class="feedback-link-btn" onclick="showFeedbackModal()">📝 Kirim Feedback</button>
        </div>
    `;
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

<button class="view-cart-btn" onclick="goToCart()">View Cart (${getCartItemCount()} items)</button>`);
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
    const count = getCartItemCount();

    // Update header cart count (if exists)
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) {
        cartCountEl.textContent = count;
        cartCountEl.style.display = count > 0 ? 'inline' : 'none';
    }

    // Update bottom nav cart badge
    const cartBadge = document.getElementById('cartBadge');
    if (cartBadge) {
        cartBadge.textContent = count;
        cartBadge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function clearCart() {
    cart = [];
    updateCartBadge();
}

// ============================================
// Cart Navigation
// ============================================
function showCartModal() {
    // Legacy function - redirect to cart view
    goToCart();
}

function goToCart() {
    // Navigate to cart view using view-based navigation
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById('navCart').classList.add('active');

    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById('cartView').classList.add('active');

    currentTab = 'cart';
    renderCartView();
    updateChatNavAppearance();
}

function hideCartModal() {
    // Legacy function - now just goes back to chat
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById('navChat').classList.add('active');

    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById('chatView').classList.add('active');

    currentTab = 'chat';
    updateChatModeDisplay();
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
// Checkout Flow
// ============================================
let selectedOrderType = 'normal'; // 'normal' or 'bid'
// selectedPaymentMethod is defined globally at top of file
let cartHasBiddableItems = false;

function proceedToCheckout() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }

    // 👑 KING MODE: Auto-checkout without confirmation
    if (isKingMode) {
        console.log('👑 King Mode auto-checkout initiated');

        // Get default payment method
        const defaultPayment = localStorage.getItem('kingModeDefaultPayment') || 'qris';
        selectedPaymentMethod = defaultPayment;
        selectedOrderType = 'normal';

        // Use King Mode checkout flow
        kingModeAutoCheckout();
        return;
    }

    hideCartModal();
    selectedOrderType = 'normal';
    selectedPaymentMethod = 'qris'; // Reset default payment

    // Check if any cart item has bidding enabled
    cartHasBiddableItems = cart.some(item => item.product.biddingEnabled === true);

    // Reset bid section
    const bidSection = document.getElementById('bidSection');
    const bidInput = document.getElementById('bidPriceInput');
    const orderTypeBid = document.getElementById('orderTypeBid');

    if (cartHasBiddableItems) {
        bidSection.style.display = 'block';
        orderTypeBid.style.display = 'flex';
    } else {
        bidSection.style.display = 'none';
        orderTypeBid.style.display = 'none';
    }

    if (bidInput) bidInput.value = '';

    // Reset order type selection
    document.getElementById('orderTypeNormal').classList.add('selected');
    document.getElementById('orderTypeBid')?.classList.remove('selected');

    // Render checkout summary
    renderCheckoutSummary();

    document.getElementById('checkoutModal').classList.add('active');
}

function selectOrderType(type) {
    selectedOrderType = type;

    document.getElementById('orderTypeNormal').classList.toggle('selected', type === 'normal');
    document.getElementById('orderTypeBid').classList.toggle('selected', type === 'bid');

    const bidSection = document.getElementById('bidSection');
    const paymentSection = document.getElementById('checkoutPaymentSection');
    const noteBid = document.getElementById('checkoutNoteBid');

    if (type === 'bid') {
        // Bid Mode
        if (bidSection) bidSection.style.display = 'block';
        if (paymentSection) paymentSection.style.display = 'none'; // Hide payment
        if (noteBid) noteBid.style.display = 'block'; // Show note
        document.getElementById('bidPriceInput')?.focus();
    } else {
        // Normal Mode
        if (bidSection) bidSection.style.display = 'none';
        if (paymentSection) paymentSection.style.display = 'block'; // Show payment
        if (noteBid) noteBid.style.display = 'none'; // Hide note
    }

    console.log('📋 Order type selected:', type);
}

function selectCheckoutPayment(method) {
    selectedPaymentMethod = method; // 'qris' or 'cash'

    // Update UI
    document.getElementById('paymentQris').classList.toggle('selected', method === 'qris');
    document.getElementById('paymentCash').classList.toggle('selected', method === 'cash');

    console.log('💳 Payment method selected:', method);
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
                    <span>${item.product.name} × ${item.quantity} ${item.product.biddingEnabled ? '<span style="color: #f59e0b; font-size: 11px;">💰</span>' : ''}</span>
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

async function confirmCheckout() {
    if (cart.length === 0) return;

    const confirmBtn = document.getElementById('confirmCheckoutBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';

    try {
        // Get the order number
        const orderNumber = Math.floor(1000 + Math.random() * 9000);

        // Get bid price if entered
        const bidInput = document.getElementById('bidPriceInput');
        const bidPrice = bidInput && bidInput.value ? parseInt(bidInput.value) : null;
        const isBidOrder = selectedOrderType === 'bid' && bidPrice && cartHasBiddableItems;

        // Determine status based on order type
        const orderStatus = isBidOrder ? 'pending_agreement' : 'pending';

        // Save each cart item as an order
        for (const item of cart) {
            const orderData = {
                orderId: orderNumber,
                productId: item.product.id,
                productName: item.product.name,
                seller: item.product.seller,
                price: item.product.price,
                quantity: item.quantity,
                totalPrice: item.product.price * item.quantity,
                category: item.product.category,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: orderStatus,
                paymentMethod: isBidOrder ? null : selectedPaymentMethod, // Save payment for normal orders
                buyerSession: getBuyerSessionId(),
                // Bidding fields
                biddingEnabled: item.product.biddingEnabled || false,
                bidPrice: isBidOrder ? bidPrice : null,
                agreedPrice: isBidOrder ? null : item.product.price * item.quantity
            };

            await db.collection('orders').add(orderData);
        }

        console.log('✅ All orders saved to Firestore');

        // Clear cart and close modal
        const totalAmount = getCartTotal();
        const itemCount = getCartItemCount();
        clearCart();
        hideCheckoutModal();

        // Reset button
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Place Order';

        // Show success message based on order type
        if (isBidOrder) {
            addBotMessage(`✅ <strong>Bid Placed!</strong>

📦 Order #${orderNumber}
💰 Your Bid: <strong>Rp ${formatPrice(bidPrice)}</strong>
📋 Original: Rp ${formatPrice(totalAmount)}

⏳ Waiting for seller to accept your bid. Check "Orders" to see the status and chat with the seller!`);
        } else {
            addBotMessage(`✅ <strong>Order Placed!</strong>

📦 Order #${orderNumber}
💰 Total: <strong>Rp ${formatPrice(totalAmount)}</strong>
💳 Payment: <strong>${selectedPaymentMethod === 'qris' ? 'QRIS' : 'Cash'}</strong>

⏳ Waiting for seller confirmation. Check "Orders" to track your order!`);
        }

    } catch (error) {
        console.error('Failed to save orders:', error);
        alert('Failed to process order. Please try again.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Order';
    }
}

// 👑 KING MODE: Auto-checkout without confirmation modal
async function kingModeAutoCheckout() {
    if (cart.length === 0) return;

    console.log('👑 King Mode auto-checkout processing...');

    try {
        // Get the order number
        const orderNumber = Math.floor(1000 + Math.random() * 9000);

        // Use default payment method for King Mode
        const defaultPayment = localStorage.getItem('kingModeDefaultPayment') || 'qris';
        const orderStatus = 'pending';

        // Track created orders for auto-chat
        const createdOrders = [];

        // Save each cart item as an order
        for (const item of cart) {
            const orderData = {
                orderId: orderNumber,
                productId: item.product.id,
                productName: item.product.name,
                seller: item.product.seller,
                price: item.product.price,
                quantity: item.quantity,
                totalPrice: item.product.price * item.quantity,
                category: item.product.category,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: orderStatus,
                paymentMethod: defaultPayment,
                buyerSession: getBuyerSessionId(),
                biddingEnabled: item.product.biddingEnabled || false,
                bidPrice: null,
                agreedPrice: item.product.price * item.quantity
            };

            const docRef = await db.collection('orders').add(orderData);
            createdOrders.push({
                id: docRef.id,
                ...orderData,
                sellerName: item.product.seller
            });
        }

        console.log('✅ King Mode orders saved:', createdOrders.length);

        // Calculate totals
        const totalAmount = getCartTotal();
        const itemCount = getCartItemCount();

        // Clear cart silently
        clearCart();

        // 🎩 Report to the King in Butler style
        const butlerReport = currentLanguage === 'en'
            ? `👑 **Excellent news, Your Majesty!**\n\n📦 Order #${orderNumber} has been successfully placed.\n💰 Total: **Rp ${formatPrice(totalAmount)}**\n💳 Payment: **${defaultPayment === 'qris' ? 'QRIS' : 'Cash'}**\n\n🏛️ I have dispatched messengers to notify the merchants. They shall prepare your items with utmost haste.`
            : `👑 **Kabar gembira, Yang Mulia!**\n\n📦 Pesanan #${orderNumber} telah berhasil diproses.\n💰 Total: **Rp ${formatPrice(totalAmount)}**\n💳 Pembayaran: **${defaultPayment === 'qris' ? 'QRIS' : 'Cash'}**\n\n🏛️ Saya telah mengirim utusan untuk memberitahu para pedagang. Mereka akan mempersiapkan pesanan Anda secepatnya.`;

        addBotMessage(butlerReport);

        // 🔊 Speak the report to the King
        await speakButlerReport(butlerReport);

        // 💬 Start background chat listeners for ALL sellers (stay in main chat)
        for (const order of createdOrders) {
            setTimeout(() => {
                // Start background listener (no chat modal)
                startBackgroundChatListener(order.id, order.sellerName, order.productName);

                // Send initial message on King's behalf
                kingModeSendInitialMessage(order);
            }, 1000); // Slight delay for each order
        }

        // 👑 KING MODE: Stay in main chat, don't switch views
        // Let the King know they can chat normally here
        const stayInChatMsg = currentLanguage === 'en'
            ? `👑 **Your orders are being managed, Your Majesty.**\n\nI shall monitor all merchant communications and report back to you here. After I report a seller's message, simply type your response and I will understand whether to send it to them or chat with you.`
            : `👑 **Pesanan Anda sedang saya urus, Yang Mulia.**\n\nSaya akan memantau semua komunikasi pedagang dan melapor ke Anda di sini. Setelah saya melaporkan pesan pedagang, cukup ketik balasan Anda dan saya akan mengerti apakah harus mengirimnya ke mereka atau chat dengan Anda.`;

        addBotMessage(stayInChatMsg);

    } catch (error) {
        console.error('👑 King Mode auto-checkout failed:', error);
        addBotMessage(currentLanguage === 'en'
            ? '😔 My apologies, Your Majesty. There was an issue processing your order. Please try again.'
            : '😔 Maaf, Yang Mulia. Terjadi masalah saat memproses pesanan Anda. Silakan coba lagi.');
    }
}

// 👑 KING MODE: Initiate chat with seller after auto-checkout
async function kingModeInitiateSellerChat(order) {
    try {
        // Open chat with seller
        openChat(order.id, order.sellerName, order.productName);

        // Generate initial professional message
        const initialMessage = currentLanguage === 'en'
            ? `Greetings! His Majesty has placed an order (#${order.orderId}) for ${order.quantity}x ${order.productName}. We look forward to your prompt preparation and confirmation. Payment via ${order.paymentMethod.toUpperCase()}. Thank you!`
            : `Selamat datang! Yang Mulia telah memesan (#${order.orderId}) ${order.quantity}x ${order.productName}. Kami menantikan persiapan dan konfirmasi Anda. Pembayaran via ${order.paymentMethod.toUpperCase()}. Terima kasih!`;

        // Send the message
        await db.collection('orders').doc(order.id)
            .collection('messages').add({
                text: initialMessage,
                sender: 'buyer',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                isKingMode: true,
                autoGenerated: true
            });

        console.log(`👑 King Mode: Initial message sent to ${order.sellerName}`);

        // Report to King
        const report = currentLanguage === 'en'
            ? `🏛️ I have notified ${order.sellerName} of your order, my Lord.`
            : `🏛️ Saya telah memberitahu ${order.sellerName} tentang pesanan Anda, Yang Mulia.`;

        addBotMessage(report);

    } catch (error) {
        console.error('Failed to initiate seller chat:', error);
    }
}

// 👑 KING MODE: Speak report to the King
async function speakButlerReport(report) {
    if (!('speechSynthesis' in window)) {
        console.warn('⚠️ Text-to-Speech not supported');
        return;
    }

    // Clean up the report for speech (remove emojis and markdown)
    const cleanReport = report
        .replace(/[#*_]/g, '')
        .replace(/👑|📦|💰|💳|🏛️/g, '')
        .trim();

    const utterance = new SpeechSynthesisUtterance(cleanReport);
    utterance.lang = currentLanguage === 'en' ? 'en-GB' : 'id-ID';
    utterance.rate = 0.85;
    utterance.pitch = 0.9;

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
        v.lang.startsWith(currentLanguage === 'en' ? 'en-GB' : 'id') &&
        v.name.toLowerCase().includes('male')
    ) || voices.find(v => v.lang.startsWith(currentLanguage === 'en' ? 'en' : 'id'));

    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
    console.log('🔊 Butler speaking to King:', cleanReport.substring(0, 100) + '...');
}

// 👑 KING MODE: Offer to auto-submit feedback for not-found items
async function kingModeOfferFeedback(itemName) {
    // Store the pending feedback item for reference
    pendingKingModeFeedback = itemName;

    // Ask the King if they want to submit feedback
    const message = currentLanguage === 'en'
        ? `📝 **Your Majesty,** "${itemName}" is not available in our catalog.\n\nShall I submit a request to add it for your future visits?\n\n*Simply reply "yes" or "no"*`
        : `📝 **Yang Mulia,** "${itemName}" belum tersedia di katalog kami.\n\nApakah saya harus mengajukan permintaan untuk menambahkannya?\n\n*Balas "ya" atau "tidak"*`;

    addBotMessage(message);
    console.log('👑 King Mode: Offered feedback for:', itemName);
}

// 👑 KING MODE: Auto-generate and submit feedback
async function kingModeSubmitFeedback(itemName) {
    try {
        // Generate feedback message using AI
        const feedbackMessage = await generateKingModeFeedback(itemName);

        // Capture current chat log for context
        const chatLog = getChatLogForFeedback();

        // Submit to Firestore
        await db.collection('feedback').add({
            type: 'missing_product',
            message: feedbackMessage,
            searchQuery: itemName,
            chatLog: chatLog,
            buyerSession: getBuyerSessionId(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'unread',
            submittedBy: 'king_mode_auto'
        });

        console.log('✅ King Mode auto-feedback submitted for:', itemName);

        // Report to the King
        const report = currentLanguage === 'en'
            ? `👑 **Excellent, Your Majesty!**\n\nI have submitted a formal request to add "${itemName}" to our catalog. The administrators shall review it posthaste.\n\n🏛️ In the meantime, may I suggest some alternatives from our existing offerings?`
            : `👑 **Baik, Yang Mulia!**\n\nSaya telah mengajukan permintaan resmi untuk menambahkan "${itemName}" ke katalog kami. Admin akan segera meninjau.\n\n🏛️ Sementara itu, bolehkah saya menawarkan alternatif dari menu yang tersedia?`;

        addBotMessage(report);

        // Speak the report
        await speakButlerReport(report);

    } catch (error) {
        console.error('Failed to submit King Mode feedback:', error);
        addBotMessage(currentLanguage === 'en'
            ? `😔 My apologies, Your Majesty. I was unable to submit the request. Please try again later.`
            : `😔 Maaf, Yang Mulia. Saya gagal mengajukan permintaan. Silakan coba lagi nanti.`);
    }
}

// 👑 KING MODE: Generate feedback message using AI
async function generateKingModeFeedback(itemName) {
    const systemPrompt = currentLanguage === 'en'
        ? `You are a royal assistant writing a polite feedback request. Write a brief, professional message requesting that a missing product be added to the catalog. Keep it to 2-3 sentences. Be courteous but clear.`
        : `Anda adalah asisten kerajaan yang menulis permintaan feedback. Tulis pesan singkat dan profesional yang meminta produk yang tidak tersedia untuk ditambahkan ke katalog. Buat 2-3 kalimat saja. Sopan namun jelas.`;

    const userPrompt = currentLanguage === 'en'
        ? `Write a feedback request asking the admin to add "${itemName}" to the product catalog. The request should sound like it's coming from a royal butler on behalf of the King.`
        : `Tulis permintaan feedback untuk meminta admin menambahkan "${itemName}" ke katalog produk. Pesan harus terdengar seperti dari pelayan kerajaan atas nama Yang Mulia.`;

    try {
        const { content } = await callChatAPI({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.5,
            max_tokens: 150
        });
        const generatedMessage = content?.trim();

        console.log('✨ Generated King Mode feedback:', generatedMessage);
        return generatedMessage || (currentLanguage === 'en'
            ? `Request to add ${itemName} to the catalog. This item is highly desired by His Majesty.`
            : `Permintaan untuk menambahkan ${itemName} ke katalog. Item ini sangat diinginkan oleh Yang Mulia.`);

    } catch (error) {
        console.error('Failed to generate King Mode feedback:', error);
        return currentLanguage === 'en'
            ? `Request to add ${itemName} to the catalog. This item is highly desired by His Majesty.`
            : `Permintaan untuk menambahkan ${itemName} ke katalog. Item ini sangat diinginkan oleh Yang Mulia.`;
    }
}

// 👑 KING MODE: Handle user's response to feedback offer
async function handleKingModeFeedbackResponse(userResponse) {
    const normalizedResponse = userResponse.toLowerCase().trim();

    // Check for positive responses (whole-word only so "ayam"/"aja" don't match "ya")
    const yesResponses = currentLanguage === 'en'
        ? ['yes', 'yeah', 'yep', 'sure', 'absolutely', 'please', 'ok', 'okay', 'do it', 'go ahead']
        : ['ya', 'yes', 'yep', 'sure', 'tentu', 'silakan', 'silahkan', 'oke', 'ok', 'gas', 'monggo'];

    const noResponses = currentLanguage === 'en'
        ? ['no', 'nope', 'nah', "don't", 'do not', 'cancel', 'stop']
        : ['tidak', 'no', 'nope', 'nggak', 'ga', 'gak', 'jangan', 'batal'];

    // Match whole words only so "ayam"/"aja" don't match "ya"
    const words = normalizedResponse.split(/\s+/).map(w => w.replace(/^\W+|\W+$/g, ''));
    const isYes = yesResponses.some(r => words.includes(r));
    const isNo = noResponses.some(r => words.includes(r));

    if (isYes && pendingKingModeFeedback) {
        // User wants to submit feedback
        await kingModeSubmitFeedback(pendingKingModeFeedback);
        pendingKingModeFeedback = null; // Clear pending
        return true; // Handled
    } else if (isNo && pendingKingModeFeedback) {
        pendingKingModeFeedback = null; // Clear pending

        // If user declined AND said what they want instead (e.g. "gak usah, gw pengen daging aja"),
        // don't ask "Bolehkah saya menyarankan?" — let normal flow process and show results in one go.
        const hasNewPreference = (currentLanguage === 'en'
            ? /\b(want|need|instead|rather|give me|show me|daging|meat|nasi|rice|kopi|coffee|minuman|drink)\b/i
            : /\b(pengen|mau|ingin|aja|saja|daging|nasi|kopi|minuman|makanan|snack)\b/i
        ).test(normalizedResponse) || userResponse.trim().length > 20;

        if (hasNewPreference) {
            return false; // Process with Groq and show suggestions directly
        }

        const response = currentLanguage === 'en'
            ? `🏛️ As you wish, Your Majesty. I shall not submit the request.\n\nMay I instead suggest some of our finest existing offerings that may satisfy your refined taste?`
            : `🏛️ Baik, Yang Mulia. Saya tidak akan mengajukan permintaan.\n\nBolehkah saya menyarankan beberapa menu terbaik kami yang mungkin sesuai dengan selera Anda?`;

        addBotMessage(response);
        return true; // Handled
    }

    return false; // Not a feedback response, process normally
}

// Global variable to track pending King Mode feedback
let pendingKingModeFeedback = null;

// Global variable to track pending AI-detected reply (awaiting confirmation)
let pendingKingModeReply = null;

// 👑 KING MODE: Notify King of seller message when not in chat view
function kingModeNotifySellerMessage(butlerMessage, orderId) {
    // Create a concise notification
    const notification = currentLanguage === 'en'
        ? `🎩 **A message from the merchant, my Lord:**\n\n"${butlerMessage.substring(0, 100)}${butlerMessage.length > 100 ? '...' : ''}"\n\n*Click "Orders" to view full conversation*`
        : `🎩 **Pesan dari pedagang, Yang Mulia:**\n\n"${butlerMessage.substring(0, 100)}${butlerMessage.length > 100 ? '...' : ''}"\n\n*Klik "Orders" untuk melihat percakapan lengkap*`;

    addBotMessage(notification);
    console.log('👑 King Mode: Notified King of seller message for order:', orderId);
}

// ============================================
// KING MODE BACKGROUND CHAT AGENT SYSTEM
// ============================================

// 👑 Start background chat listener for an order (works without opening chat modal)
function startBackgroundChatListener(orderId, sellerName, productName) {
    // Don't start if already listening
    if (backgroundChatListeners.has(orderId)) {
        console.log(`👑 Background listener already active for order: ${orderId}`);
        return;
    }

    console.log(`👑 Starting background chat listener for ${sellerName} (order: ${orderId})`);

    // Initialize message buffer for this seller
    sellerMessageBuffer.set(orderId, {
        messages: [],
        timeoutId: null,
        sellerName: sellerName,
        productName: productName
    });

    // Track processed message IDs to avoid duplicates
    const processedMessageIds = new Set();

    // Start listening to messages
    const unsubscribe = db.collection('orders').doc(orderId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const msg = change.doc.data();
                    const msgId = change.doc.id;

                    // Only process NEW seller messages (not already processed)
                    if (msg.sender === 'seller' && !processedMessageIds.has(msgId)) {
                        processedMessageIds.add(msgId);

                        // Only process messages from last 5 minutes (avoid old messages)
                        const msgTime = msg.timestamp?.toDate();
                        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                        if (!msgTime || msgTime > fiveMinutesAgo) {
                            handleNewSellerMessage(orderId, sellerName, productName, msg, msgId);
                        }
                    }
                }
            });
        }, (error) => {
            console.error(`Background listener error for ${orderId}:`, error);
        });

    // Store unsubscribe function and metadata
    backgroundChatListeners.set(orderId, {
        unsubscribe,
        sellerName,
        productName,
        startTime: Date.now()
    });
}

// 👑 Handle incoming seller message with buffering
async function handleNewSellerMessage(orderId, sellerName, productName, msg, msgId) {
    const buffer = sellerMessageBuffer.get(orderId);
    if (!buffer) return;

    // Clear existing timeout (to batch messages)
    if (buffer.timeoutId) {
        clearTimeout(buffer.timeoutId);
    }

    // Rewrite as butler message immediately
    const butlerMessage = await rewriteAsButler(msg.text);

    // Add to buffer
    buffer.messages.push({
        text: butlerMessage,
        originalText: msg.text,
        timestamp: msg.timestamp?.toDate() || new Date(),
        msgId: msgId
    });

    // Set new timeout for summarization (5 second buffer)
    buffer.timeoutId = setTimeout(() => {
        summarizeAndReportToKing(orderId, sellerName, productName);
    }, SELLER_MESSAGE_BUFFER_DELAY);

    console.log(`👑 Buffered message from ${sellerName}, ${buffer.messages.length} messages pending`);
}

// 👑 Summarize buffered messages and report to King
async function summarizeAndReportToKing(orderId, sellerName, productName) {
    const buffer = sellerMessageBuffer.get(orderId);
    if (!buffer || buffer.messages.length === 0) return;

    const messages = buffer.messages;
    buffer.messages = []; // Clear buffer
    buffer.timeoutId = null;

    // If only one message, report directly
    if (messages.length === 1) {
        const report = messages[0].text;
        const contextMsg = currentLanguage === 'en'
            ? `🎩 **${sellerName}:** ${report}\n\n*Just type your reply below—I'll pass it on to them.*`
            : `🎩 **${sellerName}:** ${report}\n\n*Ketik saja balasan Anda di bawah—saya yang akan menyampaikan ke mereka.*`;

        addBotMessage(contextMsg);
        speakButlerSummary(report);

        // Set active context for easy replying (30 second window)
        activeSellerContext = {
            orderId,
            sellerName,
            productName,
            lastMessage: messages[0].originalText,
            timestamp: Date.now()
        };

    } else {
        // Multiple messages - generate summary using AI
        try {
            const summary = await generateSellerSummary(sellerName, productName, messages);
            const contextMsg = currentLanguage === 'en'
                ? `🎩 **Updates from ${sellerName}:**\n\n${summary}\n\n*Just type your reply below—I'll pass it on to them.*`
                : `🎩 **Update dari ${sellerName}:**\n\n${summary}\n\n*Ketik saja balasan Anda di bawah—saya yang akan menyampaikan ke mereka.*`;

            addBotMessage(contextMsg);
            speakButlerSummary(`Updates from ${sellerName}: ${summary}`);

            // Set active context
            activeSellerContext = {
                orderId,
                sellerName,
                productName,
                lastMessage: messages[messages.length - 1].originalText,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Failed to generate summary:', error);
            // Fallback: report count
            const fallbackMsg = currentLanguage === 'en'
                ? `🎩 **${sellerName}** has sent ${messages.length} messages regarding your order.`
                : `🎩 **${sellerName}** telah mengirim ${messages.length} pesan mengenai pesanan Anda.`;
            addBotMessage(fallbackMsg);
        }
    }

    console.log(`👑 Reported ${messages.length} message(s) from ${sellerName} to King`);
}

// 👑 Generate AI summary of multiple seller messages
async function generateSellerSummary(sellerName, productName, messages) {
    const messageTexts = messages.map(m => m.originalText).join('\n- ');

    const systemPrompt = currentLanguage === 'en'
        ? `You are a royal butler summarizing merchant communications for the King. Summarize the following messages from ${sellerName} about ${productName} in 2-3 concise sentences. Be formal and respectful. Focus on the key information (status, questions, offers).`
        : `Anda adalah pelayan kerajaan yang merangkum komunikasi pedagang untuk Yang Mulia. Rangkumlah pesan berikut dari ${sellerName} tentang ${productName} dalam 2-3 kalimat singkat. Gunakan bahasa formal dan sopan. Fokus pada informasi penting (status, pertanyaan, penawaran).`;

    const userPrompt = currentLanguage === 'en'
        ? `Messages from ${sellerName}:\n- ${messageTexts}\n\nProvide a concise summary for the King:`
        : `Pesan dari ${sellerName}:\n- ${messageTexts}\n\nBerikan rangkuman singkat untuk Yang Mulia:`;

    try {
        const { content } = await callChatAPI({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.4,
            max_tokens: 200
        });
        return content?.trim() ||
            (currentLanguage === 'en'
                ? `${sellerName} has sent ${messages.length} messages regarding your order.`
                : `${sellerName} telah mengirim ${messages.length} pesan mengenai pesanan Anda.`);
    } catch (error) {
        console.error('Summary generation failed:', error);
        return currentLanguage === 'en'
            ? `${sellerName} has sent ${messages.length} messages regarding your order.`
            : `${sellerName} telah mengirim ${messages.length} pesan mengenai pesanan Anda.`;
    }
}

// 👑 AI-Powered: Detect if user message is a reply to seller or normal chat
async function detectSellerReplyIntent(userMessage) {
    if (!activeSellerContext) {
        return { intent: 'normal_chat', confidence: 1.0, message: null };
    }

    const { sellerName, productName, lastMessage } = activeSellerContext;

    const systemPrompt = currentLanguage === 'en'
        ? `You are an intelligent assistant determining user intent. Analyze if the user's message is:

A) A REPLY to the seller's last message (they want to respond to ${sellerName})
B) NORMAL CHAT with you (the AI assistant, not meant for the seller)

CONTEXT:
- Seller (${sellerName}) just sent: "${lastMessage}"
- Product: ${productName}

ANALYZE:
- Is the user answering/responding to the seller's question/offer?
- Or are they asking YOU (the AI) something unrelated?
- Is this a direct response (yes/no/ok/sure) or something else?

Respond in JSON format:
{
  "intent": "reply_to_seller" OR "normal_chat",
  "confidence": 0.0 to 1.0,
  "message_for_seller": "Professional version of the message to send to seller (if intent is reply)",
  "explanation": "Brief reason for your decision"
}

Examples:
User: "yes" → reply_to_seller (0.95), "Yes, please proceed.", "Direct agreement"
User: "what's the weather?" → normal_chat (0.99), null, "Asking AI, not seller"
User: "ok tell them go ahead" → reply_to_seller (0.90), "Please proceed.", "Command to reply"
User: "how much is that?" → reply_to_seller (0.75), "What is the price?", "Likely asking seller about price"
User: "can you find me noodles?" → normal_chat (0.95), null, "Asking AI assistant for help"`
        : `Anda adalah asisten cerdas yang menentukan niat pengguna. Analisis apakah pesan pengguna adalah:

A) BALASAN ke pesan terakhir pedagang (mereka ingin membalas ${sellerName})
B) CHAT NORMAL dengan Anda (asisten AI, bukan untuk pedagang)

KONTEKS:
- Pedagang (${sellerName}) baru saja mengirim: "${lastMessage}"
- Produk: ${productName}

ANALISIS:
- Apakah pengguna menjawab/membalas pertanyaan/penawaran pedagang?
- Atau apakah mereka bertanya kepada ANDA (AI) tentang hal lain?
- Apakah ini respons langsung (ya/tidak/oke/baik) atau sesuatu yang lain?

Respons dalam format JSON:
{
  "intent": "reply_to_seller" ATAU "normal_chat",
  "confidence": 0.0 sampai 1.0,
  "message_for_seller": "Versi profesional pesan untuk dikirim ke pedagang (jika intent adalah reply)",
  "explanation": "Alasan singkat untuk keputusan Anda"
}

Contoh:
User: "ya" → reply_to_seller (0.95), "Baik, silakan lanjutkan.", "Persetujuan langsung"
User: "cuaca hari ini gimana?" → normal_chat (0.99), null, "Bertanya ke AI, bukan pedagang"
User: "oke bilang ke mereka lanjut" → reply_to_seller (0.90), "Silakan lanjutkan.", "Perintah untuk membalas"
User: "harganya berapa?" → reply_to_seller (0.75), "Berapa harganya?", "Kemungkinan bertanya ke pedagang"
User: "cariin mie dong" → normal_chat (0.95), null, "Meminta asisten AI untuk mencari"`;

    const userPrompt = `User's message: "${userMessage}"

Analyze and respond in JSON format:`;

    try {
        console.log('🧠 AI detecting intent for:', userMessage);

        const { content: aiResponse } = await callChatAPI({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 300,
            response_format: { type: 'json_object' }
        });

        // Parse JSON response
        let result;
        try {
            result = JSON.parse(aiResponse);
        } catch (e) {
            // Fallback: try to extract JSON from text
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Invalid JSON response');
            }
        }

        console.log('🎯 AI Intent Detection:', {
            intent: result.intent,
            confidence: result.confidence,
            explanation: result.explanation
        });

        return {
            intent: result.intent || 'normal_chat',
            confidence: result.confidence || 0.5,
            message: result.message_for_seller || userMessage,
            explanation: result.explanation || 'No explanation'
        };

    } catch (error) {
        console.error('AI intent detection failed:', error);
        // Fallback: use simple heuristic
        const words = userMessage.trim().split(/\s+/);
        if (words.length <= 3) {
            return { intent: 'reply_to_seller', confidence: 0.7, message: userMessage, explanation: 'Fallback: short message' };
        }
        return { intent: 'normal_chat', confidence: 0.7, message: null, explanation: 'Fallback: AI detection failed' };
    }
}

// 👑 Handle King's reply with EXPLICIT command detection
async function handleKingReply(message) {
    // Check if we have an active seller context
    if (!activeSellerContext) {
        return false; // No active context, process as normal chat
    }

    const lowerMsg = message.toLowerCase().trim();
    const { sellerName } = activeSellerContext;

    // EXPLICIT COMMAND PATTERNS
    // English patterns
    const replyToPattern = /^(reply|respond)\s+to\s+(.+)$/i;
    const tellThemPattern = /^(tell|say\s+to)\s+them\b/i;
    const tellSellerPattern = /^(tell|say\s+to|ask)\s+(\w+)/i;

    // Indonesian patterns
    const balasKePattern = /^balas\s+ke\s+(.+)$/i;
    const bilangKeMerekaPattern = /^(bilang|katakan)\s+ke\s+mereka\b/i;
    const katakanKePattern = /^(katakan|bilang|tanya)\s+ke\s+(\w+)/i;

    let isExplicitReply = false;
    let messageContent = message;
    let extractedSellerName = null;

    // Check English patterns
    if (replyToPattern.test(message)) {
        const match = message.match(replyToPattern);
        extractedSellerName = match[2].trim();
        // Remove the command part to get the message content
        messageContent = message.replace(replyToPattern, '').trim();
        // If there's additional text after seller name, that's the message
        if (messageContent) {
            isExplicitReply = extractedSellerName.toLowerCase().includes(sellerName.toLowerCase()) ||
                sellerName.toLowerCase().includes(extractedSellerName.toLowerCase());
        } else {
            // "reply to [seller]" without message - will prompt for message
            isExplicitReply = extractedSellerName.toLowerCase().includes(sellerName.toLowerCase()) ||
                sellerName.toLowerCase().includes(extractedSellerName.toLowerCase());
            messageContent = null; // Signal to prompt for message
        }
    }
    else if (tellThemPattern.test(message)) {
        isExplicitReply = true;
        messageContent = message.replace(tellThemPattern, '').trim();
    }
    else if (tellSellerPattern.test(message)) {
        const match = message.match(tellSellerPattern);
        extractedSellerName = match[2].trim();
        messageContent = message.replace(tellSellerPattern, '').trim();
        isExplicitReply = extractedSellerName.toLowerCase().includes(sellerName.toLowerCase()) ||
            sellerName.toLowerCase().includes(extractedSellerName.toLowerCase());
    }
    // Check Indonesian patterns
    else if (balasKePattern.test(message)) {
        const match = message.match(balasKePattern);
        extractedSellerName = match[1].trim();
        messageContent = message.replace(balasKePattern, '').trim();
        if (messageContent) {
            isExplicitReply = extractedSellerName.toLowerCase().includes(sellerName.toLowerCase()) ||
                sellerName.toLowerCase().includes(extractedSellerName.toLowerCase());
        } else {
            isExplicitReply = extractedSellerName.toLowerCase().includes(sellerName.toLowerCase()) ||
                sellerName.toLowerCase().includes(extractedSellerName.toLowerCase());
            messageContent = null;
        }
    }
    else if (bilangKeMerekaPattern.test(message)) {
        isExplicitReply = true;
        messageContent = message.replace(bilangKeMerekaPattern, '').trim();
    }
    else if (katakanKePattern.test(message)) {
        const match = message.match(katakanKePattern);
        extractedSellerName = match[2].trim();
        messageContent = message.replace(katakanKePattern, '').trim();
        isExplicitReply = extractedSellerName.toLowerCase().includes(sellerName.toLowerCase()) ||
            sellerName.toLowerCase().includes(extractedSellerName.toLowerCase());
    }

    // If explicit command detected
    if (isExplicitReply) {
        const { orderId, productName } = activeSellerContext;

        // If no message content provided, prompt the user
        if (!messageContent) {
            const promptMsg = currentLanguage === 'en'
                ? `🏛️ What message would you like me to convey to ${sellerName}?`
                : `🏛️ Pesan apa yang ingin Anda sampaikan ke ${sellerName}?`;
            addBotMessage(promptMsg);
            return true; // Handled, but waiting for message
        }

        try {
            // Paraphrase the reply
            const professionalReply = await paraphraseForSeller(messageContent);

            // Send to seller
            await db.collection('orders').doc(orderId)
                .collection('messages').add({
                    text: professionalReply,
                    sender: 'buyer',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    isKingMode: true,
                    originalText: messageContent,
                    isReply: true
                });

            // Confirm to King
            const confirmMsg = currentLanguage === 'en'
                ? `🏛️ Message sent to ${sellerName}: "${professionalReply}"`
                : `🏛️ Pesan terkirim ke ${sellerName}: "${professionalReply}"`;

            addBotMessage(confirmMsg);

            // Reset context after successful reply
            activeSellerContext = null;

            return true; // Handled as reply

        } catch (error) {
            console.error('Failed to send reply:', error);
            addBotMessage(currentLanguage === 'en'
                ? `😔 My apologies, Your Majesty. I was unable to send your message to ${sellerName}.`
                : `😔 Maaf, Yang Mulia. Saya gagal mengirim pesan Anda ke ${sellerName}.`);
            return true; // Still handled, just failed
        }
    }

    return false; // Not a reply command, process as normal chat
}

// 👑 Stop background chat listener for completed orders
function stopBackgroundChatListener(orderId) {
    const listener = backgroundChatListeners.get(orderId);
    if (listener) {
        listener.unsubscribe();
        backgroundChatListeners.delete(orderId);
        sellerMessageBuffer.delete(orderId);
        console.log(`👑 Stopped background listener for order: ${orderId}`);

        // If this was the active context, clear it
        if (activeSellerContext && activeSellerContext.orderId === orderId) {
            activeSellerContext = null;
        }
    }
}

// 👑 Send initial message to seller (without opening chat modal)
async function kingModeSendInitialMessage(order) {
    try {
        // Generate initial professional message
        const initialMessage = currentLanguage === 'en'
            ? `Greetings! His Majesty has placed an order (#${order.orderId}) for ${order.quantity}x ${order.productName}. We look forward to your prompt preparation and confirmation. Payment via ${order.paymentMethod.toUpperCase()}. Thank you!`
            : `Selamat datang! Yang Mulia telah memesan (#${order.orderId}) ${order.quantity}x ${order.productName}. Kami menantikan persiapan dan konfirmasi Anda. Pembayaran via ${order.paymentMethod.toUpperCase()}. Terima kasih!`;

        // Send the message
        await db.collection('orders').doc(order.id)
            .collection('messages').add({
                text: initialMessage,
                sender: 'buyer',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                isKingMode: true,
                autoGenerated: true
            });

        console.log(`👑 King Mode: Initial message sent to ${order.sellerName}`);

        // Report to King in main chat
        const report = currentLanguage === 'en'
            ? `🏛️ I have notified ${order.sellerName} of your order, my Lord. I will monitor their response.`
            : `🏛️ Saya telah memberitahu ${order.sellerName} tentang pesanan Anda, Yang Mulia. Saya akan memantau balasan mereka.`;

        addBotMessage(report);

    } catch (error) {
        console.error('Failed to send initial message:', error);
    }
}

// 👑 Speak butler summary using TTS
function speakButlerSummary(summary) {
    if (!('speechSynthesis' in window)) {
        console.warn('⚠️ Text-to-Speech not supported');
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean up the summary for speech (remove markdown, emojis)
    const cleanSummary = summary
        .replace(/[#*_]/g, '')
        .replace(/👑|📦|💰|💳|🏛️|🎩/g, '')
        .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSummary);
    utterance.lang = currentLanguage === 'en' ? 'en-GB' : 'id-ID';
    utterance.rate = 0.85;
    utterance.pitch = 0.9;

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
        v.lang.startsWith(currentLanguage === 'en' ? 'en-GB' : 'id') &&
        v.name.toLowerCase().includes('male')
    ) || voices.find(v => v.lang.startsWith(currentLanguage === 'en' ? 'en' : 'id'));

    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
    console.log('🔊 Butler summary spoken:', cleanSummary.substring(0, 100) + '...');
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
/**
 * @param {string} userMessage
 * @param {{ sellerName: string, productName: string, lastMessage: string, orderId: string } | null} [orderContext] - When set (King Mode order chat), AI can return reply_to_seller to send message to seller
 */
async function processWithGroq(userMessage, orderContext) {
    // Build detailed product catalog for AI with categories
    const productList = products.slice(0, 50).map(p => ({
        name: p.name,
        category: p.category || 'uncategorized',
        price: p.price
    }));

    const productCatalog = productList.length > 0
        ? `\n\nAVAILABLE PRODUCTS(you MUST choose from these EXACT names): \n${productList.map(p => `- "${p.name}" (${p.category}, Rp${p.price})`).join('\n')} \n`
        : '';

    // Language-aware Koko personality
    const isEnglish = currentLanguage === 'en';

    // Previous context from ai_memory (localStorage) for continuity across reloads
    const previousContext = getKokoAiMemory();
    const contextBlock = previousContext ? `\n\nPREVIOUS CONTEXT (from last session): ${previousContext}\nUse this to give better follow-up recommendations.\n` : '';

    // Order chat context: AI decides if user is replying to seller or chatting with Koko
    const orderBlock = orderContext
        ? (isEnglish
            ? `\n\nORDER CHAT CONTEXT (user is in a conversation about an order):
- Seller: ${orderContext.sellerName}
- Product: ${orderContext.productName}
- Last message FROM SELLER to user: "${orderContext.lastMessage}"

Use the CONVERSATION HISTORY in the messages below to understand what was discussed before. The user is continuing that order conversation.

**PRIORITY RULE FOR REPLY DETECTION:**
When ORDER CHAT CONTEXT exists and the user's message is SHORT (under 20 words), ASSUME it is an answer to the seller unless it clearly contains a different product name or "I want" / "cari" / "pesan" language.

**WHEN TO USE reply_to_seller:**
1. User gives short affirmatives: "yes", "no", "ya", "mau", "iya", "gak", "tidak", "boleh", "oke", "ok", "sure"
2. User gives preference answers: "pedes", "gak pedes", "sedang", "level 1", "level 2", "dicampur", "dipisah", "campur aja", "tanpa..."
3. User gives quantity answers: "satu aja", "dua", "semua", "cukup", "tambah lagi"
4. User gives confirmation: "siap", "lanjut", "gas", "mantap", "oke bang", "baik"
5. User gives instruction: "jangan terlalu...", "yang banyak", "sedikit aja"

**DO NOT use reply_to_seller when:**
- User clearly asks for a DIFFERENT product (mentions new product name)
- User uses phrases like "I want", "cari", "pesan", "order"

**EXAMPLES:**
- Seller: "mau pedes gak?" + User: "mau" → intent: reply_to_seller, message_for_seller: "Baik, saya mau pedes."
- Seller: "mau pedes gak?" + User: "iya gw mau yg pedes" → intent: reply_to_seller, message_for_seller: "Baik, saya mau yang pedas."
- Seller: "mau level berapa?" + User: "level 2 aja" → intent: reply_to_seller, message_for_seller: "Baik, level 2."
- Seller: "dipisahkan atau dicampur?" + User: "campur aja" → intent: reply_to_seller, message_for_seller: "Baik, dicampur saja."
- Seller: "sudah siap, mau diantar?" + User: "siap bang" → intent: reply_to_seller, message_for_seller: "Baik, siap. Silakan diantar."
- Seller: "tambah nasi?" + User: "gak usah" → intent: reply_to_seller, message_for_seller: "Tidak usah, terima kasih."
- Seller: "mau pedes gak?" + User: "oh ya bilangin juga ke dia tambahin sayur" → intent: reply_to_seller, message_for_seller: "Baik, tolong tambahkan sayur juga ya."
`
            : `\n\nKONTEKS OBROLAN PESANAN (user sedang dalam percakapan tentang pesanan):
- Pedagang: ${orderContext.sellerName}
- Produk: ${orderContext.productName}
- Pesan terakhir DARI PEDAGANG ke user: "${orderContext.lastMessage}"

Gunakan RIWAYAT PERCAKAPAN di pesan berikut untuk memahami apa yang sudah dibicarakan tadi. User sedang melanjutkan obrolan pesanan itu.

**ATURAN PRIORITAS DETEKSI BALASAN:**
Ketika KONTEKS OBROLAN PESANAN ada dan pesan user PENDEK (kurang dari 20 kata), ANGGAP itu adalah jawaban ke pedagang kecuali pesan itu jelas berisi nama produk lain atau bahasa seperti "mau pesan" / "cari" / "order".

**KAPAN GUNAKAN reply_to_seller:**
1. User memberi jawaban singkat: "ya", "mau", "iya", "gak", "tidak", "boleh", "oke", "ok", "siap"
2. User memberi preferensi: "pedes", "gak pedes", "sedang", "level 1", "level 2", "dicampur", "dipisah", "campur aja", "tanpa..."
3. User memberi jumlah: "satu aja", "dua", "semua", "cukup", "tambah lagi"
4. User konfirmasi: "siap", "lanjut", "gas", "mantap", "oke bang", "baik"
5. User beri instruksi: "jangan terlalu...", "yang banyak", "sedikit aja"

**JANGAN gunakan reply_to_seller ketika:**
- User jelas minta produk BEDA (sebut nama produk baru)
- User pakai frasa seperti "mau pesan", "cari", "order baru"

**CONTOH:**
- Pedagang: "mau pedes gak?" + User: "mau" → intent: reply_to_seller, message_for_seller: "Baik, saya mau pedes."
- Pedagang: "mau pedes gak?" + User: "iya gw mau yg pedes" → intent: reply_to_seller, message_for_seller: "Baik, saya mau yang pedas."
- Pedagang: "mau level berapa?" + User: "level 2 aja" → intent: reply_to_seller, message_for_seller: "Baik, level 2."
- Pedagang: "dipisahkan atau dicampur?" + User: "campur aja" → intent: reply_to_seller, message_for_seller: "Baik, dicampur saja."
- Pedagang: "sudah siap, mau diantar?" + User: "siap bang" → intent: reply_to_seller, message_for_seller: "Baik, siap. Silakan diantar."
- Pedagang: "tambah nasi?" + User: "gak usah" → intent: reply_to_seller, message_for_seller: "Tidak usah, terima kasih."
- Pedagang: "mau pedes gak?" + User: "oh ya bilangin juga ke dia tambahin sayur" → intent: reply_to_seller, message_for_seller: "Baik, tolong tambahkan sayur juga ya."
`)
        : '';

    // Enhanced system prompt with conversation memory and not_found intent
    const systemPrompt = isEnglish
        ? `You are "Koko", the Cheeky Connoisseur - a witty shopping assistant for an Indonesian food marketplace.
                ${productCatalog}
            ${contextBlock}
            ${orderBlock}
            UNDERSTANDING USER WANTS:
            - First infer what the user really wants: goal (quick snack, hearty meal, gift, budget), situation (fast, relaxed), taste (sweet, spicy, neutral), or category (drink, food, snack).
            - Use this understanding to pick the BEST matching products, not just keyword match. Mention it briefly in your response when relevant.

            PERSONALITY:
            - Deadpan snarky but helpful like a real waiter / waitress
                - Use casual English slang: "Yo", "Bruh", "Lowkey", "No cap", "Valid"
                    - Keep responses SHORT(2 - 3 sentences max)
                        - RESPOND IN ENGLISH ONLY
                            - Remember previous messages for context

RESPONSE FORMAT(JSON):
                {
                    "intent": "search" | "greeting" | "help" | "chat" | "not_found" | "followup" | "reply_to_seller",
                        "selectedProducts": ["Exact Product Name 1", "Exact Product Name 2"],
                            "userWant": "short 1-line summary of what the user is looking for (optional but recommended)",
                                "response": "Your cheeky response IN ENGLISH (what to show the user in chat)",
                                    "productComment": "optional comment about products IN ENGLISH",
                                        "notFoundItem": "the item user asked for that we don't have",
                                            "message_for_seller": "ONLY when intent is reply_to_seller: short professional message to send to the seller"
                }

            INTENTS:
            - "reply_to_seller": User is replying to the seller about their order (only use when ORDER CHAT CONTEXT is present above)
            - "search": User wants a product we have → return matching products
                - "not_found": User wants something we DON'T have (burger, sushi, pizza, etc.) → apologize and suggest alternatives
                    - "followup": User asks follow - up about previous request(like "what's similar?", "anything else?")
                        - "greeting": User says hi / hello
                            - "chat": General conversation
                                - "help": User needs help

CRITICAL RULES:
            1. ONLY return product names that EXACTLY match the menu above
            2. Always infer userWant (what they really want) and use it to choose the best products
            3. If user asks for something NOT in the menu(burger, sushi, pizza, ramen, etc.):
                - Use intent "not_found"
                    - Set notFoundItem to what they asked for
   - Suggest similar FOOD items if they asked for food, DRINKS if they asked for drinks
                - Be apologetic but offer alternatives
            4. If user asks "what's similar?" or "anything else?" → Use intent "followup" and check the PREVIOUS message context
            5. Maximum 5 products in selectedProducts
            6. For category - only requests(drinks, food, snacks) → pick 3 - 5 items from that category

            EXAMPLES:

            User: "I want burger"
            Response: { "intent": "not_found", "selectedProducts": ["Nasi Goreng Spesial", "Mie Ayam"], "userWant": "filling meal like burger", "response": "Burger? Sorry bruh, we don't have that here! But we got some solid filling options.", "productComment": "Check these out instead! 🍽️", "notFoundItem": "burger" }

            User: "what's similar then?"
            Response: { "intent": "followup", "selectedProducts": ["Nasi Goreng Spesial", "Ayam Bakar"], "userWant": "something filling like previous request", "response": "If you wanted something filling like a burger, these might hit the spot!", "productComment": "Hearty Indonesian dishes! 💪" }

            User: "do you have sushi?"
            Response: { "intent": "not_found", "selectedProducts": [], "userWant": "sushi / Japanese-style food", "response": "No sushi here, we're all about Indonesian food! But yo, we got amazing stuff.", "productComment": "Want me to recommend something?", "notFoundItem": "sushi" }

            User: "I want coffee"
            Response: { "intent": "search", "selectedProducts": ["Kopi Susu"], "userWant": "coffee / caffeine drink", "response": "Coffee? Valid choice! Here's what we got.", "productComment": "This one's a fan favorite! ☕" }

            IMPORTANT:
            - ALWAYS respond with valid JSON
                - ALWAYS respond in ENGLISH
                    - Use context from previous messages to give better recommendations
                        - If item not found, ALWAYS suggest alternatives based on what they wanted`
        : `You are "Koko", the Cheeky Connoisseur - a witty shopping assistant for an Indonesian food marketplace.
                ${productCatalog}
            ${contextBlock}
            ${orderBlock}
            UNDERSTANDING USER WANTS:
            - First infer what the user really wants: goal (ngemil, makan berat, hadiah, budget), situasi (cepat, santai), rasa (manis, pedas, netral), or kategori (minuman, makanan, snack).
            - Use this understanding to pick the BEST matching products, not just keyword match. Mention it briefly in your response when relevant.

            PERSONALITY:
            - Deadpan snarky but helpful like a real waiter / waitress
                - Use Indonesian slang: "Waduh", "Jujurly", "Bos", "Valid", "No debat"
                    - Keep responses SHORT(2 - 3 sentences max)
                        - RESPOND IN INDONESIAN ONLY
                            - Remember previous messages for context

RESPONSE FORMAT(JSON):
                {
                    "intent": "search" | "greeting" | "help" | "chat" | "not_found" | "followup" | "reply_to_seller",
                        "selectedProducts": ["Exact Product Name 1", "Exact Product Name 2"],
                            "userWant": "ringkasan 1 baris apa yang user cari (opsional tapi disarankan)",
                                "response": "Your cheeky response IN INDONESIAN (yang ditampilkan ke user di chat)",
                                    "productComment": "optional comment about products IN INDONESIAN",
                                        "notFoundItem": "the item user asked for that we don't have",
                                            "message_for_seller": "HANYA bila intent reply_to_seller: pesan singkat profesional untuk dikirim ke pedagang"
                }

            INTENTS:
            - "reply_to_seller": User membalas pedagang tentang pesanannya (hanya gunakan bila ada KONTEKS OBROLAN PESANAN di atas)
            - "search": User wants a product we have → return matching products
                - "not_found": User wants something we DON'T have (burger, sushi, pizza, etc.) → apologize and suggest alternatives
                    - "followup": User asks follow - up about previous request(like "yang mirip apa?", "ada yang lain?")
                        - "greeting": User says hi / hello
                            - "chat": General conversation
                                - "help": User needs help

CRITICAL RULES:
            1. ONLY return product names that EXACTLY match the menu above
            2. Always infer userWant (apa yang user benar-benar mau) and use it to choose the best products
            3. If user asks for something NOT in the menu(burger, sushi, pizza, ramen, etc.):
                - Use intent "not_found"
                    - Set notFoundItem to what they asked for
   - Suggest similar FOOD items if they asked for food, DRINKS if they asked for drinks
                - Be apologetic but offer alternatives
            4. If user asks "yang mirip apa?" or "ada yang lain?" → Use intent "followup" and check the PREVIOUS message context
            5. Maximum 5 products in selectedProducts
            6. For category - only requests(minuman, makanan, snack) → pick 3 - 5 items from that category

            EXAMPLES:

            User: "burger dong"
            Response: { "intent": "not_found", "selectedProducts": ["Nasi Goreng Spesial", "Mie Ayam"], "userWant": "makanan mengenyangkan kayak burger", "response": "Waduh, burger gak ada, Bos! Tapi kita punya makanan yang bikin kenyang juga nih.", "productComment": "Coba yang ini deh! 🍽️", "notFoundItem": "burger" }

            User: "yang mirip apa dong?"
            Response: { "intent": "followup", "selectedProducts": ["Nasi Goreng Spesial", "Ayam Bakar"], "userWant": "yang mirip permintaan sebelumnya", "response": "Kalau mau yang mengenyangkan kayak burger, ini cocok, Bos!", "productComment": "Mantap buat perut lapar! 💪" }

            User: "ada sushi gak?"
            Response: { "intent": "not_found", "selectedProducts": [], "userWant": "sushi / makanan ala Jepang", "response": "Sushi gak ada, Bos! Kita fokus makanan Indonesia. Tapi ada yang enak lho!", "productComment": "Mau saya rekomendasiin?", "notFoundItem": "sushi" }

            User: "mau kopi"
            Response: { "intent": "search", "selectedProducts": ["Kopi Susu"], "userWant": "kopi / minuman berkafein", "response": "Kopi? Ah, sesama pecinta kafein. Valid, Bos!", "productComment": "Ini kopi favorit! ☕" }

            IMPORTANT:
            - ALWAYS respond with valid JSON
                - ALWAYS respond in INDONESIAN
                    - Use context from previous messages to give better recommendations
                        - If item not found, ALWAYS suggest alternatives based on what they wanted`;

    try {
        // Build messages array with conversation history for context
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-MAX_HISTORY), // Include recent history
            { role: 'user', content: userMessage }
        ];

        let text;
        try {
            const out = await callChatAPI({
                messages,
                temperature: 0.4,
                max_tokens: 300
            });
            text = out.content;
        } catch (apiError) {
            throw apiError;
        }

        // Parse the JSON response (handles markdown wrappers and extra text)
        let result = parseKokoResponseJson(text);
        const validResult = result && typeof result.intent !== 'undefined' && (result.response != null || (result.intent === 'reply_to_seller' && result.message_for_seller));
        if (!validResult) {
            // First response (e.g. from Groq) had invalid format: retry with OpenRouter only so we "pindah ke OpenRouter"
            try {
                const out = await callChatAPI({
                    messages,
                    temperature: 0.4,
                    max_tokens: 300,
                    useOpenRouterOnly: true
                });
                result = parseKokoResponseJson(out.content);
            } catch (_) {
                result = null;
            }
        }
        if (result && typeof result.intent !== 'undefined' && (result.response != null || (result.intent === 'reply_to_seller' && result.message_for_seller))) {
            // Normalize: ensure response is string (use fallback for reply_to_seller), selectedProducts is array
            if (typeof result.response !== 'string') result.response = result.response != null ? String(result.response) : '';
            if (!Array.isArray(result.selectedProducts)) result.selectedProducts = result.selectedProducts ? [result.selectedProducts] : [];

            // Add to conversation history
            conversationHistory.push({ role: 'user', content: userMessage });
            conversationHistory.push({ role: 'assistant', content: result.response || (result.intent === 'reply_to_seller' ? '(reply sent to seller)' : '') });

            // Trim history if too long
            if (conversationHistory.length > MAX_HISTORY * 2) {
                conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
            }

            // Persist to ai_memory for next session
            setKokoAiMemory({
                userWant: result.userWant || '',
                intent: result.intent || '',
                summary: userMessage.length > 80 ? userMessage.slice(0, 77) + '...' : userMessage
            });

            return result;
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f45191c0-8997-4d71-a40e-6c72414ba925', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app.js:processWithGroq:throw', message: 'throwing Invalid response format', data: { resultNull: result === null, hasIntent: result && typeof result.intent !== 'undefined', hasResponse: result && result.response != null }, timestamp: Date.now(), hypothesisId: 'A,B' }) }).catch(() => { });
        // #endregion
        throw new Error('Invalid response format');
    } catch (error) {
        console.error('Chat API error (Groq + OpenRouter):', error);
        // Fallback to simple keyword extraction
        return fallbackProcessing(userMessage);
    }
}

// Fallback processing if chat API fails
function fallbackProcessing(message) {
    const lowerMessage = message.toLowerCase();

    // Check for greetings (whole word match only)
    const greetings = ['hello', 'hi', 'halo', 'hey', 'selamat'];
    const words = lowerMessage.replace(/[^\w\s]/g, '').split(/\s+/);
    if (greetings.some(g => words.includes(g))) {
        const out = { intent: 'greeting', keywords: [], response: 'Hello! 👋 How can I help you find products today?' };
        setKokoAiMemory({ userWant: '', intent: 'greeting', summary: message.slice(0, 80) });
        return out;
    }

    // Check for help
    if (lowerMessage.includes('help') || lowerMessage.includes('bantuan')) {
        const out = {
            intent: 'help',
            keywords: [],
            response: `I can help you find products! Try asking:
• "I want nasi padang"
• "Show me something sweet"
• "Find cheap food"
• "What drinks do you have?"`
        };
        setKokoAiMemory({ userWant: '', intent: 'help', summary: message.slice(0, 80) });
        return out;
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

    setKokoAiMemory({
        userWant: expandedKeywords.length ? expandedKeywords.join(', ') : '',
        intent: 'search',
        summary: message.length > 80 ? message.slice(0, 77) + '...' : message
    });
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

    // 👑 KING MODE: Check if confirming pending AI-detected reply
    if (isKingMode && pendingKingModeReply) {
        const lowerMsg = message.toLowerCase().trim();
        const yesResponses = currentLanguage === 'en'
            ? ['yes', 'ya', 'yeah', 'yep', 'sure', 'ok', 'okay', 'send it', 'go ahead', 'do it']
            : ['ya', 'yes', 'y', 'yep', 'sure', 'oke', 'ok', 'kirim', 'lanjut', 'gas'];

        if (yesResponses.some(r => lowerMsg.includes(r))) {
            // User confirmed - send the pending message
            const { orderId, sellerName, message: msgToSend } = pendingKingModeReply;

            try {
                await db.collection('orders').doc(orderId)
                    .collection('messages').add({
                        text: msgToSend,
                        sender: 'buyer',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        isKingMode: true,
                        originalText: pendingKingModeReply.originalMessage,
                        isReply: true,
                        confirmedByUser: true
                    });

                const confirmMsg = currentLanguage === 'en'
                    ? `🏛️ Message sent to ${sellerName}: "${msgToSend}"`
                    : `🏛️ Pesan terkirim ke ${sellerName}: "${msgToSend}"`;

                addBotMessage(confirmMsg);

                // Clear pending reply and active context
                pendingKingModeReply = null;
                activeSellerContext = null;

            } catch (error) {
                console.error('Failed to send confirmed reply:', error);
                addBotMessage(currentLanguage === 'en'
                    ? `😔 My apologies, I was unable to send your message to ${sellerName}.`
                    : `😔 Maaf, saya gagal mengirim pesan Anda ke ${sellerName}.`);
            }

            isProcessing = false;
            sendBtn.disabled = false;
            return;
        } else {
            // User declined or said something else - cancel pending reply
            pendingKingModeReply = null;
            addBotMessage(currentLanguage === 'en'
                ? `👑 Understood, Your Majesty. I will not send that message. What else can I help you with?`
                : `👑 Baik, Yang Mulia. Saya tidak akan mengirim pesan itu. Apa lagi yang bisa saya bantu?`);
        }
    }

    // 👑 KING MODE: Check if this is a response to feedback offer
    if (isKingMode && pendingKingModeFeedback) {
        const handled = await handleKingModeFeedbackResponse(message);
        if (handled) {
            // Feedback response was handled, stop here
            isProcessing = false;
            sendBtn.disabled = false;
            return;
        }
        // Not a feedback response, continue with normal processing
    }

    // Set processing state
    isProcessing = true;
    sendBtn.disabled = true;
    showTypingIndicator();
    updateStatus('Thinking...', true);

    try {
        // Process with AI (one model decides: reply to seller vs product chat; pass order context when in King Mode order chat)
        const orderContext = (isKingMode && activeSellerContext) ? {
            sellerName: activeSellerContext.sellerName,
            productName: activeSellerContext.productName,
            lastMessage: activeSellerContext.lastMessage,
            orderId: activeSellerContext.orderId
        } : null;
        const result = await processWithGroq(message, orderContext);

        hideTypingIndicator();

        // 👑 AI decided: user is replying to seller → send message and show Koko's response (one flow, nyambung)
        if (result.intent === 'reply_to_seller' && result.message_for_seller && activeSellerContext) {
            const { orderId, sellerName } = activeSellerContext;
            try {
                await db.collection('orders').doc(orderId)
                    .collection('messages').add({
                        text: result.message_for_seller,
                        sender: 'buyer',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        isKingMode: true,
                        originalText: message,
                        isReply: true
                    });
                if (result.response) addBotMessage(result.response);
                else {
                    const confirmMsg = currentLanguage === 'en'
                        ? `🏛️ Sent to ${sellerName}: "${result.message_for_seller}"`
                        : `🏛️ Terkirim ke ${sellerName}: "${result.message_for_seller}"`;
                    addBotMessage(confirmMsg);
                }
                activeSellerContext = null;
            } catch (err) {
                console.error('Failed to send message to seller:', err);
                addBotMessage(result.response || (currentLanguage === 'en' ? `Could not send to ${sellerName}.` : `Gagal mengirim ke ${sellerName}.`));
            }
            isProcessing = false;
            sendBtn.disabled = false;
            return;
        }

        // Check for selectedProducts (new approach - AI picks exact products)
        if (result.intent === 'search' && result.selectedProducts && result.selectedProducts.length > 0) {
            // Show Koko's pre-search response if available
            if (result.response) {
                addBotMessage(result.response);
            }

            // Filter products by exact name match (AI already selected them)
            const selectedNames = result.selectedProducts.map(n => n.toLowerCase());
            const foundProducts = products.filter(p =>
                selectedNames.includes(p.name.toLowerCase())
            );

            // Pass Koko's product comment to the results
            const searchTerm = result.selectedProducts.join(', ');
            addProductResults(foundProducts.slice(0, 5), searchTerm, result.productComment);
        }
        // Handle not_found intent - item doesn't exist, show alternatives + feedback
        else if (result.intent === 'not_found') {
            // Show Koko's apologetic response
            addBotMessage(result.response);

            // Show alternative products if any
            if (result.selectedProducts && result.selectedProducts.length > 0) {
                const selectedNames = result.selectedProducts.map(n => n.toLowerCase());
                const altProducts = products.filter(p =>
                    selectedNames.includes(p.name.toLowerCase())
                );
                if (altProducts.length > 0) {
                    addProductResults(altProducts.slice(0, 5), result.notFoundItem || message, result.productComment);
                }
            }

            // 👑 KING MODE: Offer to auto-submit feedback
            if (isKingMode && result.notFoundItem) {
                kingModeOfferFeedback(result.notFoundItem);
            } else {
                // Always show feedback prompt for not_found items (normal mode)
                addFeedbackPrompt(result.notFoundItem || message);
            }
        }
        // Handle followup intent - contextual follow-up questions
        else if (result.intent === 'followup') {
            // Show Koko's contextual response
            if (result.response) {
                addBotMessage(result.response);
            }

            // Show suggested products if any
            if (result.selectedProducts && result.selectedProducts.length > 0) {
                const selectedNames = result.selectedProducts.map(n => n.toLowerCase());
                const foundProducts = products.filter(p =>
                    selectedNames.includes(p.name.toLowerCase())
                );
                if (foundProducts.length > 0) {
                    addProductResults(foundProducts.slice(0, 5), 'recommendations', result.productComment);
                }
            }
        }
        // Fallback to old keyword-based search if selectedProducts not present
        else if (result.intent === 'search' && result.keywords && result.keywords.length > 0) {
            if (result.response) {
                addBotMessage(result.response);
            }
            const searchQuery = result.keywords.join(' ');
            const foundProducts = await searchProducts(searchQuery);
            addProductResults(foundProducts.slice(0, 5), searchQuery, result.productComment);
        } else if (result.intent === 'confused') {
            // Koko is confused - show response with feedback option
            addBotMessage(result.response);
            addFeedbackPrompt(message);
        } else if (result.response) {
            // Show AI response for greetings, chat, help
            addBotMessage(result.response);
        } else {
            // Fallback: Search with original message
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
        addBotMessage('Waduh, ada yang error nih, Bos. Coba lagi ya! 🔧');
        updateStatus('Error occurred', false);
    }

    // Reset processing state
    isProcessing = false;
    sendBtn.disabled = false;
}

// ============================================
// Feedback Modal Functions
// ============================================

// Get chat log from visible chat messages for feedback context
function getChatLogForFeedback() {
    const chatLog = [];
    const messages = chatContainer.querySelectorAll('.message');

    // Get last 20 messages for context
    const recentMessages = Array.from(messages).slice(-20);

    recentMessages.forEach(msg => {
        const isUser = msg.classList.contains('user');
        const contentEl = msg.querySelector('.message-content');

        if (contentEl) {
            // Extract text content (strip HTML tags for storage)
            let text = contentEl.innerText || contentEl.textContent || '';

            // Limit text length for storage efficiency
            if (text.length > 500) {
                text = text.substring(0, 500) + '...';
            }

            chatLog.push({
                role: isUser ? 'user' : 'bot',
                text: text.trim()
            });
        }
    });

    console.log('📋 Chat log captured:', chatLog.length, 'messages');
    return chatLog;
}

function showFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    const searchContext = document.getElementById('feedbackSearchContext');
    const lastSearchSpan = document.getElementById('feedbackLastSearch');
    const messageInput = document.getElementById('feedbackMessage');

    // Show last search query if available
    if (lastSearchQuery) {
        searchContext.style.display = 'block';
        lastSearchSpan.textContent = lastSearchQuery;
    } else {
        searchContext.style.display = 'none';
    }

    // Reset message
    messageInput.value = '';

    modal.classList.add('active');
    console.log('📝 Feedback modal opened');
}

function hideFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    modal.classList.remove('active');
}

async function submitFeedback() {
    const feedbackType = document.querySelector('input[name="feedbackType"]:checked')?.value || 'suggestion';
    const feedbackMessage = document.getElementById('feedbackMessage').value.trim();
    const submitBtn = document.getElementById('submitFeedbackBtn');

    if (!feedbackMessage) {
        alert('Tulis feedback dulu ya, Bos! 📝');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Mengirim...';

    try {
        // Capture chat log for context
        const chatLog = getChatLogForFeedback();

        await db.collection('feedback').add({
            type: feedbackType,
            message: feedbackMessage,
            searchQuery: lastSearchQuery || null,
            chatLog: chatLog, // NEW: Include chat history for admin context
            buyerSession: getBuyerSessionId(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'unread'
        });

        console.log('✅ Feedback submitted with chat log:', {
            type: feedbackType,
            message: feedbackMessage,
            chatLogCount: chatLog.length
        });

        hideFeedbackModal();
        addBotMessage('Makasih feedbacknya, Bos! 🙏 Admin bakal baca dan (semoga) beneran ditindaklanjuti. Appreciate it!');

        // Clear last search query
        lastSearchQuery = '';

    } catch (error) {
        console.error('Failed to submit feedback:', error);
        alert('Waduh, gagal kirim feedback. Coba lagi ya!');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kirim Feedback';
    }
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

// ============================================
// KING MODE BACKGROUND CHAT AGENT
// ============================================
let backgroundChatListeners = new Map();  // orderId -> {unsubscribe, sellerName, productName, lastActivity}
let sellerMessageBuffer = new Map();      // orderId -> {messages: [], timeoutId, sellerName}
let activeSellerContext = null;           // Currently focused seller for context-based replies {orderId, sellerName, productName, timestamp}
const SELLER_MESSAGE_BUFFER_DELAY = 5000;   // 5 seconds

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

            // Update order count badges
            const pendingCount = myOrders.filter(o => o.status === 'pending').length;

            // Header badge (if exists)
            const orderCountEl = document.getElementById('orderCount');
            if (orderCountEl) {
                orderCountEl.textContent = pendingCount;
                orderCountEl.style.display = pendingCount > 0 ? 'inline' : 'none';
            }

            // Bottom nav badge
            const orderBadge = document.getElementById('orderBadge');
            if (orderBadge) {
                orderBadge.textContent = pendingCount;
                orderBadge.style.display = pendingCount > 0 ? 'flex' : 'none';
            }

            console.log('📦 My orders updated:', myOrders.length);

            // 👑 KING MODE: Stop background listeners for completed/cancelled orders
            if (isKingMode && backgroundChatListeners.size > 0) {
                const completedStatuses = ['confirmed', 'delivered', 'cancelled', 'completed'];

                backgroundChatListeners.forEach((listener, orderId) => {
                    const order = myOrders.find(o => o.id === orderId);
                    if (order && completedStatuses.includes(order.status)) {
                        stopBackgroundChatListener(orderId);
                        console.log(`👑 Stopped listener for completed order: ${orderId} (${order.status})`);
                    }
                });
            }

            // Auto-refresh orders view if currently on orders tab
            if (currentTab === 'orders') {
                renderOrdersView();
            }
        }, (error) => {
            console.error('Error listening to orders:', error);
        });
}

// Show orders modal (legacy)
// Dulu aplikasi memakai modal terpisah untuk daftar pesanan.
// Sekarang pesanan ditampilkan di `ordersView`, jadi fungsi ini
// hanya disimpan untuk kompatibilitas agar pemanggilan lama tidak error.
// NOTE: dipasang ke window supaya pasti tersedia di global scope.
window.hideOrdersModal = function hideOrdersModal() {
    // start of legacy-hideOrdersModal
    // Tidak melakukan apa-apa di versi view-based.
    // end of legacy-hideOrdersModal
};

// Show orders modal

// Select payment method for pending_payment orders
async function selectOrderPayment(orderId, paymentMethod) {
    try {
        await db.collection('orders').doc(orderId).update({
            paymentMethod: paymentMethod,
            status: 'pending'  // Now ready for seller to confirm
        });

        console.log('💳 Payment method selected:', paymentMethod);

        // Show success message
        addBotMessage(`✅ Payment method selected: **${paymentMethod === 'qris' ? 'QRIS' : 'Cash'}**

${paymentMethod === 'qris'
                ? '📱 Please complete your QRIS payment'
                : '💵 Pay at the counter when your order is ready'}

📢 The seller has been notified!`);

    } catch (error) {
        console.error('Failed to select payment:', error);
        alert('Failed to select payment method. Please try again.');
    }
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
    document.getElementById('chatModalTitle').textContent = `💬 Chat: ${productName} `;

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

    // Track processed message IDs to avoid re-processing
    let processedMessageIds = new Set();

    chatMessagesUnsubscribe = db.collection('orders').doc(orderId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(async (snapshot) => {
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

            for (const doc of snapshot.docs) {
                const msg = doc.data();
                const time = msg.timestamp ? formatTimestamp(msg.timestamp.toDate()) : '';
                const msgDiv = document.createElement('div');
                // Gunakan class yang sesuai dengan CSS: .chat-message.buyer / .chat-message.seller
                const computedClassName = `chat-message ${msg.sender}`;
                msgDiv.className = computedClassName;
                msgDiv.innerHTML = `
                <div>${msg.text}</div>
                    <div class="chat-message-time">${time}</div>
            `;
                messagesContainer.appendChild(msgDiv);

                // King Mode: Intercept NEW seller messages and speak as butler
                if (isKingMode && msg.sender === 'seller' && !processedMessageIds.has(doc.id)) {
                    processedMessageIds.add(doc.id);

                    // Only process messages from the last 30 seconds (new messages)
                    const msgTime = msg.timestamp?.toDate();
                    const now = new Date();
                    if (msgTime && (now - msgTime) < 30000) {
                        console.log('👑 King Mode: Processing seller message');
                        try {
                            const butlerMessage = await rewriteAsButler(msg.text);

                            // Show butler report as a special message in chat
                            const butlerDiv = document.createElement('div');
                            butlerDiv.className = 'chat-message butler-report';
                            butlerDiv.innerHTML = `
                                <div style="font-style: italic; color: #d4af37; border-left: 3px solid #d4af37; padding-left: 10px; background: rgba(212, 175, 55, 0.1);">
                                    🎩 ${butlerMessage}
                                </div>
                                <div class="chat-message-time">${time}</div>
                            `;
                            messagesContainer.appendChild(butlerDiv);

                            // Speak the butler message
                            speakAsButler(butlerMessage);

                            // If user is not in chat modal, notify in main chat too
                            if (!document.getElementById('chatModal')?.classList.contains('active')) {
                                kingModeNotifySellerMessage(butlerMessage, orderId);
                            }
                        } catch (error) {
                            console.error('Butler processing failed:', error);
                        }
                    }
                }
            }

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

    // 👑 KING MODE: Paraphrase typed text just like voice input
    if (isKingMode) {
        await processKingModeMessage(text);
    } else {
        // Normal mode: send directly
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
}

// Start listening to orders when app loads
setTimeout(() => {
    listenToMyOrders();
}, 500);

// ============================================
// BOTTOM NAVIGATION
// ============================================
let isGridMode = false;
let currentTab = 'chat'; // Track current active tab

function switchTab(tab) {
    const navChat = document.getElementById('navChat');
    const wasOnChatTab = currentTab === 'chat';

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // If called from click event, use event.currentTarget; otherwise find by tab ID
    if (typeof event !== 'undefined' && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        // Programmatic call - find and activate the correct nav item
        const navMap = {
            'chat': 'navChat',
            'cart': 'navCart',
            'orders': 'navOrders',
            'settings': 'navSettings'
        };
        const navId = navMap[tab];
        if (navId) {
            const navElement = document.getElementById(navId);
            if (navElement) navElement.classList.add('active');
        }
    }

    // Handle tab action - switch views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
        view.classList.add('view-transition');
    });

    switch (tab) {
        case 'chat':
            document.getElementById('chatView').classList.add('active');
            // Only toggle if we were ALREADY on chat view
            // If coming from cart/orders, just show current mode without toggling
            if (wasOnChatTab) {
                toggleChatGridMode();
            } else {
                // Just update display without toggling
                updateChatModeDisplay();
            }
            break;
        case 'cart':
            document.getElementById('cartView').classList.add('active');
            renderCartView();
            break;
        case 'orders':
            document.getElementById('ordersView').classList.add('active');
            renderOrdersView();
            break;
        case 'settings':
            document.getElementById('settingsView').classList.add('active');
            break;
    }

    // Update current tab tracker
    currentTab = tab;

    // Always update chat nav appearance based on current mode
    updateChatNavAppearance();
}

function toggleChatGridMode() {
    isGridMode = !isGridMode;
    updateChatModeDisplay();

    if (isGridMode) {
        // Switch to grid mode
        populateSellerFilter();
        renderProductGrid();
    }
}

// Update nav appearance (icon + label) based on mode
function updateChatNavAppearance() {
    const navChat = document.getElementById('navChat');
    const navLabel = navChat ? navChat.querySelector('.nav-label') : null;

    if (navChat) {
        if (isGridMode) {
            navChat.classList.add('grid-mode');
            if (navLabel) navLabel.textContent = 'Menu';
        } else {
            navChat.classList.remove('grid-mode');
            if (navLabel) navLabel.textContent = 'Chat';
        }
    }
}

function updateChatModeDisplay() {
    const chatMode = document.getElementById('chatMode');
    const gridMode = document.getElementById('gridMode');

    if (isGridMode) {
        chatMode.classList.remove('active');
        chatMode.classList.add('fade-out');
        gridMode.classList.add('active');
        gridMode.classList.add('fade-in');
    } else {
        chatMode.classList.add('active');
        chatMode.classList.add('fade-in');
        gridMode.classList.remove('active');
        gridMode.classList.add('fade-out');
        scrollToBottom();
    }

    // Clean up animation classes after transition
    setTimeout(() => {
        chatMode.classList.remove('fade-in', 'fade-out');
        gridMode.classList.remove('fade-in', 'fade-out');
    }, 300);

    updateChatNavAppearance();
}

// Populate seller filter dropdown
function populateSellerFilter() {
    const select = document.getElementById('sellerFilter');
    if (!select) return;

    // Get unique sellers
    const sellers = [...new Set(products.map(p => p.seller))].sort();

    // Clear and rebuild options
    select.innerHTML = '<option value="all">All Sellers</option>';
    sellers.forEach(seller => {
        select.innerHTML += `< option value = "${seller}" > ${seller}</option > `;
    });
}

// Render product grid
function renderProductGrid(filterSeller = 'all') {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    // Filter and sort products
    let filteredProducts = filterSeller === 'all'
        ? [...products]
        : products.filter(p => p.seller === filterSeller);

    // Sort by price (cheapest first)
    filteredProducts.sort((a, b) => a.price - b.price);

    if (filteredProducts.length === 0) {
        grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 12px;">🍽️</div>
                <p>No products available</p>
            </div>
                `;
        return;
    }

    let html = '';
    filteredProducts.forEach((product, index) => {
        const isBestPrice = index === 0;

        html += `
                <div class="grid-product-card ${isBestPrice ? 'best-price' : ''}">
                <h4 class="grid-product-name">${product.name}</h4>
                <span class="grid-product-seller">🏪 ${product.seller}</span>
                <div class="grid-product-price">Rp ${formatPrice(product.price)}</div>
                <div class="grid-product-actions">
                    <button class="grid-add-cart" onclick="addToCart('${product.id}')">🛒</button>
                    <button class="grid-order-now" onclick="orderNow('${product.id}')">⚡</button>
                </div>
            </div>
                `;
    });

    grid.innerHTML = html;
}

// Filter products by seller
function filterProductsBySeller() {
    const select = document.getElementById('sellerFilter');
    const selectedSeller = select ? select.value : 'all';
    renderProductGrid(selectedSeller);
}

// Render cart view (not modal)
function renderCartView() {
    const cartItemsEl = document.getElementById('cartItems');
    const cartTotalEl = document.getElementById('cartTotal');

    if (cart.length === 0) {
        cartItemsEl.innerHTML = `
                <div class="empty-cart">
                <span class="empty-cart-icon">🛒</span>
                <p>${getTranslation('cartEmpty')}</p>
            </div>
                `;
        cartTotalEl.textContent = 'Rp 0';
        return;
    }

    let html = '';
    cart.forEach(item => {
        html += `
                <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.product.name}</h4>
                    <span class="cart-item-seller">${item.product.seller}</span>
                    <span class="cart-item-price">Rp ${formatPrice(item.product.price)}</span>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="updateCartQuantity('${item.product.id}', -1)">−</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateCartQuantity('${item.product.id}', 1)">+</button>
                    <button class="remove-btn" onclick="removeFromCart('${item.product.id}')">🗑️</button>
                </div>
            </div >
                `;
    });

    cartItemsEl.innerHTML = html;
    cartTotalEl.textContent = `Rp ${formatPrice(getCartTotal())} `;
}

// Render orders view (not modal)
function renderOrdersView() {
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

            // Escape special characters for onclick handlers
            const escapedSeller = (order.seller || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
            const escapedProduct = (order.productName || '').replace(/'/g, "\\'").replace(/"/g, '\\"');

            // Determine display price
            const displayPrice = order.agreedPrice || order.totalPrice || order.price;

            // Status display
            const statusLabel = order.status === 'pending_agreement' ? 'Awaiting Price' :
                order.status === 'pending_payment' ? 'Select Payment' :
                    order.status === 'confirmed' ? 'Selesai' :
                        order.status === 'pending' ? 'Pending' :
                            order.status;

            // Bid info display (New Layout)
            let bidInfoHtml = '';
            if (order.bidPrice && order.bidPrice !== order.totalPrice) {
                bidInfoHtml = `
                    <div class="buyer-bid-box">
                        <div class="bid-stat agreed">
                            <span class="bid-stat-label">Agreed</span>
                            <span class="bid-stat-value">${order.agreedPrice ? 'Rp ' + formatPrice(order.agreedPrice) : '-'}</span>
                        </div>
                        <div class="bid-stat your-bid">
                            <span class="bid-stat-label">Your Bid</span>
                            <span class="bid-stat-value">Rp ${formatPrice(order.bidPrice)}</span>
                        </div>
                        <div class="bid-stat original">
                            <span class="bid-stat-label">Original</span>
                            <span class="bid-stat-value">Rp ${formatPrice(order.totalPrice || order.price)}</span>
                        </div>
                    </div>
                `;
            }

            // Payment selection (New Layout)
            let paymentHtml = '';
            if (order.status === 'pending_payment' && !order.paymentMethod) {
                paymentHtml = `
                    <div class="payment-selection-box">
                        <div class="payment-header">
                            <span>🎉 Price agreed! Select payment:</span>
                        </div>
                        <div class="payment-btn-grid">
                            <div class="payment-option-btn qris" onclick="selectOrderPayment('${order.id}', 'qris')">
                                <span class="payment-icon">📱</span>
                                <span class="payment-label">QRIS</span>
                            </div>
                            <div class="payment-option-btn cash" onclick="selectOrderPayment('${order.id}', 'cash')">
                                <span class="payment-icon">💵</span>
                                <span class="payment-label">Cash</span>
                            </div>
                        </div>
                    </div>
                `;
            } else if (order.paymentMethod) {
                paymentHtml = `
                    <div class="payment-confirmed-badge">
                        <span>💳</span>
                        <span>Payment: ${order.paymentMethod === 'qris' ? 'QRIS' : 'Cash'}</span>
                    </div>
                `;
            }

            return `
                <div class="order-item ${order.status}">
                    <!-- Header: Name & Status -->
                    <div class="order-item-header">
                        <div class="order-item-info">
                            <span class="order-item-name">${order.productName}</span>
                            <div class="order-item-seller">
                                <span>🏪 ${order.seller}</span>
                                <span class="order-time">${timestamp}</span>
                            </div>
                        </div>
                        <span class="order-item-status ${order.status}">${statusLabel}</span>
                    </div>

                    <!-- Price -->
                    <div class="order-price-row">
                        <span class="order-main-price">Rp ${formatPrice(displayPrice)}</span>
                    </div>

                    <!-- Layout Content -->
                    ${bidInfoHtml}
                    ${paymentHtml}

                    <!-- Footer Actions -->
                    ${order.status !== 'confirmed' ? `
                    <div class="order-footer">
                        <button class="chat-seller-btn" onclick="openChat('${order.id}', '${escapedSeller}', '${escapedProduct}')">
                            <span>💬 Chat with Seller</span>
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
}

// Update bottom nav badges
function updateBottomNavBadges() {
    // Cart badge
    const cartBadge = document.getElementById('cartBadge');
    if (cartBadge) {
        const cartCount = getCartItemCount();
        cartBadge.textContent = cartCount;
        cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
    }

    // Order badge
    const orderBadge = document.getElementById('orderBadge');
    if (orderBadge) {
        const pendingCount = myOrders.filter(o => o.status === 'pending').length;
        orderBadge.textContent = pendingCount;
        orderBadge.style.display = pendingCount > 0 ? 'flex' : 'none';
    }
}

// ============================================
// SETTINGS FUNCTIONALITY
// ============================================

let isDarkMode = false;
let currentLanguage = 'id'; // Default Indonesian

// Initialize settings from localStorage
function initSettings() {
    // Load theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        isDarkMode = true;
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle')?.classList.add('dark');
    }

    // Load language preference
    const savedLang = localStorage.getItem('language');
    if (savedLang) {
        currentLanguage = savedLang;
        const langSelect = document.getElementById('languageSelect');
        if (langSelect) langSelect.value = savedLang;
    }

    // Load King Mode preference
    loadKingModeState();
}

// Toggle dark/light mode
function toggleTheme() {
    isDarkMode = !isDarkMode;
    const themeToggle = document.getElementById('themeToggle');

    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        themeToggle?.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        console.log('🌙 Dark mode enabled');
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle?.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        console.log('☀️ Light mode enabled');
    }
}

// ============================================
// KING MODE - AI Agent for Lazy Kings 👑
// ============================================
let isKingMode = false;
let recognition = null;
let isRecording = false;

// Toggle King Mode on/off
function toggleKingMode() {
    isKingMode = !isKingMode;
    const kingToggle = document.getElementById('kingToggle');
    const voiceBtn = document.getElementById('voiceBtn');
    const expansionEl = document.getElementById('kingModeExpansion');
    const paymentSelect = document.getElementById('kingPaymentSelect');

    if (isKingMode) {
        kingToggle?.classList.add('active');
        if (voiceBtn) voiceBtn.style.display = 'flex';
        if (expansionEl) {
            expansionEl.style.display = 'flex';
        }
        const warningText = document.getElementById('kingModeWarningText');
        if (warningText) warningText.textContent = currentLanguage === 'en'
            ? 'This feature is in alpha. You may encounter bugs or unexpected behavior.'
            : 'Fitur ini dalam tahap alpha. Anda mungkin mengalami bug atau perilaku yang tidak terduga.';
        localStorage.setItem('kingMode', 'true');
        console.log('👑 King Mode ACTIVATED - Your Majesty!');

        // Initialize speech recognition
        initSpeechRecognition();

        // Load saved payment method if exists
        const savedPayment = localStorage.getItem('kingModeDefaultPayment') || 'qris';
        if (paymentSelect) paymentSelect.value = savedPayment;

        // Show toast notification
        addBotMessage(currentLanguage === 'en'
            ? '👑 **King Mode Activated!** Speak into the microphone, Your Majesty. I shall handle all communications with the merchants.'
            : '👑 **King Mode Aktif!** Bicara ke mikrofon, Yang Mulia. Saya akan mengurus semua komunikasi dengan pedagang.');
    } else {
        kingToggle?.classList.remove('active');
        if (voiceBtn) voiceBtn.style.display = 'none';
        if (expansionEl) expansionEl.style.display = 'none';
        localStorage.setItem('kingMode', 'false');
        console.log('🛡️ King Mode deactivated');

        addBotMessage(currentLanguage === 'en'
            ? '🛡️ King Mode deactivated. Back to normal mode.'
            : '🛡️ King Mode dinonaktifkan. Kembali ke mode normal.');
    }
}

// Initialize Web Speech Recognition API
function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('⚠️ Speech Recognition not supported');
        addBotMessage(currentLanguage === 'en'
            ? '⚠️ Your browser doesn\'t support voice input. Please use Chrome or Edge.'
            : '⚠️ Browser Anda tidak mendukung input suara. Gunakan Chrome atau Edge.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = currentLanguage === 'en' ? 'en-US' : 'id-ID';

    recognition.onstart = () => {
        isRecording = true;
        document.getElementById('voiceBtn')?.classList.add('recording');
        console.log('🎤 Listening...');
    };

    recognition.onend = () => {
        isRecording = false;
        document.getElementById('voiceBtn')?.classList.remove('recording');
        console.log('🎤 Stopped listening');
    };

    recognition.onresult = async (event) => {
        const rawText = event.results[0][0].transcript;
        console.log('🎤 Heard:', rawText);

        // If in chat modal, paraphrase and send to seller
        if (currentChatOrderId) {
            await processKingModeMessage(rawText);
        } else {
            // Otherwise, just use as normal chat input
            document.getElementById('userInput').value = rawText;
            handleUserMessage();
        }
    };

    recognition.onerror = (event) => {
        console.error('🎤 Speech error:', event.error);
        isRecording = false;
        document.getElementById('voiceBtn')?.classList.remove('recording');

        if (event.error === 'not-allowed') {
            addBotMessage(currentLanguage === 'en'
                ? '🎤 Microphone access denied. Please allow microphone access in your browser settings.'
                : '🎤 Akses mikrofon ditolak. Izinkan akses mikrofon di pengaturan browser Anda.');
        } else if (event.error === 'network') {
            addBotMessage(currentLanguage === 'en'
                ? '🌐 Network error. Voice input requires: (1) Internet connection, and (2) HTTPS or localhost. Try running on a local server!'
                : '🌐 Error jaringan. Input suara membutuhkan: (1) Koneksi internet, dan (2) HTTPS atau localhost. Coba jalankan di server lokal!');
        } else if (event.error === 'aborted') {
            // User cancelled, no need to show message
            console.log('🎤 Voice input cancelled');
        } else {
            addBotMessage(currentLanguage === 'en'
                ? `🎤 Voice error: ${event.error}. Please try again.`
                : `🎤 Error suara: ${event.error}. Silakan coba lagi.`);
        }
    };

    console.log('✅ Speech Recognition initialized');
}

// Start voice input
function startVoiceInput() {
    if (!recognition) {
        initSpeechRecognition();
    }

    if (!recognition) {
        addBotMessage(currentLanguage === 'en'
            ? '⚠️ Voice input not available'
            : '⚠️ Input suara tidak tersedia');
        return;
    }

    if (isRecording) {
        recognition.stop();
    } else {
        try {
            recognition.start();
        } catch (error) {
            console.error('Failed to start recognition:', error);
        }
    }
}

// Process King Mode message - paraphrase and send to seller
async function processKingModeMessage(rawText) {
    try {
        // Show that we're processing
        const chatMessages = document.getElementById('chatMessages');
        const processingDiv = document.createElement('div');
        processingDiv.className = 'chat-message buyer';
        processingDiv.innerHTML = '<div>✨ Preparing your message...</div>';
        chatMessages?.appendChild(processingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Paraphrase the message
        const polishedMessage = await paraphraseForSeller(rawText);

        // Remove processing indicator
        processingDiv.remove();

        // Send the polished message
        if (polishedMessage) {
            await db.collection('orders').doc(currentChatOrderId)
                .collection('messages').add({
                    text: polishedMessage,
                    sender: 'buyer',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    originalText: rawText, // Store original for reference
                    isKingMode: true
                });
            console.log('👑 King Mode message sent:', polishedMessage);
        }
    } catch (error) {
        console.error('Failed to process King Mode message:', error);
    }
}

// AI Helper: Paraphrase casual speech into polite professional message
async function paraphraseForSeller(rawText) {
    const systemPrompt = currentLanguage === 'en'
        ? `You are a professional message writer. Rewrite casual, informal messages into polite, professional inquiries for a seller/merchant.

CRITICAL RULES:
- Keep the message SHORT (1-2 sentences max)
- Preserve the EXACT meaning and sentiment of the original (yes/no/okay/fine/continue/etc)
- Maintain the same level of formality adjustment - don't over-formalize casual agreement
- Use appropriate greetings if needed
- If the message is already polite, just clean it up minimally
- Respond ONLY with the polished message, no explanations

Examples:
- "ya gpp lanjut aja" -> "Yes, that's fine. Please continue."
- "oke siap" -> "Okay, ready."
- "bisa kirim sekarang?" -> "Can you send it now?"
- "no thanks" -> "No, thank you."`
        : `Anda adalah penulis pesan profesional. Tulis ulang pesan kasual dan informal menjadi pesan yang sopan dan profesional untuk penjual/pedagang.

ATURAN PENTING:
- Pertahankan makna dan sentimen PERSIS seperti aslinya (ya/tidak/oke/lanjut/dll)
- Jangan ubah tingkat kesepakatan - jangan terlalu formal untuk persetujuan kasual
- Gunakan salam yang sesuai jika diperlukan
- Jika pesan sudah sopan, hanya perbaiki sedikit
- Hanya berikan pesan yang sudah diperbaiki, tanpa penjelasan

Contoh:
- "iya gpp lanjut aja" -> "Baik, tidak masalah. Silakan lanjutkan."
- "oke siap" -> "Baik, siap."
- "bisa kirim sekarang?" -> "Bisa dikirim sekarang?"
- "nggak usah deh" -> "Tidak perlu, terima kasih."`;

    const userPrompt = currentLanguage === 'en'
        ? `Rewrite this casual message into a polite, professional inquiry while preserving its exact meaning:

"${rawText}"`
        : `Tulis ulang pesan kasual ini menjadi pesan sopan dan profesional sambil mempertahankan maknanya persis:

"${rawText}"`;

    try {
        const { content } = await callChatAPI({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 150
        });
        const polishedMessage = content?.trim();
        console.log('✨ Paraphrased:', rawText, '->', polishedMessage);
        return polishedMessage || rawText;
    } catch (error) {
        console.error('Paraphrase failed:', error);
        return rawText; // Fallback to original
    }
}

// AI Helper: Rewrite seller message as royal butler reporting to his King
async function rewriteAsButler(sellerMessage) {
    const systemPrompt = currentLanguage === 'en'
        ? `You are a loyal royal butler reporting to your King. Rewrite the seller/merchant's message in the style of a butler addressing royalty.

Rules:
- Start with "My Lord," or "Your Majesty,"
- Be respectful and formal
- Keep it concise (1-3 sentences)
- Preserve ALL important information (prices, availability, details)
- Add subtle butler-like flourishes
- Respond ONLY with the butler's report, no explanations`
        : `Anda adalah pelayan kerajaan yang setia yang melapor kepada Yang Mulia. Tulis ulang pesan penjual/pedagang dalam gaya pelayan yang berbicara kepada kerajaan.

Aturan:
- Mulai dengan "Yang Mulia," atau "Paduka,"
- Gunakan bahasa hormat dan formal
- Singkat dan padat (1-3 kalimat)
- Pertahankan SEMUA informasi penting (harga, ketersediaan, detail)
- Tambahkan sentuhan khas pelayan kerajaan
- Hanya berikan laporan pelayan, tanpa penjelasan tambahan`;

    const userPrompt = currentLanguage === 'en'
        ? `The merchant says: "${sellerMessage}"

Rewrite this as a butler's report to the King:`
        : `Pedagang mengatakan: "${sellerMessage}"

Tulis ulang sebagai laporan pelayan untuk Yang Mulia:`;

    try {
        const { content } = await callChatAPI({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.5,
            max_tokens: 200
        });
        const butlerMessage = content?.trim();
        console.log('🎩 Butler says:', butlerMessage);
        return butlerMessage || sellerMessage;
    } catch (error) {
        console.error('Butler rewrite failed:', error);
        return sellerMessage; // Fallback to original
    }
}

// Text-to-Speech: Speak as butler
function speakAsButler(text) {
    if (!('speechSynthesis' in window)) {
        console.warn('⚠️ Text-to-Speech not supported');
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLanguage === 'en' ? 'en-GB' : 'id-ID'; // British English for butler feel
    utterance.rate = 0.9; // Slightly slower for formal feel
    utterance.pitch = 0.9; // Slightly lower pitch

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
        v.lang.startsWith(currentLanguage === 'en' ? 'en-GB' : 'id') && v.name.toLowerCase().includes('male')
    ) || voices.find(v => v.lang.startsWith(currentLanguage === 'en' ? 'en' : 'id'));

    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
    console.log('🔊 Butler speaking:', text);
}

// Load King Mode state on startup
function loadKingModeState() {
    const savedKingMode = localStorage.getItem('kingMode');
    if (savedKingMode === 'true') {
        isKingMode = true;
        document.getElementById('kingToggle')?.classList.add('active');
        document.getElementById('voiceBtn').style.display = 'flex';

        // Show expansion container (warning + payment)
        const expansionEl = document.getElementById('kingModeExpansion');
        if (expansionEl) expansionEl.style.display = 'flex';

        // Update warning text based on current language
        const warningText = document.getElementById('kingModeWarningText');
        if (warningText) warningText.textContent = currentLanguage === 'en'
            ? 'This feature is in alpha. You may encounter bugs or unexpected behavior.'
            : 'Fitur ini dalam tahap alpha. Anda mungkin mengalami bug atau perilaku yang tidak terduga.';

        // Load saved payment method
        const savedPayment = localStorage.getItem('kingModeDefaultPayment') || 'qris';
        const paymentSelect = document.getElementById('kingPaymentSelect');
        if (paymentSelect) paymentSelect.value = savedPayment;

        initSpeechRecognition();
        console.log('👑 King Mode restored from localStorage');
    }
}

// Change King Mode default payment method
function changeKingPaymentMethod() {
    const paymentSelect = document.getElementById('kingPaymentSelect');
    if (paymentSelect) {
        const method = paymentSelect.value;
        localStorage.setItem('kingModeDefaultPayment', method);
        console.log('💳 King Mode default payment set to:', method);

        // Notify the King
        const message = currentLanguage === 'en'
            ? `💳 Default payment method set to ${method.toUpperCase()}, Your Majesty.`
            : `💳 Metode pembayaran default diatur ke ${method.toUpperCase()}, Yang Mulia.`;
        addBotMessage(message);
    }
}

// Initialize King Mode on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load voices for TTS
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
    }
});

// Change language
function changeLanguage() {
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        currentLanguage = langSelect.value;
        localStorage.setItem('language', currentLanguage);
        console.log('🌐 Language changed to:', currentLanguage);

        // Update UI text based on language
        updateUILanguage();

        // Clear chat and show new welcome message in selected language
        refreshWelcomeMessage();
    }
}

// Refresh chat with welcome message in current language
function refreshWelcomeMessage() {
    // Clear existing chat messages
    chatContainer.innerHTML = '';

    // Clear conversation history
    conversationHistory = [];

    // Get welcome message based on current language
    const welcomeMessages = {
        en: `Yo, what's up! 👋 Welcome to Ultimate Store!

I'm **Koko**, your shopping buddy. What are you craving today?

• Heavy meals? Got 'em.
• Snacks for your overthinking sessions? Yep.
• Drinks for healing? Plenty.

Just tell me what you want, I'll find the best deal for you. Or if you're feeling lucky, type "surprise me" and let's gamble! 🎰`,
        id: `Eh, ada tamu! 👋 Selamat datang di Ultimate Store, Bos!

Saya **Koko**, asisten belanja paling kece se-marketplace ini. Mau nyari apa hari ini?

• Makanan berat? Siap.
• Camilan buat nemenin overthinking? Ada.
• Minuman buat healing? Banyak.

Langsung bilang aja mau apa, nanti saya cariin yang terbaik. Atau kalau bingung, ketik "surprise me" dan kita gacha bareng! 🎰`
    };

    addBotMessage(welcomeMessages[currentLanguage] || welcomeMessages.id);
    console.log('🔄 Chat refreshed with', currentLanguage, 'welcome message');
}

// Update UI text based on selected language
function updateUILanguage() {
    const translations = {
        en: {
            // Header
            tagline: 'Chat with us to find your perfect product',

            // Chat
            chatPlaceholder: 'I want...',
            sendBtn: 'Send',
            statusReady: 'Ready! Ask me anything',

            // View Headers
            cartHeader: '🛒 Your Cart',
            ordersHeader: '📦 My Orders',
            settingsHeader: '⚙️ Settings',

            // Cart
            cartEmpty: 'Your cart is empty',
            cartTotal: 'Total:',
            checkoutBtn: 'Proceed to Checkout →',

            // Orders
            ordersEmpty: 'No orders yet',
            ordersSubtext: 'Chat with Koko to find your dream products!',
            chatWithSeller: '💬 Chat with Seller',

            // Bottom Nav
            navChat: 'Chat',
            navMenu: 'Menu',
            navCart: 'Cart',
            navOrders: 'Orders',
            navSettings: 'Settings',

            // Grid/Menu
            filterLabel: '🏪 Filter:',
            filterAll: 'All Sellers',

            // Settings
            settingsLang: 'Language / Bahasa',
            settingsLangDesc: 'Choose your preferred language',
            settingsTheme: 'Theme / Tema',
            settingsThemeDesc: 'Switch between light and dark mode',
            settingsKing: 'King Mode',
            settingsKingDesc: 'AI Agent handles seller communication',
            settingsPayment: 'Default Payment',
            settingsPaymentDesc: 'Auto-selected for quick checkout',
            settingsAdmin: 'Admin Dashboard',
            settingsAdminDesc: 'Manage sellers, products & orders',
            appVersion: 'Version 1.0 • Made with ❤️',

            // Product Cards
            addToCart: 'Add to Cart',
            orderNow: 'Order Now',
            bestPrice: '👑 Best Price!',

            // Welcome Message (Koko's greeting)
            welcomeMessage: `Yo, what's up! 👋 Welcome to Ultimate Store!

I'm **Koko**, your shopping buddy. What are you craving today?

• Heavy meals? Got 'em.
• Snacks for your overthinking sessions? Yep.
• Drinks for healing? Plenty.

Just tell me what you want, I'll find the best deal for you. Or if you're feeling lucky, type "surprise me" and let's gamble! 🎰`
        },
        id: {
            // Header
            tagline: 'Chat dengan kami untuk menemukan produk impianmu',

            // Chat
            chatPlaceholder: 'Aku mau...',
            sendBtn: 'Kirim',
            statusReady: 'Siap! Mau cari apa?',

            // View Headers
            cartHeader: '🛒 Keranjang',
            ordersHeader: '📦 Pesanan Saya',
            settingsHeader: '⚙️ Pengaturan',

            // Cart
            cartEmpty: 'Keranjang kosong',
            cartTotal: 'Total:',
            checkoutBtn: 'Lanjut ke Pembayaran →',

            // Orders
            ordersEmpty: 'Belum ada pesanan',
            ordersSubtext: 'Chat dengan Koko untuk menemukan produk impianmu!',
            chatWithSeller: '💬 Chat dengan Penjual',

            // Bottom Nav
            navChat: 'Chat',
            navMenu: 'Menu',
            navCart: 'Keranjang',
            navOrders: 'Pesanan',
            navSettings: 'Pengaturan',

            // Grid/Menu
            filterLabel: '🏪 Filter:',
            filterAll: 'Semua Penjual',

            // Settings
            settingsLang: 'Language / Bahasa',
            settingsLangDesc: 'Pilih bahasa yang kamu suka',
            settingsTheme: 'Theme / Tema',
            settingsThemeDesc: 'Ganti mode terang atau gelap',
            settingsKing: 'King Mode',
            settingsKingDesc: 'AI Agent mengurus komunikasi dengan penjual',
            settingsPayment: 'Pembayaran Default',
            settingsPaymentDesc: 'Otomatis dipilih untuk checkout cepat',
            settingsAdmin: 'Dashboard Admin',
            settingsAdminDesc: 'Kelola penjual, produk & pesanan',
            appVersion: 'Versi 1.0 • Dibuat dengan ❤️',

            // Product Cards
            addToCart: 'Masukkan Keranjang',
            orderNow: 'Pesan Sekarang',
            bestPrice: '👑 Harga Terbaik!',

            // Welcome Message (Koko's greeting)
            welcomeMessage: `Eh, ada tamu! 👋 Selamat datang di Ultimate Store, Bos!

Saya **Koko**, asisten belanja paling kece se-marketplace ini. Mau nyari apa hari ini?

• Makanan berat? Siap.
• Camilan buat nemenin overthinking? Ada.
• Minuman buat healing? Banyak.

Langsung bilang aja mau apa, nanti saya cariin yang terbaik. Atau kalau bingung, ketik "surprise me" dan kita gacha bareng! 🎰`
        }
    };

    const t = translations[currentLanguage] || translations.id;

    // Header
    const tagline = document.querySelector('.tagline');
    if (tagline) tagline.textContent = t.tagline;

    // Chat input & send
    const chatInput = document.getElementById('userInput');
    if (chatInput) chatInput.placeholder = t.chatPlaceholder;
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.textContent = t.sendBtn;

    // View Headers
    const cartHeader = document.querySelector('#cartView .view-header h2');
    if (cartHeader) cartHeader.textContent = t.cartHeader;
    const ordersHeader = document.querySelector('#ordersView .view-header h2');
    if (ordersHeader) ordersHeader.textContent = t.ordersHeader;
    const settingsHeader = document.querySelector('#settingsView .view-header h2');
    if (settingsHeader) settingsHeader.textContent = t.settingsHeader;

    // Cart
    const cartTotal = document.querySelector('.cart-total span:first-child');
    if (cartTotal) cartTotal.textContent = t.cartTotal;
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) checkoutBtn.textContent = t.checkoutBtn;

    // Bottom Nav Labels
    const navChatLabel = document.querySelector('#navChat .nav-label');
    if (navChatLabel) navChatLabel.textContent = isGridMode ? t.navMenu : t.navChat;
    const navCartLabel = document.querySelector('#navCart .nav-label');
    if (navCartLabel) navCartLabel.textContent = t.navCart;
    const navOrdersLabel = document.querySelector('#navOrders .nav-label');
    if (navOrdersLabel) navOrdersLabel.textContent = t.navOrders;
    const navSettingsLabel = document.querySelector('#navSettings .nav-label');
    if (navSettingsLabel) navSettingsLabel.textContent = t.navSettings;

    // Filter bar
    const filterLabel = document.querySelector('.filter-bar label');
    if (filterLabel) filterLabel.textContent = t.filterLabel;
    const filterAllOption = document.querySelector('#sellerFilter option[value="all"]');
    if (filterAllOption) filterAllOption.textContent = t.filterAll;

    // Settings items
    // Language Setting (nth-child 1)
    const langTitle = document.querySelector('#settingsView .settings-group:nth-child(1) .settings-text h4');
    if (langTitle) langTitle.textContent = t.settingsLang;
    const langDesc = document.querySelector('#settingsView .settings-group:nth-child(1) .settings-text p');
    if (langDesc) langDesc.textContent = t.settingsLangDesc;

    // Theme Setting (nth-child 2)
    const themeTitle = document.querySelector('#settingsView .settings-group:nth-child(2) .settings-text h4');
    if (themeTitle) themeTitle.textContent = t.settingsTheme;
    const themeDesc = document.querySelector('#settingsView .settings-group:nth-child(2) .settings-text p');
    if (themeDesc) themeDesc.textContent = t.settingsThemeDesc;

    // King Mode Setting - use ID-based selector (keep Alpha tag in title)
    const kingToggle = document.querySelector('#kingToggle');
    if (kingToggle) {
        const kingTitle = kingToggle.closest('.settings-item').querySelector('.settings-text h4');
        if (kingTitle) kingTitle.innerHTML = t.settingsKing + ' <span class="king-mode-alpha-tag" aria-label="Alpha feature">Alpha</span>';
        const kingDesc = kingToggle.closest('.settings-item').querySelector('.settings-text p');
        if (kingDesc) kingDesc.textContent = t.settingsKingDesc;
    }
    // King Mode alpha warning text (when visible)
    if (isKingMode) {
        const warningText = document.getElementById('kingModeWarningText');
        if (warningText) warningText.textContent = currentLanguage === 'en'
            ? 'This feature is in alpha. You may encounter bugs or unexpected behavior.'
            : 'Fitur ini dalam tahap alpha. Anda mungkin mengalami bug atau perilaku yang tidak terduga.';
    }

    // King Mode Payment Setting - use ID-based selector
    const kingPaymentTitle = document.querySelector('#kingPaymentSetting .settings-text h4');
    if (kingPaymentTitle) kingPaymentTitle.textContent = t.settingsPayment;
    const kingPaymentDesc = document.querySelector('#kingPaymentSetting .settings-text p');
    if (kingPaymentDesc) kingPaymentDesc.textContent = t.settingsPaymentDesc;

    // Admin Dashboard - use class-based selector (admin-link)
    const adminTitle = document.querySelector('#settingsView .admin-link .settings-text h4');
    if (adminTitle) adminTitle.textContent = t.settingsAdmin;
    const adminDesc = document.querySelector('#settingsView .admin-link .settings-text p');
    if (adminDesc) adminDesc.textContent = t.settingsAdminDesc;

    // App Info
    const appVersion = document.querySelector('#settingsView .app-info .settings-text p');
    if (appVersion) appVersion.textContent = t.appVersion;

    // Re-render views if they are active to update dynamic content
    if (currentTab === 'cart') {
        renderCartView();
    } else if (currentTab === 'orders') {
        renderOrdersView();
    }

    console.log('📝 UI language updated to:', currentLanguage);
}

// Get current translation
function getTranslation(key) {
    const translations = {
        en: {
            cartEmpty: 'Your cart is empty',
            ordersEmpty: 'No orders yet',
            ordersSubtext: 'Chat with Koko to find your dream products!',
            chatWithSeller: '💬 Chat with Seller',
            addToCart: 'Add to Cart',
            orderNow: 'Order Now'
        },
        id: {
            cartEmpty: 'Keranjang kosong',
            ordersEmpty: 'Belum ada pesanan',
            ordersSubtext: 'Chat dengan Koko untuk menemukan produk impianmu!',
            chatWithSeller: '💬 Chat dengan Penjual',
            addToCart: 'Masukkan Keranjang',
            orderNow: 'Pesan Sekarang'
        }
    };
    return translations[currentLanguage]?.[key] || translations.id[key];
}

// Initialize settings on load
document.addEventListener('DOMContentLoaded', initSettings);

