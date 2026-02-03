# Koko Chat / Ultimate Store 🛒

A smart, AI-powered e-commerce marketplace featuring "Koko" - a cheeky, context-aware shopping assistant. This project demonstrates a modern two-sided marketplace (Buyer & Seller) built with Vanilla JS, Firebase, and Groq AI.

## 🌟 Features

### 🛍️ Buyer Experience
-   **AI Shopping Assistant ("Koko"):**
    -   Powered by **Groq API (Llama 3.3 70B)**.
    -   Acts as a witty waiter/connoisseur with a distinct personality.
    -   Understands context, remembers conversation history, and handles "not found" items gracefully.
    -   Supports **Indonesian** and **English** (slang included!).
-   **Smart Search:** Natural language product discovery.
-   **Cart & Checkout:**
    -   real-time cart updates.
    -   Support for **QRIS** and **Cash** payment methods.
-   **Order Tracking:** View order status and history.
-   **Direct Chat:** Chat with sellers about specific orders.
-   **Dark/Light Mode:** Fully responsive UI with theme switching.

### 🏪 Seller Dashboard (Admin)
-   **Seller Management:** Manage multiple sellers in a single dashboard.
-   **Inventory Control:** Add, remove, and update products in real-time.
-   **Order Management:**
    -   View pending orders with notification badges.
    -   Confirm or reject orders.
    -   Track revenue projection.
-   **Buyer Communication:** Integrated chat to reply to buyer inquiries.
-   **Availability Toggle:** Instantly mark items as "Sold Out" or "Available".

## 🛠️ Tech Stack

-   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+).
-   **Backend / Database:** Firebase Firestore.
-   **AI / NLP:** Groq API (Llama 3.3).
-   **Icons & Fonts:** Google Fonts (Inter), Emoji-based UI.

## 🚀 Getting Started

### Prerequisites
1.  **Firebase Project:**
    -   Create a project at [firebase.google.com](https://firebase.google.com).
    -   Enable **Firestore Database**.
2.  **Groq API Key:**
    -   Get a free API key from [console.groq.com](https://console.groq.com).

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/RCS2601/koko-chat.git
    cd koko-chat
    ```

2.  **Configure Firebase**
    -   Open `firebase-config.js` (or create it if missing based on `app.js` needs).
    -   Paste your Firebase configuration object.

3.  **Configure AI**
    -   Open `app.js`.
    -   Find `const GROQ_API_KEY = 'YOUR_GROQ_API_KEY';`.
    -   Replace `'YOUR_GROQ_API_KEY'` with your actual Groq API key.
    -   *Note: Never commit your actual API key to GitHub!*

4.  **Run the App**
    -   Simply open `index.html` in your browser for the **Buyer View**.
    -   Open `seller.html` for the **Seller/Admin Dashboard**.
    -   For a better experience, use a local server like Live Server in VS Code.

## 📁 Project Structure

-   `app.js` - Main logic for the Buyer application and AI integration.
-   `seller.js` - Logic for the Seller dashboard and inventory management.
-   `index.html` - Entry point for Buyers.
-   `seller.html` - Entry point for Sellers/Admins.
-   `style.css` - Global and Buyer-specific styles.
-   `seller.css` - Dashboard-specific styles.
-   `ai_memory/` - (Ignored) Stores local AI context logs.

## 💡 How It Works

1.  **The AI Brain:** Koko uses a system prompt that injects the current product catalog into the AI's context. This allows it to "know" what's in stock and make accurate recommendations.
2.  **State Management:** The app uses Firebase Firestore listeners (`onSnapshot`) for real-time updates across all connected clients (Buyers and Sellers see updates instantly).

## 📄 License
This project is open source.
