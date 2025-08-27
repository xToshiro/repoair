document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://for-restful-apis-or-backend-services.onrender.com/api';

    // --- Authentication Guard & Centralized API Fetch ---
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

    // --- Sidebar & Desktop Navigation Logic ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const sections = document.querySelectorAll('.dashboard-section');

    const handleNavLinkClick = (e) => {
        e.preventDefault();
        const targetLink = e.currentTarget;
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        targetLink.classList.add('active');
        const targetId = targetLink.getAttribute('href').substring(1);
        document.getElementById(targetId).classList.add('active');
    };
    navLinks.forEach(link => link.addEventListener('click', handleNavLinkClick));

    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // --- Mobile Navigation Logic ---
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


    // --- Confirmation Modal Logic ---
    const modal = document.getElementById('confirmation-modal');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalMessage = document.getElementById('modal-message');

    const showConfirmationModal = (message, onConfirm) => {
        modalMessage.textContent = message;
        modal.classList.add('visible');
        const confirmHandler = () => {
            onConfirm();
            hideModal();
        };
        const hideModal = () => {
            modal.classList.remove('visible');
            modalConfirmBtn.removeEventListener('click', confirmHandler);
        };
        modalConfirmBtn.addEventListener('click', confirmHandler, { once: true });
        modalCancelBtn.addEventListener('click', hideModal, { once: true });
    };

    // --- Map Logic ---
    let map = null;
    let mapMarkers = L.layerGroup();
    let lightTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO' });
    let darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO' });

    const initMap = () => {
        map = L.map('map').setView([-3.74, -38.53], 12);
        document.body.classList.contains('dark-theme') ? darkTile.addTo(map) : lightTile.addTo(map);
        mapMarkers.addTo(map);
    };
    
    desktopThemeSwitcher.addEventListener('click', () => {
        setTimeout(() => {
            const isDark = document.body.classList.contains('dark-theme');
            if (map) {
                if (isDark) { map.removeLayer(lightTile); darkTile.addTo(map); } 
                else { map.removeLayer(darkTile); lightTile.addTo(map); }
            }
        }, 100);
    });

    const updateMapMarkers = (monitors) => {
        if (!map) return;
        mapMarkers.clearLayers();
        if (monitors.length === 0) return;
        const bounds = [];
        monitors.forEach(monitor => {
            const lat = parseFloat(monitor.latitude);
            const lon = parseFloat(monitor.longitude);
            if (!isNaN(lat) && !isNaN(lon)) {
                mapMarkers.addLayer(L.marker([lat, lon]).bindPopup(`<b>${monitor.monitor_id}</b>`));
                bounds.push([lat, lon]);
            }
        });
        if(bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
    };

    // --- Monitor Management ---
    const activeMonitorsCount = document.getElementById('active-monitors-count');
    const monitorsListContainer = document.getElementById('monitors-list-container');
    const addMonitorForm = document.getElementById('add-monitor-form');

    const handleDeleteMonitor = (monitorId, monitorName) => {
        showConfirmationModal(`Tem certeza que deseja deletar o monitor "${monitorName}"?`, async () => {
            const response = await apiFetch(`/monitor/${monitorId}`, { method: 'DELETE' });
            if (response && response.ok) {
                loadMonitors();
            }
        });
    };

    const renderMonitors = (monitors) => {
        activeMonitorsCount.textContent = monitors.length;
        updateMapMarkers(monitors);

        if (monitors.length === 0) {
            monitorsListContainer.innerHTML = '<p class="list-placeholder">Nenhum monitor cadastrado.</p>';
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
            deleteBtn.onclick = () => handleDeleteMonitor(m.id, m.monitor_id);
            actionsCell.appendChild(deleteBtn);
        });

        monitorsListContainer.innerHTML = '';
        monitorsListContainer.appendChild(table);
    };

    const loadMonitors = async () => {
        const response = await apiFetch('/monitor');
        if (response && response.ok) {
            const monitors = await response.json();
            renderMonitors(monitors);
        } else {
             renderMonitors([]);
        }
    };
    
    addMonitorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const monitorId = document.getElementById('monitor-id').value;
        const latitude = document.getElementById('monitor-lat').value.replace(',', '.');
        const longitude = document.getElementById('monitor-lon').value.replace(',', '.');

        const response = await apiFetch('/monitor', {
            method: 'POST',
            body: JSON.stringify({ monitor_id: monitorId, latitude, longitude })
        });

        if (response && response.ok) {
            addMonitorForm.reset();
            loadMonitors();
        }
    });

    // --- Initial Load ---
    const initializeDashboard = () => {
        initMap();
        loadMonitors();
    };

    initializeDashboard();

    // --- Example Chart.js ---
    const ctx = document.getElementById('qualityIndexChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
            datasets: [{
                label: 'Índice de Qualidade do Ar (IQA)',
                data: [],
                backgroundColor: 'rgba(0, 168, 107, 0.2)',
                borderColor: 'rgba(0, 168, 107, 1)',
                borderWidth: 2,
                tension: 0.4
            }]
        },
        options: { scales: { y: { beginAtZero: true } }, responsive: true, maintainAspectRatio: false }
    });
});
