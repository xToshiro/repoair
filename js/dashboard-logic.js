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
            return; // Stop execution
        }

        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
            mode: 'cors'
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            // Token expired or invalid
            if (response.status === 401 || response.status === 422) {
                handleLogout();
                return;
            }
            return response;
        } catch (error) {
            console.error('API Fetch Error:', error);
            // Handle network errors
        }
    };

    // --- Sidebar Logic ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

    // --- Navigation Logic ---
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.dashboard-section');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            link.classList.add('active');
            const targetId = link.getAttribute('href').substring(1);
            document.getElementById(targetId).classList.add('active');
        });
    });

    // --- Logout Button ---
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // --- Monitor Management ---
    const activeMonitorsCount = document.getElementById('active-monitors-count');
    const monitorsListContainer = document.getElementById('monitors-list-container');
    const addMonitorForm = document.getElementById('add-monitor-form');

    const renderMonitors = (monitors) => {
        // Update overview card
        activeMonitorsCount.textContent = monitors.length;

        // Populate monitors table
        if (monitors.length === 0) {
            monitorsListContainer.innerHTML = '<p class="list-placeholder">Nenhum monitor cadastrado.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID do Monitor</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${monitors.map(m => `
                    <tr>
                        <td>${m.monitor_id}</td>
                        <td>${m.latitude}</td>
                        <td>${m.longitude}</td>
                        <td class="action-buttons">
                            <button title="Editar"><i class="fas fa-edit"></i></button>
                            <button title="Deletar"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
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
        // Replace comma with dot for validation
        const latitude = document.getElementById('monitor-lat').value.replace(',', '.');
        const longitude = document.getElementById('monitor-lon').value.replace(',', '.');

        const response = await apiFetch('/monitor', {
            method: 'POST',
            body: JSON.stringify({
                monitor_id: monitorId,
                latitude: latitude,
                longitude: longitude
            })
        });

        if (response && response.ok) {
            addMonitorForm.reset();
            loadMonitors(); // Refresh the list
            // Add success message later
        } else {
            // Add error message later
        }
    });


    // --- Initial Load ---
    const initializeDashboard = () => {
        loadMonitors();
        // Load other data as needed
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
                data: [], // Start with empty data
                backgroundColor: 'rgba(0, 168, 107, 0.2)',
                borderColor: 'rgba(0, 168, 107, 1)',
                borderWidth: 2,
                tension: 0.4
            }]
        },
        options: { scales: { y: { beginAtZero: true } }, responsive: true, maintainAspectRatio: false }
    });
});
