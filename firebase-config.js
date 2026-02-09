// ============================================
// Firebase Configuration
// Ultimate Store - Buyers are Kings!
// ============================================

// Firebase configuration
// TODO: Replace with your own Firebase config from Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyDntPg7d5iCs6NeRxoRhQyZ4LrWAEH6Yw0",
    authDomain: "tes-doang-1.firebaseapp.com",
    databaseURL: "https://tes-doang-1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tes-doang-1",
    storageBucket: "tes-doang-1.firebasestorage.app",
    messagingSenderId: "262759137542",
    appId: "1:262759137542:web:d5d04935105a8dc3ab1e87",
    measurementId: "G-QWWQP037VH"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// ============================================
// Sample Products Data
// This will be used if Firestore is not configured
// ============================================
const sampleProducts = [
    // Nasi Padang Category
    {
        id: 'p1',
        name: 'Nasi Rendang',
        seller: 'Padang Jaya',
        price: 17000,
        category: 'nasi padang',
        description: 'Nasi dengan rendang daging sapi empuk',
        tags: ['nasi', 'padang', 'rendang', 'daging', 'beef', 'spicy'],
        available: true,
        biddingEnabled: true
    },
    {
        id: 'p2',
        name: 'Nasi Ayam Bakar',
        seller: 'Padang Sederhana',
        price: 16000,
        category: 'nasi padang',
        description: 'Nasi dengan ayam bakar bumbu padang',
        tags: ['nasi', 'padang', 'ayam', 'chicken', 'bakar', 'grilled'],
        available: true,
        biddingEnabled: true
    },
    {
        id: 'p3',
        name: 'Nasi Ayam Goreng',
        seller: 'Warteg Bu Tini',
        price: 15000,
        category: 'nasi padang',
        description: 'Nasi dengan ayam goreng crispy',
        tags: ['nasi', 'ayam', 'chicken', 'goreng', 'fried', 'cheap', 'murah'],
        available: true
    },
    {
        id: 'p4',
        name: 'Nasi Dendeng Balado',
        seller: 'RM Minang Asli',
        price: 18000,
        category: 'nasi padang',
        description: 'Nasi dengan dendeng balado pedas',
        tags: ['nasi', 'padang', 'dendeng', 'balado', 'spicy', 'beef'],
        available: true
    },

    // Sweet Snacks Category
    {
        id: 'p5',
        name: 'Es Teler',
        seller: 'Es Teler 77',
        price: 12000,
        category: 'minuman',
        description: 'Es campur dengan alpukat, kelapa, dan nangka',
        tags: ['sweet', 'manis', 'cold', 'drink', 'dessert', 'fruit'],
        available: true
    },
    {
        id: 'p6',
        name: 'Pisang Goreng Coklat',
        seller: 'Kedai Pisgor',
        price: 8000,
        category: 'snack',
        description: 'Pisang goreng dengan topping coklat leleh',
        tags: ['sweet', 'manis', 'pisang', 'banana', 'coklat', 'chocolate', 'cheap', 'murah'],
        available: true,
        biddingEnabled: true
    },
    {
        id: 'p7',
        name: 'Klepon',
        seller: 'Jajan Pasar Bu Yuni',
        price: 5000,
        category: 'snack',
        description: 'Kue klepon isi gula merah (isi 5)',
        tags: ['sweet', 'manis', 'traditional', 'cheap', 'murah', 'snack'],
        available: false
    },
    {
        id: 'p8',
        name: 'Martabak Manis',
        seller: 'Martabak Pecenongan',
        price: 35000,
        category: 'snack',
        description: 'Martabak manis coklat keju kacang',
        tags: ['sweet', 'manis', 'martabak', 'chocolate', 'cheese', 'big', 'sharing'],
        available: true
    },

    // Drinks
    {
        id: 'p9',
        name: 'Es Jeruk',
        seller: 'Warung Pak Jo',
        price: 5000,
        category: 'minuman',
        description: 'Es jeruk segar',
        tags: ['drink', 'cold', 'fresh', 'cheap', 'murah', 'orange'],
        available: true
    },
    {
        id: 'p10',
        name: 'Kopi Susu',
        seller: 'Kopi Kenangan',
        price: 18000,
        category: 'minuman',
        description: 'Kopi susu gula aren',
        tags: ['drink', 'coffee', 'kopi', 'milk', 'susu'],
        available: true
    },

    // Main Dishes
    {
        id: 'p11',
        name: 'Mie Ayam',
        seller: 'Mie Ayam Bangka',
        price: 15000,
        category: 'makanan',
        description: 'Mie ayam dengan bakso',
        tags: ['noodle', 'mie', 'ayam', 'chicken', 'cheap', 'murah'],
        available: true
    },
    {
        id: 'p12',
        name: 'Bakso Urat',
        seller: 'Bakso Pak Kumis',
        price: 18000,
        category: 'makanan',
        description: 'Bakso urat dengan kuah kaldu sapi',
        tags: ['bakso', 'meatball', 'beef', 'soup', 'kuah'],
        available: true
    },
    {
        id: 'p13',
        name: 'Sate Ayam',
        seller: 'Sate Madura Cak Man',
        price: 20000,
        category: 'makanan',
        description: 'Sate ayam 10 tusuk dengan lontong',
        tags: ['sate', 'satay', 'ayam', 'chicken', 'grilled'],
        available: true
    },
    {
        id: 'p14',
        name: 'Gado-gado',
        seller: 'Bu Haji Gado-gado',
        price: 12000,
        category: 'makanan',
        description: 'Gado-gado dengan bumbu kacang',
        tags: ['vegetable', 'sayur', 'healthy', 'cheap', 'murah', 'peanut'],
        available: true
    },
    {
        id: 'p15',
        name: 'Nasi Goreng Spesial',
        seller: 'Nasgor Bang Jali',
        price: 18000,
        category: 'makanan',
        description: 'Nasi goreng dengan telur, ayam, dan kerupuk',
        tags: ['nasi', 'goreng', 'fried rice', 'egg', 'chicken'],
        available: true
    }
];

