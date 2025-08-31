document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://for-restful-apis-or-backend-services.onrender.com/api';
    let mainChartInstance = null;
    let aggregateCharts = {};
    let allMonitorsData = [];
    let repoairLogoBase64, tramaLogoBase64;
    
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
        const config = { ...options, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...options.headers }, mode: 'cors' };
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            if (response.status === 401 || response.status === 422) handleLogout();
            return response;
        } catch (error) { console.error('API Fetch Error:', error); }
    };

    // --- Navigation Logic ---
    const sidebar = document.getElementById('sidebar');
    document.getElementById('sidebar-toggle').addEventListener('click', () => sidebar.classList.toggle('collapsed'));

    const handleNavLinkClick = (e) => {
        e.preventDefault();
        const targetLink = e.currentTarget;
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
        targetLink.classList.add('active');
        document.getElementById(targetLink.getAttribute('href').substring(1)).classList.add('active');
    };
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => link.addEventListener('click', handleNavLinkClick));
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Mobile Navigation
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
    const desktopSidebar = document.querySelector('.sidebar');
    mobileNav.appendChild(desktopSidebar.querySelector('.sidebar-nav ul').cloneNode(true));
    mobileNav.appendChild(desktopSidebar.querySelector('.sidebar-footer').cloneNode(true));
    const toggleMobileMenu = () => { mobileNav.classList.toggle('active'); mobileNavOverlay.classList.toggle('active'); };
    [mobileMenuToggle, mobileNavOverlay].forEach(el => el.addEventListener('click', toggleMobileMenu));
    mobileNav.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', (e) => { handleNavLinkClick(e); toggleMobileMenu(); }));
    mobileNav.querySelector('.theme-btn').addEventListener('click', () => desktopSidebar.querySelector('.theme-btn').click());
    mobileNav.querySelector('.logout-btn').addEventListener('click', handleLogout);

    // --- Modal Logic ---
    const modal = document.getElementById('confirmation-modal');
    const showConfirmationModal = (message, onConfirm) => {
        modal.querySelector('#modal-message').textContent = message;
        modal.classList.add('visible');
        const confirmHandler = () => { onConfirm(); hideModal(); };
        const hideModal = () => {
            modal.classList.remove('visible');
            modal.querySelector('#modal-confirm-btn').removeEventListener('click', confirmHandler);
        };
        modal.querySelector('#modal-confirm-btn').addEventListener('click', confirmHandler, { once: true });
        modal.querySelector('#modal-cancel-btn').addEventListener('click', hideModal, { once: true });
    };

    // --- Data Processing & UI Updates ---
    const getSelectedMonitorData = (containerId) => {
        const selectedMonitorIds = [...document.querySelectorAll(`#${containerId} input:checked`)].map(cb => cb.value);
        return allMonitorsData.filter(d => selectedMonitorIds.includes(d.monitorInfo.id));
    };
    
    const flattenDataForExport = (data, selectedVariables) => {
        const flatData = [];
        data.forEach(monitorData => {
            monitorData.readings.forEach(reading => {
                const row = {
                    'Monitor ID': monitorData.monitorInfo.monitor_id,
                    'Timestamp': reading.json_file.Timestamp,
                };
                selectedVariables.forEach(v => {
                    row[v.label] = reading.json_file[v.key];
                });
                flatData.push(row);
            });
        });
        return flatData.sort((a,b) => new Date(a.Timestamp) - new Date(b.Timestamp));
    };

    const updateDashboardCards = (data) => {
        const latestReadings = data.map(d => d.readings.length > 0 ? d.readings.slice(-1)[0].json_file : null).filter(r => r);
        if (latestReadings.length === 0) return;
        const calcAvg = (key) => latestReadings.reduce((sum, r) => sum + (r[key] || 0), 0) / latestReadings.length;
        document.getElementById('avg-temp-card').textContent = `${calcAvg('extTemp').toFixed(1)} °C`;
        document.getElementById('avg-hum-card').textContent = `${calcAvg('hum').toFixed(1)} %`;
        document.getElementById('avg-pm25-card').textContent = `${calcAvg('pm25').toFixed(1)} µg/m³`;
    };

    const updateMapMarkers = (data) => {
        if (!map) return;
        mapMarkers.clearLayers();
        if (data.length === 0) return;
        const bounds = [];
        data.forEach(item => {
            const latest = item.readings.length > 0 ? item.readings.slice(-1)[0].json_file : null;
            const lat = parseFloat(item.monitorInfo.latitude), lon = parseFloat(item.monitorInfo.longitude);
            if (!isNaN(lat) && !isNaN(lon)) {
                const popup = `<b>${item.monitorInfo.monitor_id}</b><br>${latest ? `Temp: ${latest.extTemp?.toFixed(1)}°C<br>PM2.5: ${latest.pm25?.toFixed(1)}µg/m³` : 'N/A'}`;
                mapMarkers.addLayer(L.marker([lat, lon]).bindPopup(popup));
                bounds.push([lat, lon]);
            }
        });
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
    };

    const populateFilters = (containerId, monitors) => {
        const container = document.getElementById(containerId);
        container.innerHTML = monitors.length ? '' : '<p>Nenhum monitor encontrado.</p>';
        monitors.forEach(m => {
            container.innerHTML += `<label class="checkbox-label"><input type="checkbox" value="${m.id}" checked> ${m.monitor_id}</label>`;
        });
    };
    
    const populateExtractTable = () => {
        const container = document.getElementById('data-extract-table-container');
        const selectedMonitors = getSelectedMonitorData('extract-monitor-filter-container');
        const selectedVariables = [...document.querySelectorAll('#extract-variable-filter-container input:checked')].map(cb => ({ key: cb.value, label: cb.dataset.label }));
        
        const flatData = flattenDataForExport(selectedMonitors, selectedVariables);
        
        if (flatData.length === 0) {
            container.innerHTML = '<p class="list-placeholder">Nenhum dado para exibir com os filtros selecionados.</p>';
            return;
        }
        
        const headers = ['Monitor ID', 'Timestamp', ...selectedVariables.map(v => v.label)];
        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody></tbody>`;
        const tbody = table.querySelector('tbody');
        flatData.forEach(row => {
            const tr = tbody.insertRow();
            headers.forEach(header => tr.insertCell().textContent = row[header] !== undefined ? row[header] : 'N/A');
        });
        container.innerHTML = '';
        container.appendChild(table);
    };

    // --- Chart Logic ---
    const colors = ['#00A86B', '#48D1CC', '#FF6384', '#36A2EB', '#FFCE56', '#9966FF'];
    const createChartData = (selectedMonitorIds, metricKey) => {
        const datasets = [];
        selectedMonitorIds.forEach((id, index) => {
            const monitorData = allMonitorsData.find(d => d.monitorInfo.id === id);
            if (monitorData) {
                const dataPoints = monitorData.readings
                    .filter(r => r.json_file?.[metricKey] !== undefined && r.json_file.Timestamp)
                    .map(r => ({ x: new Date(r.json_file.Timestamp).getTime(), y: r.json_file[metricKey] }))
                    .sort((a, b) => a.x - b.x);
                datasets.push({ label: monitorData.monitorInfo.monitor_id, data: dataPoints, borderColor: colors[index % colors.length], tension: 0.1, fill: false });
            }
        });
        return datasets;
    };

    const updateChart = (chartInstance, selectedMonitorIds, metricKey, title) => {
        chartInstance.data.datasets = createChartData(selectedMonitorIds, metricKey);
        if(title) chartInstance.options.plugins.title.text = title;
        chartInstance.update();
    };

    // --- Map Logic ---
    let map = null, mapMarkers = L.layerGroup();
    const initMap = () => {
        if (map) return;
        map = L.map('map').setView([-3.74, -38.53], 12);
        const updateTiles = () => {
            const light = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            const dark = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            const tileUrl = document.body.classList.contains('dark-theme') ? dark : light;
            if (map.tileLayer) map.removeLayer(map.tileLayer);
            map.tileLayer = L.tileLayer(tileUrl, { attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(map);
        };
        updateTiles();
        mapMarkers.addTo(map);
        desktopSidebar.querySelector('.theme-btn').addEventListener('click', () => setTimeout(updateTiles, 100));
    };

    // --- Monitor Management ---
    const renderMonitorsTable = (monitors) => {
        const container = document.getElementById('monitors-list-container');
        container.innerHTML = monitors.length ? '' : '<p class="list-placeholder">Nenhum monitor cadastrado.</p>';
        if (monitors.length === 0) return;
        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `<thead><tr><th>ID</th><th>Lat</th><th>Lon</th><th>Ações</th></tr></thead><tbody></tbody>`;
        monitors.forEach(m => {
            const row = table.querySelector('tbody').insertRow();
            row.innerHTML = `<td>${m.monitor_id}</td><td>${m.latitude}</td><td>${m.longitude}</td>`;
            const deleteBtn = document.createElement('button');
            deleteBtn.title = 'Deletar';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.onclick = () => showConfirmationModal(`Deletar monitor "${m.monitor_id}"?`, async () => {
                 if ((await apiFetch(`/monitor/${m.id}`, { method: 'DELETE' }))?.ok) loadAndProcessData();
            });
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            actionsCell.innerHTML = `<button title="Editar"><i class="fas fa-edit"></i></button>`;
            actionsCell.appendChild(deleteBtn);
        });
        container.appendChild(table);
    };
    
    document.getElementById('add-monitor-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = { 
            monitor_id: e.target.querySelector('#monitor-id').value, 
            latitude: e.target.querySelector('#monitor-lat').value, 
            longitude: e.target.querySelector('#monitor-lon').value
        };
        if ((await apiFetch('/monitor', { method: 'POST', body: JSON.stringify(body) }))?.ok) {
            e.target.reset();
            loadAndProcessData();
        }
    });

    // --- Export Logic ---
    const imageToBase64 = (imgElement) => {
        return new Promise((resolve, reject) => {
            imgElement.onerror = () => reject(new Error(`Could not load image at ${imgElement.src}`));
            if (imgElement.complete && imgElement.naturalHeight !== 0) {
                const canvas = document.createElement("canvas");
                canvas.width = imgElement.naturalWidth;
                canvas.height = imgElement.naturalHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(imgElement, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            } else {
                imgElement.onload = () => resolve(imageToBase64(imgElement));
            }
        });
    };
    
    const loadLogosForPdf = async () => {
        try {
            [repoairLogoBase64, tramaLogoBase64] = await Promise.all([
                imageToBase64(document.getElementById('repoair-logo-pdf')),
                imageToBase64(document.getElementById('trama-logo-pdf'))
            ]);
        } catch (error) {
             console.error(
                "AVISO: Não foi possível carregar os logos para o relatório PDF. " +
                "Verifique os seguintes pontos:\n" +
                "1. Se os caminhos para 'repologo.png' e 'trama-logo-verde.png' em 'main-dashboard.html' estão corretos.\n" +
                "2. Se os arquivos de imagem existem na pasta 'assets/images/'.\n" +
                "3. Se há erros de carregamento (404 Not Found) na aba 'Rede' (Network) do console do navegador.\n" +
                "O relatório será gerado sem os logos.",
                error
            );
        }
    };

    const setupExportListeners = () => {
        document.getElementById('refresh-extract-table-btn').addEventListener('click', populateExtractTable);
        
        const getFilteredDataForExport = () => {
            const selectedMonitors = getSelectedMonitorData('extract-monitor-filter-container');
            const selectedVariables = [...document.querySelectorAll('#extract-variable-filter-container input:checked')].map(cb => ({ key: cb.value, label: cb.dataset.label }));
            const flatData = flattenDataForExport(selectedMonitors, selectedVariables);
            if (flatData.length === 0) {
                alert('Nenhum dado para exportar com os filtros selecionados.');
                return null;
            }
            return flatData;
        };

        document.getElementById('export-csv-btn').addEventListener('click', () => {
            const data = getFilteredDataForExport();
            if (!data) return;
            const csvContent = "data:text/csv;charset=utf-8," + [Object.keys(data[0]), ...data.map(item => Object.values(item))].map(e => e.join(",")).join("\n");
            const link = document.createElement("a");
            link.setAttribute("href", encodeURI(csvContent));
            link.setAttribute("download", "repoair_data.csv");
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        });
        
        document.getElementById('export-xlsx-btn').addEventListener('click', () => {
            const data = getFilteredDataForExport();
            if (!data) return;
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DadosRepoAir");
            XLSX.writeFile(wb, "repoair_data.xlsx");
        });
        
        document.getElementById('export-pdf-btn').addEventListener('click', () => {
            const data = getFilteredDataForExport();
            if (!data) return;
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Header
            if(repoairLogoBase64) doc.addImage(repoairLogoBase64, 'PNG', 14, 10, 50, 22);
            if(tramaLogoBase64) doc.addImage(tramaLogoBase64, 'PNG', doc.internal.pageSize.getWidth() - 54, 10, 40, 17);

            doc.setFontSize(10).text("Laboratório de Transportes e Meio Ambiente (TRAMA) - UFC", doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });

            // Title
            doc.setFontSize(16).text("Relatório de Dados - Plataforma RepoAir", doc.internal.pageSize.getWidth() / 2, 50, { align: 'center' });
            doc.setFontSize(10).text(`Gerado em: ${new Date().toLocaleString()}`, doc.internal.pageSize.getWidth() / 2, 56, { align: 'center' });

            doc.autoTable({
                startY: 70,
                head: [Object.keys(data[0])],
                body: data.map(row => Object.values(row)),
                theme: 'striped',
                headStyles: { fillColor: [0, 168, 107] }
            });

            doc.save('repoair_report.pdf');
        });
    };

    // --- Main Initializer ---
    const initializeDashboard = () => {
        loadLogosForPdf(); // Load logos in the background, non-blocking
        
        initMap();
        
        const chartOptions = (title) => ({
            responsive: true, maintainAspectRatio: false,
            scales: { x: { type: 'time', time: { tooltipFormat: 'dd/MM/yyyy HH:mm' } }, y: { title: { display: true, text: 'Valor' } } },
            plugins: { title: { display: true, text: title, font: { size: 16 } }, legend: { display: false } }
        });

        mainChartInstance = new Chart('qualityIndexChart', { type: 'line', options: { ...chartOptions('Índice de Qualidade'), plugins: { ...chartOptions().plugins, legend: { display: true, position: 'top' } } } });
        ['extTemp:Temperatura (°C)', 'hum:Umidade (%)', 'pm1:PM1.0 (µg/m³)', 'pm25:PM2.5 (µg/m³)', 'pm10:PM10 (µg/m³)', 'Pres:Pressão (hPa)'].forEach(item => {
            const [key, title] = item.split(':');
            const chartId = key.replace('ext', '').toLowerCase() + 'Chart';
            aggregateCharts[key] = new Chart(chartId, { type: 'line', options: chartOptions(title) });
        });

        document.getElementById('apply-filters-btn').addEventListener('click', () => {
            const selectedIds = getSelectedMonitorData('monitor-filter-container').map(d => d.monitorInfo.id);
            const selectedMetric = document.getElementById('metric-selector').value;
            const metricLabel = document.getElementById('metric-selector').selectedOptions[0].text;
            updateChart(mainChartInstance, selectedIds, selectedMetric, metricLabel);
        });
        document.getElementById('monitor-filter-container').addEventListener('change', () => {
            const selectedIds = getSelectedMonitorData('monitor-filter-container').map(d => d.monitorInfo.id);
            Object.keys(aggregateCharts).forEach(key => updateChart(aggregateCharts[key], selectedIds, key));
        });

        setupExportListeners();
        loadAndProcessData();
    };

    const loadAndProcessData = async () => {
        const monitorsResponse = await apiFetch('/monitor');
        if (!monitorsResponse?.ok) { renderMonitorsTable([]); return; }
        const monitors = await monitorsResponse.json();
        
        renderMonitorsTable(monitors);
        populateFilters('monitor-filter-container', monitors);
        populateFilters('extract-monitor-filter-container', monitors);

        const variableContainer = document.getElementById('extract-variable-filter-container');
        const variables = [
            { key: 'extTemp', label: 'Temp (°C)' }, { key: 'hum', label: 'Umidade (%)' },
            { key: 'pm1', label: 'PM1.0 (µg/m³)' }, { key: 'pm25', label: 'PM2.5 (µg/m³)' },
            { key: 'pm10', label: 'PM10 (µg/m³)' }, { key: 'Pres', label: 'Pressão (hPa)' }
        ];
        variableContainer.innerHTML = '';
        variables.forEach(v => {
            variableContainer.innerHTML += `<label class="checkbox-label"><input type="checkbox" value="${v.key}" data-label="${v.label}" checked> ${v.label}</label>`;
        });

        const results = await Promise.all(monitors.map(m => apiFetch(`/quality_indice_by_monitor/${m.id}`).then(res => res.ok ? res.json() : [])));
        allMonitorsData = monitors.map((m, i) => ({ monitorInfo: m, readings: results[i] || [] }));
        
        // Initial UI population with all data
        updateDashboardCards(allMonitorsData);
        updateMapMarkers(allMonitorsData);
        populateExtractTable();
        document.getElementById('apply-filters-btn').click(); 
        document.getElementById('monitor-filter-container').dispatchEvent(new Event('change'));
    };

    initializeDashboard();
});

