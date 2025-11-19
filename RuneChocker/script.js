const API_BASE = 'https://prices.runescape.wiki/api/v1/osrs';
const USER_AGENT = 'OSRS_Price_Checker_Beginner_Project'; // Required by Wiki API

let itemMapping = [];
let currentItemId = null;
let priceChart = null;

// DOM Elements
const searchInput = document.getElementById('item-search');
const searchResults = document.getElementById('search-results');
const itemDataContainer = document.getElementById('item-data');
const itemNameEl = document.getElementById('item-name');
const itemIconEl = document.getElementById('item-icon');
const highPriceEl = document.getElementById('high-price');
const lowPriceEl = document.getElementById('low-price');
const highTimeEl = document.getElementById('high-time');
const lowTimeEl = document.getElementById('low-time');
const profitEl = document.getElementById('profit');
const roiEl = document.getElementById('roi');
const timeButtons = document.querySelectorAll('.time-btn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await fetchItemMapping();
    setupEventListeners();
});

function setupEventListeners() {
    searchInput.addEventListener('input', handleSearch);

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.classList.add('hidden');
        }
    });

    // Time range buttons
    timeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            timeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Fetch new graph data
            if (currentItemId) {
                fetchPriceHistory(currentItemId, btn.dataset.time);
            }
        });
    });
}

async function fetchItemMapping() {
    try {
        const response = await fetch(`${API_BASE}/mapping`, {
            headers: { 'User-Agent': USER_AGENT }
        });
        itemMapping = await response.json();
        console.log('Item mapping loaded:', itemMapping.length, 'items');
    } catch (error) {
        console.error('Error fetching item mapping:', error);
        alert('Failed to load item data. Please refresh.');
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    if (query.length < 2) {
        searchResults.classList.add('hidden');
        return;
    }

    const matches = itemMapping
        .filter(item => item.name.toLowerCase().includes(query))
        .slice(0, 10); // Limit to 10 results

    displaySearchResults(matches);
}

function displaySearchResults(matches) {
    searchResults.innerHTML = '';

    if (matches.length === 0) {
        searchResults.classList.add('hidden');
        return;
    }

    matches.forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-result-item';

        // Create icon for search result
        const icon = document.createElement('img');
        icon.src = `https://www.osrsbox.com/osrsbox-db/items-icons/${item.id}.png`;
        icon.alt = item.name;
        icon.onerror = () => { icon.style.display = 'none'; }; // Hide broken icons

        const span = document.createElement('span');
        span.textContent = item.name;

        div.appendChild(icon);
        div.appendChild(span);

        div.addEventListener('click', () => {
            selectItem(item);
            searchResults.classList.add('hidden');
            searchInput.value = item.name;
        });

        searchResults.appendChild(div);
    });

    searchResults.classList.remove('hidden');
}

async function selectItem(item) {
    currentItemId = item.id;
    itemDataContainer.classList.remove('hidden');
    itemNameEl.textContent = item.name;

    // Set Icon
    itemIconEl.src = `https://www.osrsbox.com/osrsbox-db/items-icons/${item.id}.png`;
    itemIconEl.style.display = 'block';
    itemIconEl.onerror = () => { itemIconEl.style.display = 'none'; };

    await fetchLatestPrice(item.id);
    // Default to 1h graph
    document.querySelector('.time-btn[data-time="1h"]').click();
}

async function fetchLatestPrice(id) {
    try {
        const response = await fetch(`${API_BASE}/latest?id=${id}`, {
            headers: { 'User-Agent': USER_AGENT }
        });
        const data = await response.json();
        const prices = data.data[id];

        if (prices) {
            highPriceEl.textContent = formatPrice(prices.high);
            lowPriceEl.textContent = formatPrice(prices.low);
            highTimeEl.textContent = formatTime(prices.highTime);
            lowTimeEl.textContent = formatTime(prices.lowTime);

            // Calculate Profit and ROI
            if (prices.high && prices.low) {
                const tax = Math.min(prices.high * 0.01, 5000000); // 1% tax capped at 5m
                const profit = (prices.high - tax) - prices.low;
                const roi = (profit / prices.low) * 100;

                profitEl.textContent = formatPrice(Math.floor(profit));
                roiEl.textContent = roi.toFixed(2) + '%';

                // Color coding
                profitEl.className = profit > 0 ? 'positive' : 'negative';
                roiEl.className = roi > 0 ? 'positive' : 'negative';
            } else {
                profitEl.textContent = 'N/A';
                roiEl.textContent = 'N/A';
                profitEl.className = '';
                roiEl.className = '';
            }

        } else {
            highPriceEl.textContent = 'N/A';
            lowPriceEl.textContent = 'N/A';
            profitEl.textContent = 'N/A';
            roiEl.textContent = 'N/A';
        }
    } catch (error) {
        console.error('Error fetching prices:', error);
    }
}

async function fetchPriceHistory(id, timeRange) {
    let timestep;
    // Map range to timestep
    switch (timeRange) {
        case '1h': timestep = '5m'; break;
        case '24h': timestep = '1h'; break;
        case '1w': timestep = '6h'; break;
        case '1m': timestep = '6h'; break; // Wiki API might limit this, let's try
        case '1y': timestep = '24h'; break;
        default: timestep = '5m';
    }

    try {
        const response = await fetch(`${API_BASE}/timeseries?timestep=${timestep}&id=${id}`, {
            headers: { 'User-Agent': USER_AGENT }
        });
        const data = await response.json();

        // Filter data based on time range if needed (API returns all available for timestep)
        // For simplicity, we'll just graph what we get, but ideally we'd filter by timestamp
        const history = data.data;

        renderChart(history, timeRange);
    } catch (error) {
        console.error('Error fetching history:', error);
    }
}

function renderChart(history, timeRange) {
    const ctx = document.getElementById('price-chart').getContext('2d');

    // Process data
    // Filter history based on timeRange to show only relevant data points
    const now = Math.floor(Date.now() / 1000);
    let startTime;
    switch (timeRange) {
        case '1h': startTime = now - 3600; break;
        case '24h': startTime = now - 86400; break;
        case '1w': startTime = now - 604800; break;
        case '1m': startTime = now - 2592000; break;
        case '1y': startTime = now - 31536000; break;
    }

    const filteredHistory = history.filter(pt => pt.timestamp >= startTime);

    const labels = filteredHistory.map(pt => new Date(pt.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const highPrices = filteredHistory.map(pt => pt.avgHighPrice);
    const lowPrices = filteredHistory.map(pt => pt.avgLowPrice);

    if (priceChart) {
        priceChart.destroy();
    }

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'High Price',
                    data: highPrices,
                    borderColor: '#4caf50',
                    tension: 0.1
                },
                {
                    label: 'Low Price',
                    data: lowPrices,
                    borderColor: '#f44336',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    labels: { color: '#e0e0e0' }
                }
            },
            scales: {
                y: {
                    ticks: { color: '#e0e0e0' },
                    grid: { color: '#444' }
                },
                x: {
                    ticks: { color: '#e0e0e0', maxTicksLimit: 8 },
                    grid: { color: '#444' }
                }
            }
        }
    });
}

function formatPrice(price) {
    if (!price) return 'N/A';
    return price.toLocaleString() + ' gp';
}

function formatTime(timestamp) {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    const diff = Math.floor((Date.now() - date) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString();
}
