document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication Guard ---
    // If no token is found, redirect to login page
    if (!sessionStorage.getItem('authToken')) {
        window.location.href = 'dashboard.html';
        return; // Stop script execution
    }

    // --- Sidebar Navigation Logic ---
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.dashboard-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links and sections
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            // Add active class to the clicked link
            link.classList.add('active');

            // Show the corresponding section
            const targetId = link.getAttribute('href').substring(1);
            document.getElementById(targetId).classList.add('active');
        });
    });

    // --- Logout Logic ---
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('authToken');
        window.location.href = 'dashboard.html';
    });
    
    // --- Example Chart.js ---
    // This is just an example to show how a chart would look.
    // We will replace this with real API data later.
    const ctx = document.getElementById('qualityIndexChart').getContext('2d');
    const qualityIndexChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
            datasets: [{
                label: 'Índice de Qualidade do Ar (IQA)',
                data: [40, 45, 38, 52, 60, 55, 50],
                backgroundColor: 'rgba(0, 168, 107, 0.2)',
                borderColor: 'rgba(0, 168, 107, 1)',
                borderWidth: 2,
                tension: 0.4
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });

});
