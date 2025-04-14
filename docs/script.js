// Dashboard JavaScript

// Initialize charts and data when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set last updated time
    document.getElementById('last-updated').textContent = new Date().toLocaleString();
    
    // Load data
    loadDashboardData();
    
    // Initialize charts
    initializeCharts();
});

// Function to load dashboard data
async function loadDashboardData() {
    try {
        // Load products data
        const productsData = await fetchJSON('data/products.json');
        const clickbankData = await fetchJSON('data/clickbank_products.json');
        
        // Load posts data
        const postsData = await fetchJSON('data/posts_index.json');
        const publishedData = await fetchJSON('data/published_posts.json');
        
        // Update metrics
        updateProductMetrics(productsData, clickbankData);
        updatePostMetrics(postsData, publishedData);
        
        // Update tables
        updateRecentPostsTable(postsData, publishedData);
        updateTopProductsTable(productsData, clickbankData);
        
        // Update charts with real data
        updateCharts(productsData, clickbankData, postsData, publishedData);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // If data fails to load, use placeholder data
        usePlaceholderData();
    }
}

// Function to fetch JSON data with error handling
async function fetchJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.warn(`Could not load data from ${url}:`, error);
        return [];
    }
}

// Update product metrics
function updateProductMetrics(amazonProducts = [], clickbankProducts = []) {
    const totalProducts = amazonProducts.length + clickbankProducts.length;
    
    document.getElementById('total-products').textContent = totalProducts;
    document.getElementById('amazon-products').textContent = amazonProducts.length;
    document.getElementById('clickbank-products').textContent = clickbankProducts.length;
}

// Update post metrics
function updatePostMetrics(posts = [], publishedPosts = []) {
    const totalPosts = posts.length;
    const published = publishedPosts.length;
    const drafts = totalPosts - published;
    
    document.getElementById('total-posts').textContent = totalPosts;
    document.getElementById('published-posts').textContent = published;
    document.getElementById('draft-posts').textContent = drafts;
    
    // For demo purposes, set some earnings
    // In a real app, this would come from your affiliate network's API
    const earnings = (published * 5.75).toFixed(2); // Placeholder: $5.75 per post
    const monthlyEarnings = (earnings * 0.7).toFixed(2); // Placeholder: 70% of total
    const dailyEarnings = (monthlyEarnings / 30).toFixed(2); // Placeholder: daily average
    
    document.getElementById('total-earnings').textContent = `$${earnings}`;
    document.getElementById('monthly-earnings').textContent = `$${monthlyEarnings}`;
    document.getElementById('daily-earnings').textContent = `$${dailyEarnings}`;
}

