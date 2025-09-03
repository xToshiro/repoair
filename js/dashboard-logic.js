document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://for-restful-apis-or-backend-services.onrender.com/api';
    let allMonitorsData = [];
    let repoairLogoBase64, tramaLogoBase64;
    
    const VARIABLES = [
        { key: 'extTemp', label: 'Temperatura (°C)' }, { key: 'hum', label: 'Umidade (%)' },
        { key: 'pm1', label: 'PM1.0 (µg/m³)' }, { key: 'pm25', label: 'PM2.5 (µg/m³)' },
        { key: 'pm10', label: 'PM10 (µg/m³)' }, { key: 'Pres', label: 'Pressão (hPa)' }
    ];

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

    const sidebar = document.getElementById('sidebar');
    document.getElementById('sidebar-toggle').addEventListener('click', () => sidebar.classList.toggle('collapsed'));

    const handleNavLinkClick = (e) => {
        e.preventDefault();
        const targetLink = e.currentTarget;
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
        targetLink.classList.add('active');
        document.getElementById(targetLink.getAttribute('href').substring(1)).classList.add('active');
        if (targetLink.getAttribute('href') !== '#monitors' && targetLink.getAttribute('href') !== '#extract-data' && targetLink.getAttribute('href') !== '#users') {
            window.dispatchEvent(new Event('resize'));
        }
    };
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => link.addEventListener('click', handleNavLinkClick));
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

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

    const getSelectedMonitorIds = (containerId) => {
        return [...document.querySelectorAll(`#${containerId} input:checked`)].map(cb => cb.value);
    };

    const populateFilters = (containerId, monitors) => {
        const container = document.getElementById(containerId);
        container.innerHTML = monitors.length ? '' : '<p>Nenhum monitor encontrado.</p>';
        monitors.forEach(m => {
            container.innerHTML += `<label class="checkbox-label"><input type="checkbox" value="${m.id}" checked> ${m.monitor_id}</label>`;
        });
    };
    
    const populateMonitorSelect = (selectId, monitors) => {
        const select = document.getElementById(selectId);
        select.innerHTML = '';
        monitors.forEach(m => {
            select.innerHTML += `<option value="${m.id}">${m.monitor_id}</option>`;
        });
    };

    const populateSelectWithOptions = (selectId, options) => {
        const select = document.getElementById(selectId);
        select.innerHTML = '';
        options.forEach(opt => {
            select.innerHTML += `<option value="${opt.key}">${opt.label}</option>`;
        });
    };

    let map = null, mapMarkers = L.layerGroup(), heatmapLayer = null;
    const initMap = () => {
        if (map) return;
        map = L.map('map', { preferCanvas: true }).setView([-3.74, -38.53], 12);
        const updateTiles = () => {
            const light = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            const dark = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            const tileUrl = document.body.classList.contains('dark-theme') ? dark : light;
            if (map.tileLayer) map.removeLayer(map.tileLayer);
            map.tileLayer = L.tileLayer(tileUrl, { attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(map);
        };
        updateTiles();
        mapMarkers.addTo(map);
        heatmapLayer = L.heatLayer([], { radius: 25, blur: 15, maxZoom: 12 });
        desktopSidebar.querySelector('.theme-btn').addEventListener('click', () => setTimeout(updateTiles, 100));
        
        document.querySelectorAll('input[name="map-layer"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if(e.currentTarget.value === 'heatmap') {
                    map.removeLayer(mapMarkers);
                    map.addLayer(heatmapLayer);
                } else {
                    map.removeLayer(heatmapLayer);
                    map.addLayer(mapMarkers);
                }
            });
        });
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

    const updateHeatmap = (data, metricKey) => {
        const heatData = [];
        data.forEach(item => {
            const latest = item.readings.length > 0 ? item.readings.slice(-1)[0].json_file : null;
            if (latest && latest[metricKey] !== undefined) {
                 const lat = parseFloat(item.monitorInfo.latitude), lon = parseFloat(item.monitorInfo.longitude);
                 if(!isNaN(lat) && !isNaN(lon)) {
                     heatData.push([lat, lon, latest[metricKey]]);
                 }
            }
        });
        heatmapLayer.setLatLngs(heatData);
    };

    const getPlotlyLayout = (title) => {
        const isDark = document.body.classList.contains('dark-theme');
        return {
            title: title,
            font: { color: isDark ? '#e0e0e0' : '#333333' },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            xaxis: { gridcolor: isDark ? '#444' : '#ddd' },
            yaxis: { gridcolor: isDark ? '#444' : '#ddd' },
            legend: { orientation: 'h', y: -0.2 }
        };
    };

    const stats = {
        mean: arr => arr.reduce((a, b) => a + b, 0) / arr.length,
        median: arr => {
            const mid = Math.floor(arr.length / 2), nums = [...arr].sort((a, b) => a - b);
            return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
        },
        stdDev: arr => {
            const mean = stats.mean(arr);
            return Math.sqrt(arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / arr.length);
        },
        max: arr => Math.max(...arr),
        min: arr => Math.min(...arr)
    };
    
    const runBIAnalysis = () => {
        const selectedIds = getSelectedMonitorIds('overview-monitor-filter-container');
        const metric = document.getElementById('bi-metric-selector').value;
        const stat = document.getElementById('bi-stat-selector').value;
        
        const results = [];
        const filteredMonitors = allMonitorsData.filter(d => selectedIds.includes(d.monitorInfo.id));
        
        filteredMonitors.forEach(monitorData => {
            if (monitorData.readings.length > 0) {
                const values = monitorData.readings.map(r => r.json_file[metric]).filter(v => v !== undefined && v !== null);
                if (values.length > 0) {
                    results.push({
                        monitor: monitorData.monitorInfo.monitor_id,
                        value: stats[stat](values)
                    });
                }
            }
        });
        
        const data = [{
            x: results.map(r => r.monitor),
            y: results.map(r => r.value),
            type: 'bar',
            marker: { color: document.body.classList.contains('dark-theme') ? '#48D1CC' : '#00A86B' }
        }];
        const metricLabel = VARIABLES.find(v => v.key === metric).label;
        const statLabel = document.getElementById('bi-stat-selector').selectedOptions[0].text;
        Plotly.newPlot('bi-chart', data, getPlotlyLayout(`${statLabel} de ${metricLabel}`), {responsive: true});
        updateHeatmap(filteredMonitors, metric);
    };
    
    const runTimeSeriesDecomposition = () => {
        const chartDiv = document.getElementById('timeseries-decomposition-chart');
        const monitorId = document.getElementById('temporal-monitor-selector').value;
        const metricKey = document.getElementById('temporal-metric-selector').value;

        const monitorData = allMonitorsData.find(d => d.monitorInfo.id === monitorId);
        if (!monitorData || monitorData.readings.length < 24) {
            Plotly.purge(chartDiv);
            chartDiv.innerHTML = `<p class="chart-placeholder-text">Dados insuficientes para gerar a série temporal (necessário min. 24h de dados).</p>`;
            return;
        }

        const series = monitorData.readings
            .map(r => ({ x: new Date(r.json_file.Timestamp), y: r.json_file[metricKey] }))
            .filter(d => d.y !== undefined && d.y !== null)
            .sort((a, b) => a.x - b.x);

        if (series.length < 24) {
            Plotly.purge(chartDiv);
            chartDiv.innerHTML = `<p class="chart-placeholder-text">Dados insuficientes para gerar a série temporal (necessário min. 24h de dados).</p>`;
            return;
        }
        
        chartDiv.innerHTML = ''; 

        const x = series.map(d => d.x);
        const y = series.map(d => d.y);

        const movingAverage = (data, windowSize) => {
            let result = [];
            for (let i = 0; i < data.length; i++) {
                if (i < windowSize - 1) {
                    result.push(null);
                } else {
                    let sum = 0;
                    for (let j = 0; j < windowSize; j++) {
                        sum += data[i - j];
                    }
                    result.push(sum / windowSize);
                }
            }
            return result;
        };
        
        const trend = movingAverage(y, 24);
        const originalTrace = { x, y, mode: 'lines', name: 'Original', line: { color: document.body.classList.contains('dark-theme') ? '#48D1CC' : '#00A86B', width: 1 } };
        const trendTrace = { x, y: trend, mode: 'lines', name: 'Tendência (Média Móvel 24h)', line: { color: '#FF6384', width: 2 } };
        
        const metricLabel = VARIABLES.find(v => v.key === metricKey).label;
        const layout = getPlotlyLayout(`Série Temporal e Tendência para ${metricLabel}`);
        Plotly.newPlot(chartDiv, [originalTrace, trendTrace], layout, {responsive: true});
    };

    const runCyclePlot = () => {
        const monitorId = document.getElementById('temporal-monitor-selector').value;
        const metricKey = document.getElementById('temporal-metric-selector').value;
        const period = document.getElementById('cycle-plot-period').value;

        const monitorData = allMonitorsData.find(d => d.monitorInfo.id === monitorId);
        if (!monitorData) return;

        const groupedData = {};
        monitorData.readings.forEach(r => {
            const value = r.json_file[metricKey];
            if (value === undefined || value === null) return;
            const date = new Date(r.json_file.Timestamp);
            let key = (period === 'hour') ? date.getHours() : date.getDay();
            if (!groupedData[key]) groupedData[key] = [];
            groupedData[key].push(value);
        });

        const cycleLabels = period === 'hour' 
            ? [...Array(24).keys()]
            : [0, 1, 2, 3, 4, 5, 6];
        const displayLabels = period === 'hour'
            ? cycleLabels.map(String)
            : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        const y = cycleLabels.map(key => groupedData[key] ? stats.mean(groupedData[key]) : 0);

        const data = [{ 
            x: displayLabels, 
            y, 
            type: 'scatter',
            mode: 'lines+markers',
            line: { 
                color: document.body.classList.contains('dark-theme') ? '#48D1CC' : '#00A86B',
                shape: 'spline' 
            }
        }];
        
        const metricLabel = VARIABLES.find(v => v.key === metricKey).label;
        const periodLabel = period === 'hour' ? "Hora do Dia" : "Dia da Semana";
        const layout = getPlotlyLayout(`Média de ${metricLabel} por ${periodLabel}`);
        Plotly.newPlot('cycle-plot-chart', data, layout, {responsive: true});
    };

    const runHistogram = () => {
        const monitorId = document.getElementById('dist-monitor-selector').value;
        const metricKey = document.getElementById('dist-metric-selector').value;

        const monitorData = allMonitorsData.find(d => d.monitorInfo.id === monitorId);
        if (!monitorData) return;
        
        const values = monitorData.readings.map(r => r.json_file[metricKey]).filter(v => v !== undefined && v !== null);

        const data = [{ x: values, type: 'histogram', marker: { color: document.body.classList.contains('dark-theme') ? '#48D1CC' : '#00A86B' } }];

        const metricLabel = VARIABLES.find(v => v.key === metricKey).label;
        const monitorLabel = monitorData.monitorInfo.monitor_id;
        const layout = getPlotlyLayout(`Distribuição de ${metricLabel} (${monitorLabel})`);
        Plotly.newPlot('histogram-chart', data, layout, {responsive: true});
    };

    const runBoxPlot = () => {
        const selectedIds = getSelectedMonitorIds('dist-monitor-filter-container');
        const metricKey = document.getElementById('dist-metric-selector').value;
        
        const data = [];
        selectedIds.forEach(id => {
            const monitorData = allMonitorsData.find(d => d.monitorInfo.id === id);
            if (monitorData) {
                const values = monitorData.readings.map(r => r.json_file[metricKey]).filter(v => v !== undefined && v !== null);
                if (values.length > 0) {
                    data.push({ 
                        y: values, 
                        type: 'violin',
                        name: monitorData.monitorInfo.monitor_id,
                        box: { visible: true },
                        meanline: { visible: true },
                        points: 'none'
                    });
                }
            }
        });

        const metricLabel = VARIABLES.find(v => v.key === metricKey).label;
        const layout = getPlotlyLayout(`Violin Plot de ${metricLabel} por Monitor`);
        Plotly.newPlot('box-plot-chart', data, layout, {responsive: true});
    };

    const runCorrelationAnalysis = () => {
        const selectedIds = getSelectedMonitorIds('analysis-monitor-filter-container');
        const varXKey = document.getElementById('corr-var-x').value;
        const varYKey = document.getElementById('corr-var-y').value;

        let dataPoints = [];
        selectedIds.forEach(id => {
            const monitorData = allMonitorsData.find(d => d.monitorInfo.id === id);
            if (monitorData) {
                monitorData.readings.forEach(r => {
                    if (r.json_file[varXKey] !== undefined && r.json_file[varYKey] !== undefined) {
                        dataPoints.push({ x: r.json_file[varXKey], y: r.json_file[varYKey] });
                    }
                });
            }
        });
        
        if (dataPoints.length < 2) {
             document.getElementById('correlation-result-text').textContent = 'Dados insuficientes para correlação.';
             Plotly.purge('correlation-chart');
             return;
        }

        const xValues = dataPoints.map(p => p.x);
        const yValues = dataPoints.map(p => p.y);
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.map((x, i) => x * yValues[i]).reduce((a, b) => a + b, 0);
        const sumX2 = xValues.map(x => x * x).reduce((a, b) => a + b, 0);
        const sumY2 = yValues.map(y => y * y).reduce((a, b) => a + b, 0);
        const n = xValues.length;
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const correlation = denominator === 0 ? 0 : numerator / denominator;
        
        document.getElementById('correlation-result-text').textContent = `Coeficiente de Correlação (Pearson): ${correlation.toFixed(4)}`;

        const trace = { x: xValues, y: yValues, mode: 'markers', type: 'scatter', marker: { color: document.body.classList.contains('dark-theme') ? '#48D1CC' : '#00A86B', size: 5 } };
        const layout = getPlotlyLayout(`Correlação entre ${varXKey} e ${varYKey}`);
        layout.xaxis.title = VARIABLES.find(v => v.key === varXKey).label;
        layout.yaxis.title = VARIABLES.find(v => v.key === varYKey).label;
        Plotly.newPlot('correlation-chart', [trace], layout, {responsive: true});
    };
    
    const run3DPlot = () => {
        const selectedIds = getSelectedMonitorIds('analysis-monitor-filter-container');
        const varXKey = document.getElementById('3d-var-x').value;
        const varYKey = document.getElementById('3d-var-y').value;
        const varZKey = document.getElementById('3d-var-z').value;

        let plotData = { x: [], y: [], z: [], monitor: [] };
        selectedIds.forEach(id => {
            const monitorData = allMonitorsData.find(d => d.monitorInfo.id === id);
            if (monitorData) {
                monitorData.readings.forEach(r => {
                    if (r.json_file[varXKey] !== undefined && r.json_file[varYKey] !== undefined && r.json_file[varZKey] !== undefined) {
                        plotData.x.push(r.json_file[varXKey]);
                        plotData.y.push(r.json_file[varYKey]);
                        plotData.z.push(r.json_file[varZKey]);
                        plotData.monitor.push(monitorData.monitorInfo.monitor_id);
                    }
                });
            }
        });

        if (plotData.x.length === 0) { Plotly.purge('plot-3d'); return; }

        const trace = { x: plotData.x, y: plotData.y, z: plotData.z, mode: 'markers', type: 'scatter3d', text: plotData.monitor, marker: { color: plotData.z, colorscale: 'Viridis', size: 5, colorbar: { title: VARIABLES.find(v => v.key === varZKey).label } } };
        const layout = getPlotlyLayout(`Visualização 3D`);
        layout.scene = {
            xaxis: { title: VARIABLES.find(v => v.key === varXKey).label },
            yaxis: { title: VARIABLES.find(v => v.key === varYKey).label },
            zaxis: { title: VARIABLES.find(v => v.key === varZKey).label }
        };
        Plotly.newPlot('plot-3d', [trace], layout, {responsive: true});
    };

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

    const imageToBase64 = (imgElement) => new Promise((resolve, reject) => {
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
    
    const loadLogosForPdf = async () => {
        try {
            [repoairLogoBase64, tramaLogoBase64] = await Promise.all([
                imageToBase64(document.getElementById('repoair-logo-pdf')),
                imageToBase64(document.getElementById('trama-logo-pdf'))
            ]);
        } catch (error) { console.error("PDF logo loading failed.", error); }
    };

    const setupExportListeners = () => {
        const getFilteredDataForExport = () => {
            const selectedMonitors = allMonitorsData.filter(d => getSelectedMonitorIds('extract-monitor-filter-container').includes(d.monitorInfo.id));
            const selectedVariables = [...document.querySelectorAll('#extract-variable-filter-container input:checked')].map(cb => ({ key: cb.value, label: cb.dataset.label }));
            
            const flatData = [];
            selectedMonitors.forEach(monitorData => {
                monitorData.readings.forEach(reading => {
                    const row = { 'Monitor ID': monitorData.monitorInfo.monitor_id, 'Timestamp': reading.json_file.Timestamp };
                    selectedVariables.forEach(v => { row[v.label] = reading.json_file[v.key]; });
                    flatData.push(row);
                });
            });
            const sortedData = flatData.sort((a,b) => new Date(a.Timestamp) - new Date(b.Timestamp));

            if (sortedData.length === 0) {
                alert('Nenhum dado para exportar com os filtros selecionados.');
                return null;
            }
            return sortedData;
        };

        document.getElementById('refresh-extract-table-btn').addEventListener('click', () => {
            const container = document.getElementById('data-extract-table-container');
            const data = getFilteredDataForExport();
             if (!data) {
                container.innerHTML = '<p class="list-placeholder">Nenhum dado para exibir com os filtros selecionados.</p>';
                return;
            }
            const headers = Object.keys(data[0]);
            const table = document.createElement('table');
            table.className = 'data-table';
            table.innerHTML = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody></tbody>`;
            const tbody = table.querySelector('tbody');
            data.forEach(row => {
                const tr = tbody.insertRow();
                headers.forEach(header => tr.insertCell().textContent = row[header] !== undefined ? row[header] : 'N/A');
            });
            container.innerHTML = '';
            container.appendChild(table);
        });
        
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
            if(repoairLogoBase64) doc.addImage(repoairLogoBase64, 'PNG', 14, 10, 50, 22);
            if(tramaLogoBase64) doc.addImage(tramaLogoBase64, 'PNG', doc.internal.pageSize.getWidth() - 54, 10, 40, 17);
            doc.setFontSize(10).text("Laboratório de Transportes e Meio Ambiente (TRAMA) - UFC", doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
            doc.setFontSize(16).text("Relatório de Dados - Plataforma RepoAir", doc.internal.pageSize.getWidth() / 2, 50, { align: 'center' });
            doc.setFontSize(10).text(`Gerado em: ${new Date().toLocaleString()}`, doc.internal.pageSize.getWidth() / 2, 56, { align: 'center' });
            doc.autoTable({
                startY: 70, head: [Object.keys(data[0])], body: data.map(row => Object.values(row)),
                theme: 'striped', headStyles: { fillColor: [0, 168, 107] }
            });
            doc.save('repoair_report.pdf');
        });
    };

    const initializeDashboard = () => {
        loadLogosForPdf();
        initMap();

        populateSelectWithOptions('bi-metric-selector', VARIABLES);
        ['corr-var-x', 'corr-var-y', '3d-var-x', '3d-var-y', '3d-var-z', 'temporal-metric-selector', 'dist-metric-selector'].forEach(id => populateSelectWithOptions(id, VARIABLES));

        document.getElementById('run-bi-analysis').addEventListener('click', runBIAnalysis);
        document.getElementById('bi-metric-selector').addEventListener('change', runBIAnalysis);
        document.getElementById('overview-monitor-filter-container').addEventListener('change', runBIAnalysis);
        document.getElementById('run-correlation').addEventListener('click', runCorrelationAnalysis);
        document.getElementById('run-3d-plot').addEventListener('click', run3DPlot);
        document.getElementById('run-cycle-plot').addEventListener('click', runCyclePlot);
        document.getElementById('temporal-monitor-selector').addEventListener('change', () => { runTimeSeriesDecomposition(); runCyclePlot(); });
        document.getElementById('temporal-metric-selector').addEventListener('change', () => { runTimeSeriesDecomposition(); runCyclePlot(); });
        document.getElementById('run-histogram').addEventListener('click', runHistogram);
        document.getElementById('run-boxplot').addEventListener('click', runBoxPlot);
        
        setupExportListeners();
        loadAndProcessData();
    };

    const loadAndProcessData = async () => {
        const monitorsResponse = await apiFetch('/monitor');
        if (!monitorsResponse?.ok) { renderMonitorsTable([]); return; }
        const monitors = await monitorsResponse.json();
        
        renderMonitorsTable(monitors);
        ['overview-monitor-filter-container', 'analysis-monitor-filter-container', 'extract-monitor-filter-container', 'dist-monitor-filter-container'].forEach(id => populateFilters(id, monitors));
        ['temporal-monitor-selector', 'dist-monitor-selector'].forEach(id => populateMonitorSelect(id, monitors));
        
        const variableContainer = document.getElementById('extract-variable-filter-container');
        variableContainer.innerHTML = '';
        VARIABLES.forEach(v => {
            variableContainer.innerHTML += `<label class="checkbox-label"><input type="checkbox" value="${v.key}" data-label="${v.label}" checked> ${v.label}</label>`;
        });

        const results = await Promise.all(monitors.map(m => apiFetch(`/quality_indice_by_monitor/${m.id}`).then(res => res.ok ? res.json() : [])));
        allMonitorsData = monitors.map((m, i) => ({ monitorInfo: m, readings: results[i] || [] }));
        
        updateMapMarkers(allMonitorsData);
        document.getElementById('refresh-extract-table-btn').click();
        
        runBIAnalysis();
        runTimeSeriesDecomposition();
        runCyclePlot();
        runHistogram();
        runBoxPlot();
    };

    initializeDashboard();
});