// Function to get products from new structure: sellers/{sellerId}/products
async function getProducts() {
    try {
        // First get all sellers
        const sellersSnapshot = await db.collection('sellers').get();

        if (!sellersSnapshot.empty) {
            const allProducts = [];

            // For each seller, get their products
            for (const sellerDoc of sellersSnapshot.docs) {
                const sellerData = sellerDoc.data();
                const productsSnapshot = await db.collection('sellers')
                    .doc(sellerDoc.id)
                    .collection('products')
                    .get();

                productsSnapshot.forEach(productDoc => {
                    allProducts.push({
                        id: productDoc.id,
                        sellerId: sellerDoc.id,
                        seller: sellerData.name, // Add seller name to product
                        ...productDoc.data()
                    });
                });
            }

            if (allProducts.length > 0) {
                console.log('📦 Loaded', allProducts.length, 'products from new structure');
                return allProducts;
            }
        }
    } catch (error) {
        console.warn('Could not fetch from new structure:', error);
    }

    // Fallback to sample products
    console.log('📦 Using sample products (Firestore empty or unavailable)');
    return sampleProducts;
}

// Function to search products
async function searchProducts(query) {
    const products = await getProducts();
    const searchTerms = query.toLowerCase().split(' ');

    // Score each product based on how many search terms match
    const scored = products.map(product => {
        let score = 0;
        const searchableText = [
            product.name,
            product.seller,
            product.category,
            product.description,
            ...product.tags
        ].join(' ').toLowerCase();

        searchTerms.forEach(term => {
            if (searchableText.includes(term)) {
                score += 1;
            }
        });

        return { ...product, score };
    });

    // Filter and sort by score (relevance) then by price (cheapest first)
    return scored
        .filter(p => p.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.price - b.price; // Cheapest first!
        });
}

console.log('🔥 Firebase config loaded');
console.log('📦 Sample products:', sampleProducts.length);
