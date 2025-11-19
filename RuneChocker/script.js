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
    console.log('DOM Content Loaded. Initializing...');
    try {
        await fetchItemMapping();
    } catch (e) {
        console.error('Init error:', e);
    }
    setupEventListeners();
    console.log('Calling loadTopFlips...');
    loadTopFlips();
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
    console.log('Fetching item mapping...');
    try {
        const response = await fetch(`${API_BASE}/mapping`, {
            headers: { 'User-Agent': USER_AGENT }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        itemMapping = await response.json();
        console.log('Item mapping loaded:', itemMapping.length, 'items');
    } catch (error) {
        console.error('Error fetching item mapping:', error);
        // Don't alert, just log. loadTopFlips will handle empty mapping.
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

async function loadTopFlips() {
    const list = document.getElementById('top-flips-list');

    console.log('Starting loadTopFlips...');
    list.innerHTML = '<p class="loading-text">Fetching market data...</p>';

    try {
        if (itemMapping.length === 0) {
            console.log('Item mapping empty, waiting...');
            list.innerHTML = '<p class="loading-text">Waiting for item mapping...</p>';
            return;
        }

        // Create a map for faster item lookup
        const itemMap = new Map(itemMapping.map(i => [i.id, i]));

        // Fetch 24h volume data and Latest prices
        console.log('Fetching 24h and latest...');
        const [volumeRes, latestRes] = await Promise.all([
            fetchWithTimeout(`${API_BASE}/24h`, { headers: { 'User-Agent': USER_AGENT } }),
            fetchWithTimeout(`${API_BASE}/latest`, { headers: { 'User-Agent': USER_AGENT } })
        ]);

        if (!volumeRes.ok || !latestRes.ok) {
            throw new Error('API request failed');
        }

        const volumeData = (await volumeRes.json()).data;
        const latestData = (await latestRes.json()).data;

        console.log('Data fetched. Processing...');
        list.innerHTML = '<p class="loading-text">Processing data...</p>';

        let flips = [];

        // Process items
        for (const id in volumeData) {
            // Convert id to number for map lookup if needed, though keys are strings in JSON
            const item = itemMap.get(parseInt(id));
            const vol = volumeData[id];
            const prices = latestData[id];

            if (!prices) continue; // Need prices
            // If item is missing (mapping failed), we skip or use ID
            const name = item ? item.name : `Item ${id}`;

            const totalVolume = (vol.highPriceVolume || 0) + (vol.lowPriceVolume || 0);

            if (totalVolume > 175 && prices.high && prices.low) {
                const tax = Math.min(prices.high * 0.01, 5000000);
                const profit = (prices.high - tax) - prices.low;
                const roi = (profit / prices.low) * 100;

                if (profit > 0) {
                    flips.push({
                        id: id,
                        name: name,
                        profit: profit,
                        roi: roi,
                        volume: totalVolume
                    });
                }
            }
        }

        console.log(`Found ${flips.length} potential flips.`);

        // Sort by profit desc
        flips.sort((a, b) => b.profit - a.profit);

        // Take top 50
        const topFlips = flips.slice(0, 50);

        // Render
        list.innerHTML = '';

        if (topFlips.length === 0) {
            list.innerHTML = '<p class="loading-text">No flips found matching criteria.</p>';
            return;
        }

        topFlips.forEach(flip => {
            const div = document.createElement('div');
            div.className = 'flip-item';
            div.innerHTML = `
                <div class="flip-item-name">
                    <img src="https://www.osrsbox.com/osrsbox-db/items-icons/${flip.id}.png" alt="${flip.name}" onerror="this.style.display='none'">
                    ${flip.name}
                </div>
                <div>
                    <span class="flip-item-profit">${formatPrice(Math.floor(flip.profit))}</span>
                    <span class="flip-item-roi">${flip.roi.toFixed(2)}% ROI</span>
                    <span class="flip-item-volume">Vol: ${flip.volume.toLocaleString()}</span>
                </div>
            `;
            div.addEventListener('click', () => {
                selectItem({ id: flip.id, name: flip.name });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            list.appendChild(div);
        });

        console.log('Top Flips rendered.');

    } catch (error) {
        console.error('Error loading top flips:', error);
        list.innerHTML = `<p class="loading-text negative-profit">Error loading data: ${error.message}</p>`;
    }
}

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(resource, {
        ...options,
        signal: controller.signal
    });
    clearTimeout(id);
    return response;
}
