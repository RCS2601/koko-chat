// ============================================
// Ultimate Store - Chat Application
// Buyers are Kings! 
// Uses Gemini API for natural language processing
// ============================================

// ============================================
// GEMINI API CONFIGURATION
// ============================================
// Gemini 2.0 Flash - Updated January 2026
const GEMINI_API_KEY = 'AIzaSyAsGztzzb-jiQoEcZpk8OLRiDdxdNJxLWA';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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

function addProductResults(products) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';

    let html = '<div class="message-content">';

    if (products.length === 0) {
        html += '😅 Sorry, I couldn\'t find any products matching your request. Try asking for something else!';
    } else {
        html += `🎯 Found ${products.length} product${products.length > 1 ? 's' : ''} for you! (sorted by best price)`;
        html += '<div class="product-list">';

        products.forEach((product, index) => {
            const isBestOffer = index === 0 && product.available !== false;
            const isUnavailable = product.available === false;
            html += `
                <div class="product-card ${isBestOffer ? 'best-offer' : ''} ${isUnavailable ? 'unavailable' : ''}" 
                     onclick="${isUnavailable ? '' : `selectProduct('${product.id}')`}"
                     style="${isUnavailable ? 'opacity: 0.6; cursor: not-allowed;' : ''}">
                    <div class="product-info">
                        <h4>${product.name} ${isUnavailable ? '<span style="color: #ef4444; font-size: 12px;">❌ Unavailable</span>' : ''}</h4>
                        <span class="seller">${product.seller}</span>
                    </div>
                    <div class="product-price" style="${isUnavailable ? 'background: #9ca3af;' : ''}">${isUnavailable ? 'Sold Out' : `Rp ${formatPrice(product.price)}`}</div>
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
// Product Selection - Save to Firestore for Sellers
// ============================================
async function selectProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        // Save order to Firestore for seller to see
        try {
            await db.collection('orders').add({
                productId: product.id,
                productName: product.name,
                seller: product.seller,
                price: product.price,
                category: product.category,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending',
                buyerSession: getBuyerSessionId()
            });
            console.log('✅ Order saved to Firestore');
        } catch (error) {
            console.error('Failed to save order:', error);
        }

        addBotMessage(`✅ Great choice! You selected <strong>${product.name}</strong> from <strong>${product.seller}</strong> for <strong>Rp ${formatPrice(product.price)}</strong>.

📢 The seller has been notified!

Would you like to:
• Order another product
• See more options
• Ask about something else`);
    }
}

// Generate unique session ID for buyer
function getBuyerSessionId() {
    let sessionId = sessionStorage.getItem('buyerSessionId');
    if (!sessionId) {
        sessionId = 'buyer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('buyerSessionId', sessionId);
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
// Gemini AI Integration
// ============================================
async function processWithGemini(userMessage) {
    // Create a prompt that helps Gemini understand the context
    const systemPrompt = `You are a shopping assistant for an Indonesian food marketplace. Your job is to understand what the user wants and extract search keywords.

Available product categories: nasi padang, snack, minuman (drinks), makanan (food)
Available tags: sweet, manis, cheap, murah, spicy, chicken, ayam, beef, nasi, drink, cold, hot, healthy, vegetable

User message: "${userMessage}"

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
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: systemPrompt }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 256,
                }
            })
        });

        if (!response.ok) {
            throw new Error('Gemini API request failed');
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        // Parse the JSON response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        throw new Error('Invalid response format');
    } catch (error) {
        console.error('Gemini API error:', error);
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
        const result = await processWithGemini(message);

        hideTypingIndicator();

        if (result.intent === 'search' && result.keywords.length > 0) {
            // Search for products
            const searchQuery = result.keywords.join(' ');
            const foundProducts = await searchProducts(searchQuery);
            addProductResults(foundProducts.slice(0, 5)); // Show top 5
        } else if (result.response) {
            // Show AI response
            addBotMessage(result.response);
        } else {
            // Search with original message
            const foundProducts = await searchProducts(message);
            if (foundProducts.length > 0) {
                addProductResults(foundProducts.slice(0, 5));
            } else {
                addBotMessage("I'm not sure what you're looking for. Try asking for specific foods like 'nasi padang' or 'something sweet'!");
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
