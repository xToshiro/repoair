document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://for-restful-apis-or-backend-services.onrender.com/api';
    let mainChartInstance = null;
    let aggregateCharts = {};
    let allMonitorsData = []; // Store for all processed data [{ monitorInfo, readings }]
    
    // --- Authentication & API Fetch Logic ---
    const handleLogout = () => {
        sessionStorage.removeItem('authToken');
        window.location.href = 'dashboard.html';
    };

    const apiFetch = async (endpoint, options = {}) => {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            handleLogout();
            return;
        }

        const defaultHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        const config = { ...options, headers: { ...defaultHeaders, ...options.headers }, mode: 'cors' };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            if (response.status === 401 || response.status === 422) {
                handleLogout();
                return;
            }
            return response;
        } catch (error) {
            console.error('API Fetch Error:', error);
        }
    };

    // --- Navigation Logic ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

    const handleNavLinkClick = (e) => {
        e.preventDefault();
        const targetLink = e.currentTarget;
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
        targetLink.classList.add('active');
        const targetId = targetLink.getAttribute('href').substring(1);
        document.getElementById(targetId).classList.add('active');
    };
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => link.addEventListener('click', handleNavLinkClick));
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Mobile Navigation
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
    const desktopSidebar = document.querySelector('.sidebar');
    const desktopNavContent = desktopSidebar.querySelector('.sidebar-nav ul').cloneNode(true);
    const desktopFooterContent = desktopSidebar.querySelector('.sidebar-footer').cloneNode(true);
    mobileNav.appendChild(desktopNavContent);
    mobileNav.appendChild(desktopFooterContent);
    const toggleMobileMenu = () => {
        mobileNav.classList.toggle('active');
        mobileNavOverlay.classList.toggle('active');
    };
    mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    mobileNavOverlay.addEventListener('click', toggleMobileMenu);
    mobileNav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            handleNavLinkClick(e);
            toggleMobileMenu();
        });
    });
    const mobileThemeSwitcher = mobileNav.querySelector('.theme-btn');
    const desktopThemeSwitcher = desktopSidebar.querySelector('.theme-btn');
    mobileThemeSwitcher.addEventListener('click', () => desktopThemeSwitcher.click());
    mobileNav.querySelector('.logout-btn').addEventListener('click', handleLogout);

    // Confirmation Modal
    const modal = document.getElementById('confirmation-modal');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalMessage = document.getElementById('modal-message');
    const showConfirmationModal = (message, onConfirm) => {
        modalMessage.textContent = message;
        modal.classList.add('visible');
        const hideModal = () => {
            modal.classList.remove('visible');
            modalConfirmBtn.removeEventListener('click', confirmHandler);
        };
        const confirmHandler = () => { onConfirm(); hideModal(); };
        modalConfirmBtn.addEventListener('click', confirmHandler, { once: true });
        modalCancelBtn.addEventListener('click', hideModal, { once: true });
    };

    // --- Data Processing and UI Updates ---
    const updateDashboardCards = (data) => {
        const latestReadings = data.map(d => d.readings.length > 0 ? d.readings[d.readings.length - 1].json_file : null).filter(r => r);

        if (latestReadings.length === 0) {
            document.getElementById('avg-temp-card').textContent = '-';
            document.getElementById('avg-hum-card').textContent = '-';
            document.getElementById('avg-pm25-card').textContent = '-';
            return;
        }

        const avgTemp = latestReadings.reduce((sum, r) => sum + (r.extTemp || 0), 0) / latestReadings.length;
        const avgHum = latestReadings.reduce((sum, r) => sum + (r.hum || 0), 0) / latestReadings.length;
        const avgPm25 = latestReadings.reduce((sum, r) => sum + (r.pm25 || 0), 0) / latestReadings.length;

        document.getElementById('avg-temp-card').textContent = `${avgTemp.toFixed(1)} °C`;
        document.getElementById('avg-hum-card').textContent = `${avgHum.toFixed(1)} %`;
        document.getElementById('avg-pm25-card').textContent = `${avgPm25.toFixed(1)} µg/m³`;
    };

    const updateMapMarkers = (data) => {
        if (!map) return;
        mapMarkers.clearLayers();
        if (data.length === 0) return;

        const bounds = [];
        data.forEach(item => {
            const monitor = item.monitorInfo;
            const latestReading = item.readings.length > 0 ? item.readings[item.readings.length - 1].json_file : null;
            const lat = parseFloat(monitor.latitude);
            const lon = parseFloat(monitor.longitude);

            if (!isNaN(lat) && !isNaN(lon)) {
                let popupContent = `<b>${monitor.monitor_id}</b><br>---<br>`;
                if (latestReading) {
                    popupContent += `Temp: ${latestReading.extTemp?.toFixed(1) || 'N/A'} °C<br>`;
                    popupContent += `Umidade: ${latestReading.hum?.toFixed(1) || 'N/A'} %<br>`;
                    popupContent += `PM2.5: ${latestReading.pm25?.toFixed(1) || 'N/A'} µg/m³`;
                } else {
                    popupContent += 'Nenhum dado recente.';
                }
                
                mapMarkers.addLayer(L.marker([lat, lon]).bindPopup(popupContent));
                bounds.push([lat, lon]);
            }
        });

        if(bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
    };

    const populateAnalysisFilters = (monitors) => {
        const container = document.getElementById('monitor-filter-container');
        container.innerHTML = '';
        if (monitors.length === 0) {
            container.innerHTML = '<p>Nenhum monitor encontrado.</p>';
            return;
        }
        monitors.forEach((monitor) => {
            const label = document.createElement('label');
            label.className = 'checkbox-label';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = monitor.id;
            checkbox.checked = true; // Check all monitors by default
            label.appendChild(checkbox);
            label.append(` ${monitor.monitor_id}`);
            container.appendChild(label);
        });
    };
    
    // --- Chart Logic ---
    const colors = ['#00A86B', '#48D1CC', '#FF6384', '#36A2EB', '#FFCE56', '#9966FF'];

    const createChartData = (selectedMonitorIds, metricKey) => {
        const datasets = [];
        selectedMonitorIds.forEach((id, index) => {
            const monitorData = allMonitorsData.find(d => d.monitorInfo.id === id);
            if (monitorData && monitorData.readings) {
                const dataPoints = monitorData.readings
                    .filter(r => r.json_file && typeof r.json_file[metricKey] !== 'undefined' && r.json_file.Timestamp)
                    .map(r => ({
                        x: new Date(r.json_file.Timestamp).getTime(), // Use getTime() for sorting
                        y: r.json_file[metricKey]
                    }));
                
                // CRITICAL FIX: Sort the data points by timestamp
                dataPoints.sort((a, b) => a.x - b.x);

                datasets.push({
                    label: monitorData.monitorInfo.monitor_id,
                    data: dataPoints,
                    borderColor: colors[index % colors.length],
                    backgroundColor: colors[index % colors.length] + '33',
                    tension: 0.1,
                    fill: false
                });
            }
        });
        return datasets;
    };

    const updateMainChart = () => {
        const selectedMonitorIds = [...document.querySelectorAll('#monitor-filter-container input:checked')].map(cb => cb.value);
        const selectedMetric = document.getElementById('metric-selector').value;
        const metricLabel = document.getElementById('metric-selector').options[document.getElementById('metric-selector').selectedIndex].text;

        mainChartInstance.data.datasets = createChartData(selectedMonitorIds, selectedMetric);
        mainChartInstance.options.plugins.title.text = metricLabel;
        mainChartInstance.update();
    };
    
    const updateAggregateCharts = () => {
        const selectedMonitorIds = [...document.querySelectorAll('#monitor-filter-container input:checked')].map(cb => cb.value);
        Object.keys(aggregateCharts).forEach(metricKey => {
            const chart = aggregateCharts[metricKey];
            chart.data.datasets = createChartData(selectedMonitorIds, metricKey);
            chart.update();
        });
    };

    const setupAnalysisListeners = () => {
        document.getElementById('apply-filters-btn').addEventListener('click', updateMainChart);
        document.getElementById('monitor-filter-container').addEventListener('change', updateAggregateCharts);
    };

    // --- Map Logic ---
    let map = null;
    let mapMarkers = L.layerGroup();
    let lightTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO' });
    let darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO' });
    const initMap = () => {
        if (map) return;
        map = L.map('map').setView([-3.74, -38.53], 12);
        document.body.classList.contains('dark-theme') ? darkTile.addTo(map) : lightTile.addTo(map);
        mapMarkers.addTo(map);
    };
    desktopThemeSwitcher.addEventListener('click', () => {
        setTimeout(() => {
            if (map) {
                if (document.body.classList.contains('dark-theme')) { map.removeLayer(lightTile); darkTile.addTo(map); } 
                else { map.removeLayer(darkTile); lightTile.addTo(map); }
            }
        }, 100);
    });

    // --- Monitor Management ---
    const renderMonitorsTable = (monitors) => {
        const container = document.getElementById('monitors-list-container');
        if (monitors.length === 0) {
            container.innerHTML = '<p class="list-placeholder">Nenhum monitor cadastrado.</p>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `<thead><tr><th>ID do Monitor</th><th>Latitude</th><th>Longitude</th><th>Ações</th></tr></thead><tbody></tbody>`;
        const tbody = table.querySelector('tbody');
        monitors.forEach(m => {
            const row = tbody.insertRow();
            row.innerHTML = `<td>${m.monitor_id}</td><td>${m.latitude}</td><td>${m.longitude}</td>`;
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            actionsCell.innerHTML = `<button title="Editar"><i class="fas fa-edit"></i></button>`;
            const deleteBtn = document.createElement('button');
            deleteBtn.title = 'Deletar';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.onclick = () => showConfirmationModal(`Tem certeza que deseja deletar o monitor "${m.monitor_id}"?`, async () => {
                 const response = await apiFetch(`/monitor/${m.id}`, { method: 'DELETE' });
                 if (response && response.ok) { loadAndProcessData(); }
            });
            actionsCell.appendChild(deleteBtn);
        });
        container.innerHTML = '';
        container.appendChild(table);
    };
    
    document.getElementById('add-monitor-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const response = await apiFetch('/monitor', {
            method: 'POST',
            body: JSON.stringify({ 
                monitor_id: document.getElementById('monitor-id').value, 
                latitude: document.getElementById('monitor-lat').value.replace(',', '.'), 
                longitude: document.getElementById('monitor-lon').value.replace(',', '.') 
            })
        });
        if (response && response.ok) {
            e.target.reset();
            loadAndProcessData();
        }
    });

    // --- Main Data Loading Orchestrator ---
    const loadAndProcessData = async () => {
        const monitorsResponse = await apiFetch('/monitor');
        if (!monitorsResponse || !monitorsResponse.ok) {
            renderMonitorsTable([]); return;
        }
        const monitors = await monitorsResponse.json();
        renderMonitorsTable(monitors);
        populateAnalysisFilters(monitors);

        const dataPromises = monitors.map(m =>
            apiFetch(`/quality_indice_by_monitor/${m.id}`).then(res => res.ok ? res.json() : [])
        );
        const results = await Promise.all(dataPromises);

        allMonitorsData = monitors.map((monitor, index) => ({
            monitorInfo: monitor,
            readings: results[index] || []
        }));
        
        updateDashboardCards(allMonitorsData);
        updateMapMarkers(allMonitorsData);
        updateMainChart();
        updateAggregateCharts();
    };

    // --- Initial Load ---
    const initializeDashboard = () => {
        initMap();
        
        // CRITICAL FIX: Removed hardcoded time unit to allow auto-scaling
        const chartOptions = (title) => ({
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    type: 'time', 
                    time: { 
                        tooltipFormat: 'dd/MM/yyyy HH:mm' 
                    }, 
                    title: { display: false } 
                },
                y: { title: { display: true, text: 'Valor' } }
            },
            plugins: {
                title: { display: true, text: title, font: { size: 16 } },
                legend: { display: false }
            }
        });

        mainChartInstance = new Chart(document.getElementById('qualityIndexChart').getContext('2d'), {
            type: 'line', data: { datasets: [] }, options: { ...chartOptions('Índice de Qualidade'), plugins: { ...chartOptions().plugins, legend: { display: true, position: 'top' } } }
        });

        aggregateCharts.extTemp = new Chart(document.getElementById('tempChart').getContext('2d'), { type: 'line', data: { datasets: [] }, options: chartOptions('Temperatura (°C)') });
        aggregateCharts.hum = new Chart(document.getElementById('humChart').getContext('2d'), { type: 'line', data: { datasets: [] }, options: chartOptions('Umidade (%)') });
        aggregateCharts.pm1 = new Chart(document.getElementById('pm1Chart').getContext('2d'), { type: 'line', data: { datasets: [] }, options: chartOptions('PM1.0 (µg/m³)') });
        aggregateCharts.pm25 = new Chart(document.getElementById('pm25Chart').getContext('2d'), { type: 'line', data: { datasets: [] }, options: chartOptions('PM2.5 (µg/m³)') });
        aggregateCharts.pm10 = new Chart(document.getElementById('pm10Chart').getContext('2d'), { type: 'line', data: { datasets: [] }, options: chartOptions('PM10 (µg/m³)') });
        aggregateCharts.Pres = new Chart(document.getElementById('presChart').getContext('2d'), { type: 'line', data: { datasets: [] }, options: chartOptions('Pressão (hPa)') });

        setupAnalysisListeners();
        loadAndProcessData();
    };

    initializeDashboard();
});

