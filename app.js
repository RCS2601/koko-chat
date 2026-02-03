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
let conversationHistory = []; // Store conversation context for AI
const MAX_HISTORY = 10; // Keep last 10 messages for context

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

        // Show welcome message - Koko introduces himself
        addBotMessage(`Eh, ada tamu! 👋 Selamat datang di Ultimate Store, Bos!

Saya **Koko**, asisten belanja paling kece se-marketplace ini. Mau nyari apa hari ini?

• Makanan berat? Siap.
• Camilan buat nemenin overthinking? Ada.
• Minuman buat healing? Banyak.

Langsung bilang aja mau apa, nanti saya cariin yang terbaik. Atau kalau bingung, ketik "surprise me" dan kita gacha bareng! 🎰`);

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
    // Build detailed product catalog for AI with categories
    const productList = products.slice(0, 50).map(p => ({
        name: p.name,
        category: p.category || 'uncategorized',
        price: p.price
    }));

    const productCatalog = productList.length > 0
        ? `\n\nAVAILABLE PRODUCTS (you MUST choose from these EXACT names):\n${productList.map(p => `- "${p.name}" (${p.category}, Rp${p.price})`).join('\n')}\n`
        : '';

    // Language-aware Koko personality
    const isEnglish = currentLanguage === 'en';

    // Enhanced system prompt with conversation memory and not_found intent
    const systemPrompt = isEnglish
        ? `You are "Koko", the Cheeky Connoisseur - a witty shopping assistant for an Indonesian food marketplace.
${productCatalog}
PERSONALITY:
- Deadpan snarky but helpful like a real waiter/waitress
- Use casual English slang: "Yo", "Bruh", "Lowkey", "No cap", "Valid"
- Keep responses SHORT (2-3 sentences max)
- RESPOND IN ENGLISH ONLY
- Remember previous messages for context

RESPONSE FORMAT (JSON):
{
    "intent": "search" | "greeting" | "help" | "chat" | "not_found" | "followup",
    "selectedProducts": ["Exact Product Name 1", "Exact Product Name 2"],
    "response": "Your cheeky response IN ENGLISH",
    "productComment": "optional comment about products IN ENGLISH",
    "notFoundItem": "the item user asked for that we don't have"
}

INTENTS:
- "search": User wants a product we have → return matching products
- "not_found": User wants something we DON'T have (burger, sushi, pizza, etc.) → apologize and suggest alternatives
- "followup": User asks follow-up about previous request (like "what's similar?", "anything else?")
- "greeting": User says hi/hello
- "chat": General conversation
- "help": User needs help

CRITICAL RULES:
1. ONLY return product names that EXACTLY match the menu above
2. If user asks for something NOT in the menu (burger, sushi, pizza, ramen, etc.):
   - Use intent "not_found"
   - Set notFoundItem to what they asked for
   - Suggest similar FOOD items if they asked for food, DRINKS if they asked for drinks
   - Be apologetic but offer alternatives
3. If user asks "what's similar?" or "anything else?" → Use intent "followup" and check the PREVIOUS message context
4. Maximum 5 products in selectedProducts
5. For category-only requests (drinks, food, snacks) → pick 3-5 items from that category

EXAMPLES:

User: "I want burger"
Response: {"intent": "not_found", "selectedProducts": ["Nasi Goreng Spesial", "Mie Ayam"], "response": "Burger? Sorry bruh, we don't have that here! But we got some solid filling options.", "productComment": "Check these out instead! 🍽️", "notFoundItem": "burger"}

User: "what's similar then?"
Response: {"intent": "followup", "selectedProducts": ["Nasi Goreng Spesial", "Ayam Bakar"], "response": "If you wanted something filling like a burger, these might hit the spot!", "productComment": "Hearty Indonesian dishes! 💪"}

User: "do you have sushi?"
Response: {"intent": "not_found", "selectedProducts": [], "response": "No sushi here, we're all about Indonesian food! But yo, we got amazing stuff.", "productComment": "Want me to recommend something?", "notFoundItem": "sushi"}

User: "I want coffee"
Response: {"intent": "search", "selectedProducts": ["Kopi Susu"], "response": "Coffee? Valid choice! Here's what we got.", "productComment": "This one's a fan favorite! ☕"}

IMPORTANT:
- ALWAYS respond with valid JSON
- ALWAYS respond in ENGLISH
- Use context from previous messages to give better recommendations
- If item not found, ALWAYS suggest alternatives based on what they wanted`
        : `You are "Koko", the Cheeky Connoisseur - a witty shopping assistant for an Indonesian food marketplace.
${productCatalog}
PERSONALITY:
- Deadpan snarky but helpful like a real waiter/waitress
- Use Indonesian slang: "Waduh", "Jujurly", "Bos", "Valid", "No debat"
- Keep responses SHORT (2-3 sentences max)
- RESPOND IN INDONESIAN ONLY
- Remember previous messages for context

RESPONSE FORMAT (JSON):
{
    "intent": "search" | "greeting" | "help" | "chat" | "not_found" | "followup",
    "selectedProducts": ["Exact Product Name 1", "Exact Product Name 2"],
    "response": "Your cheeky response IN INDONESIAN",
    "productComment": "optional comment about products IN INDONESIAN",
    "notFoundItem": "the item user asked for that we don't have"
}

INTENTS:
- "search": User wants a product we have → return matching products
- "not_found": User wants something we DON'T have (burger, sushi, pizza, etc.) → apologize and suggest alternatives
- "followup": User asks follow-up about previous request (like "yang mirip apa?", "ada yang lain?")
- "greeting": User says hi/hello
- "chat": General conversation
- "help": User needs help

CRITICAL RULES:
1. ONLY return product names that EXACTLY match the menu above
2. If user asks for something NOT in the menu (burger, sushi, pizza, ramen, etc.):
   - Use intent "not_found"
   - Set notFoundItem to what they asked for
   - Suggest similar FOOD items if they asked for food, DRINKS if they asked for drinks
   - Be apologetic but offer alternatives
3. If user asks "yang mirip apa?" or "ada yang lain?" → Use intent "followup" and check the PREVIOUS message context
4. Maximum 5 products in selectedProducts
5. For category-only requests (minuman, makanan, snack) → pick 3-5 items from that category

EXAMPLES:

User: "burger dong"
Response: {"intent": "not_found", "selectedProducts": ["Nasi Goreng Spesial", "Mie Ayam"], "response": "Waduh, burger gak ada, Bos! Tapi kita punya makanan yang bikin kenyang juga nih.", "productComment": "Coba yang ini deh! 🍽️", "notFoundItem": "burger"}

User: "yang mirip apa dong?"
Response: {"intent": "followup", "selectedProducts": ["Nasi Goreng Spesial", "Ayam Bakar"], "response": "Kalau mau yang mengenyangkan kayak burger, ini cocok, Bos!", "productComment": "Mantap buat perut lapar! 💪"}

User: "ada sushi gak?"
Response: {"intent": "not_found", "selectedProducts": [], "response": "Sushi gak ada, Bos! Kita fokus makanan Indonesia. Tapi ada yang enak lho!", "productComment": "Mau saya rekomendasiin?", "notFoundItem": "sushi"}

User: "mau kopi"
Response: {"intent": "search", "selectedProducts": ["Kopi Susu"], "response": "Kopi? Ah, sesama pecinta kafein. Valid, Bos!", "productComment": "Ini kopi favorit! ☕"}

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

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: messages,
                temperature: 0.4,
                max_tokens: 300
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
            const result = JSON.parse(jsonMatch[0]);

            // Add to conversation history
            conversationHistory.push({ role: 'user', content: userMessage });
            conversationHistory.push({ role: 'assistant', content: result.response });

            // Trim history if too long
            if (conversationHistory.length > MAX_HISTORY * 2) {
                conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
            }

            return result;
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

            // Always show feedback prompt for not_found items
            addFeedbackPrompt(result.notFoundItem || message);
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
        await db.collection('feedback').add({
            type: feedbackType,
            message: feedbackMessage,
            searchQuery: lastSearchQuery || null,
            buyerSession: getBuyerSessionId(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'unread'
        });

        console.log('✅ Feedback submitted:', { type: feedbackType, message: feedbackMessage });

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
    const modal = document.getElementById('ordersModal');
    if (modal) {
        modal.classList.remove('active');
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
    event.currentTarget.classList.add('active');

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
        select.innerHTML += `<option value="${seller}">${seller}</option>`;
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
            </div>
        `;
    });

    cartItemsEl.innerHTML = html;
    cartTotalEl.textContent = `Rp ${formatPrice(getCartTotal())}`;
}