// Update recent posts table
function updateRecentPostsTable(posts = [], publishedPosts = []) {
    const tableBody = document.getElementById('recent-posts-body');
    tableBody.innerHTML = '';
    
    // Create a map of published posts for quick lookup
    const publishedMap = new Map();
    publishedPosts.forEach(post => {
        publishedMap.set(post.filename, post);
    });
    
    // Sort posts by date (newest first)
    const sortedPosts = [...posts].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });
    
    // Display up to 10 most recent posts
    const recentPosts = sortedPosts.slice(0, 10);
    
    recentPosts.forEach(post => {
        const row = document.createElement('tr');
        
        // Determine post status
        const isPublished = publishedMap.has(post.filepath.split('/').pop());
        const status = isPublished ? 'Published' : 'Draft';
        const statusClass = isPublished ? 'status-published' : 'status-draft';
        
        row.innerHTML = `
            <td>${post.title}</td>
            <td>${formatDate(post.date)}</td>
            <td>${post.source}</td>
            <td><span class="status ${statusClass}">${status}</span></td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // If no posts, show a message
    if (recentPosts.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" style="text-align: center;">No posts found</td>';
        tableBody.appendChild(row);
    }
}

// Update top products table
function updateTopProductsTable(amazonProducts = [], clickbankProducts = []) {
    const tableBody = document.getElementById('top-products-body');
    tableBody.innerHTML = '';
    
    // Combine products
    const allProducts = [...amazonProducts, ...clickbankProducts];
    
    // Sort by a random metric for demo purposes
    // In a real app, you'd sort by clicks, conversions, or revenue
    const sortedProducts = allProducts
        .map(product => ({
            ...product,
            clicks: Math.floor(Math.random() * 100),
            conversions: Math.floor(Math.random() * 10)
        }))
        .sort((a, b) => b.clicks - a.clicks);
    
    // Display up to 10 top products
    const topProducts = sortedProducts.slice(0, 10);
    
    topProducts.forEach(product => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${product.title}</td>
            <td>${product.price}</td>
            <td>${product.source}</td>
            <td>${product.clicks}</td>
            <td>${product.conversions}</td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // If no products, show a message
    if (topProducts.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" style="text-align: center;">No products found</td>';
        tableBody.appendChild(row);
    }
}

// Initialize charts with placeholder data
function initializeCharts() {
    // Earnings chart
    const earningsCtx = document.getElementById('earnings-chart').getContext('2d');
    window.earningsChart = new Chart(earningsCtx, {
        type: 'line',
        data: {
            labels: getLast7Days(),
            datasets: [{
                label: 'Daily Earnings ($)',
                data: [0, 0, 0, 0, 0, 0, 0],
                borderColor: '#4a6fa5',
                backgroundColor: 'rgba(74, 111, 165, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            }
        }
    });
    
    // Sources chart
    const sourcesCtx = document.getElementById('sources-chart').getContext('2d');
    window.sourcesChart = new Chart(sourcesCtx, {
        type: 'doughnut',
        data: {
            labels: ['Amazon', 'ClickBank', 'Other'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    '#4a6fa5',
                    '#4caf50',
                    '#ff9800'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });
}

// Update charts with real data
function updateCharts(amazonProducts = [], clickbankProducts = [], posts = [], publishedPosts = []) {
    // Update earnings chart with random data for demo
    // In a real app, this would come from your affiliate network's API
    const earningsData = getLast7Days().map(() => Math.random() * 10 + 5);
    window.earningsChart.data.datasets[0].data = earningsData;
    window.earningsChart.update();
    
    // Update sources chart
    const amazonRevenue = amazonProducts.length * 7.5; // Placeholder: $7.50 per Amazon product
    const clickbankRevenue = clickbankProducts.length * 12.25; // Placeholder: $12.25 per ClickBank product
    const otherRevenue = publishedPosts.length * 2.5; // Placeholder: $2.50 per published post
    
    window.sourcesChart.data.datasets[0].data = [amazonRevenue, clickbankRevenue, otherRevenue];
    window.sourcesChart.update();
}

// Use placeholder data if real data fails to load
function usePlaceholderData() {
    // Update metrics with placeholder data
    document.getElementById('total-products').textContent = '15';
    document.getElementById('amazon-products').textContent = '10';
    document.getElementById('clickbank-products').textContent = '5';
    
    document.getElementById('total-posts').textContent = '8';
    document.getElementById('published-posts').textContent = '6';
    document.getElementById('draft-posts').textContent = '2';
    
    document.getElementById('total-earnings').textContent = '$45.00';
    document.getElementById('monthly-earnings').textContent = '$31.50';
    document.getElementById('daily-earnings').textContent = '$1.05';
    
    // Create placeholder posts
    const placeholderPosts = [
        { title: 'Best Gadgets for Home Office', date: '2023-05-15', source: 'Amazon', status: 'Published' },
        { title: 'Top 10 Kitchen Tools Review', date: '2023-05-12', source: 'Amazon', status: 'Published' },
        { title: 'Fitness Equipment Comparison', date: '2023-05-10', source: 'ClickBank', status: 'Draft' }
    ];
    
    // Create placeholder products
    const placeholderProducts = [
        { title: 'Wireless Earbuds', price: '$49.99', source: 'Amazon', clicks: 87, conversions: 7 },
        { title: 'Smart Watch', price: '$129.99', source: 'Amazon', clicks: 65, conversions: 5 },
        { title: 'Fitness Program', price: '$67.00', source: 'ClickBank', clicks: 42, conversions: 3 }
    ];
    
    // Update tables with placeholder data
    const postsTable = document.getElementById('recent-posts-body');
    postsTable.innerHTML = '';
    
    placeholderPosts.forEach(post => {
        const row = document.createElement('tr');
        const statusClass = post.status === 'Published' ? 'status-published' : 'status-draft';
        
        row.innerHTML = `
            <td>${post.title}</td>
            <td>${post.date}</td>
            <td>${post.source}</td>
            <td><span class="status ${statusClass}">${post.status}</span></td>
        `;
        
        postsTable.appendChild(row);
    });
    
    const productsTable = document.getElementById('top-products-body');
    productsTable.innerHTML = '';
    
    placeholderProducts.forEach(product => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${product.title}</td>
            <td>${product.price}</td>
            <td>${product.source}</td>
            <td>${product.clicks}</td>
            <td>${product.conversions}</td>
        `;
        
        productsTable.appendChild(row);
    });
    
    // Update charts with placeholder data
    window.earningsChart.data.datasets[0].data = [3.50, 5.25, 4.75, 6.00, 7.50, 8.25, 9.75];
    window.earningsChart.update();
    
    window.sourcesChart.data.datasets[0].data = [75, 35, 15];
    window.sourcesChart.update();
}

// Helper function to get the last 7 days as formatted strings
function getLast7Days() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(formatDate(date));
    }
    return dates;
}

// Helper function to format dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