// Render orders view (not modal)
function renderOrdersView() {
    const ordersList = document.getElementById('ordersList');

    if (myOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="empty-orders">
                <span class="empty-orders-icon">📦</span>
                <p>${getTranslation('ordersEmpty')}</p>
                <p class="empty-subtext">${getTranslation('ordersSubtext')}</p>
            </div>
        `;
        return;
    }

    let html = '';
    myOrders.forEach(order => {
        const timestamp = order.timestamp ?
            formatTimestamp(order.timestamp.toDate()) :
            'Just now';
        const statusClass = order.status === 'confirmed' ? 'confirmed' : 'pending';
        const statusLabel = order.status === 'confirmed' ? 'SELESAI' : 'PENDING';

        // Escape special characters for onclick handlers
        const escapedSeller = (order.seller || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
        const escapedProduct = (order.productName || '').replace(/'/g, "\\'").replace(/"/g, '\\"');

        html += `
            <div class="order-item ${statusClass}">
                <div class="order-item-info">
                    <h4>${order.orderId ? `#${order.orderId} - ` : ''}${order.productName}</h4>
                    <span class="order-item-seller">${order.seller}</span>
                    <span class="order-item-time">${timestamp}</span>
                </div>
                <div class="order-item-status">
                    <span class="order-item-price">Rp ${formatPrice(order.totalPrice || order.price)}</span>
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                </div>
                ${order.status !== 'confirmed' ? `
                <div class="order-item-actions">
                    <button class="order-chat-btn" onclick="openChat('${order.id}', '${escapedSeller}', '${escapedProduct}')">
                        ${getTranslation('chatWithSeller')}
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    });

    ordersList.innerHTML = html;
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

// Change language
function changeLanguage() {
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        currentLanguage = langSelect.value;
        localStorage.setItem('language', currentLanguage);
        console.log('🌐 Language changed to:', currentLanguage);

        // Update UI text based on language
        updateUILanguage();
    }
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
            settingsAdmin: 'Admin Dashboard',
            settingsAdminDesc: 'Manage sellers, products & orders',
            appVersion: 'Version 1.0 • Made with ❤️',

            // Product Cards
            addToCart: 'Add to Cart',
            orderNow: 'Order Now',
            bestPrice: '👑 Best Price!'
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
            settingsAdmin: 'Dashboard Admin',
            settingsAdminDesc: 'Kelola penjual, produk & pesanan',
            appVersion: 'Versi 1.0 • Dibuat dengan ❤️',

            // Product Cards
            addToCart: 'Masukkan Keranjang',
            orderNow: 'Pesan Sekarang',
            bestPrice: '👑 Harga Terbaik!'
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
    const langTitle = document.querySelector('#settingsView .settings-group:nth-child(1) .settings-text h4');
    if (langTitle) langTitle.textContent = t.settingsLang;
    const langDesc = document.querySelector('#settingsView .settings-group:nth-child(1) .settings-text p');
    if (langDesc) langDesc.textContent = t.settingsLangDesc;
    const themeTitle = document.querySelector('#settingsView .settings-group:nth-child(2) .settings-text h4');
    if (themeTitle) themeTitle.textContent = t.settingsTheme;
    const themeDesc = document.querySelector('#settingsView .settings-group:nth-child(2) .settings-text p');
    if (themeDesc) themeDesc.textContent = t.settingsThemeDesc;
    const adminTitle = document.querySelector('#settingsView .settings-group:nth-child(3) .settings-text h4');
    if (adminTitle) adminTitle.textContent = t.settingsAdmin;
    const adminDesc = document.querySelector('#settingsView .settings-group:nth-child(3) .settings-text p');
    if (adminDesc) adminDesc.textContent = t.settingsAdminDesc;
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

