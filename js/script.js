document.addEventListener('DOMContentLoaded', () => {

    // --- Language Switcher Logic ---
    const langButtons = document.querySelectorAll('.lang-switcher button');
    const translatableElements = document.querySelectorAll('[data-lang-pt]');

    const setLanguage = (lang) => {
        translatableElements.forEach(el => {
            el.innerText = el.getAttribute(`data-lang-${lang}`);
        });
        
        // Update active button state
        langButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
        });

        // Save preference
        localStorage.setItem('language', lang);
    };

    langButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selectedLang = button.getAttribute('data-lang');
            setLanguage(selectedLang);
        });
    });

    // Load saved language or default to 'pt'
    const savedLang = localStorage.getItem('language') || 'pt';
    setLanguage(savedLang);


    // --- Theme Switcher Logic ---
    const themeSwitcher = document.getElementById('theme-switcher');
    const body = document.body;

    const applyTheme = (theme) => {
        body.classList.toggle('dark-theme', theme === 'dark-theme');
    };

    const savedTheme = localStorage.getItem('theme') || 'light-theme';
    applyTheme(savedTheme);

    themeSwitcher.addEventListener('click', () => {
        const isDark = body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark-theme' : 'light-theme');

        // IMPROVEMENT: Update particle color on theme change
        if (window.pJSDom && window.pJSDom[0]) {
            const newColor = isDark ? "#48D1CC" : "#00A86B";
            window.pJSDom[0].pJS.particles.color.value = newColor;
            window.pJSDom[0].pJS.fn.particlesRefresh();
        }
    });


    // --- Mobile Menu Logic ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mainNav = document.querySelector('.main-nav');

    mobileMenuBtn.addEventListener('click', () => {
        mainNav.classList.toggle('active');
    });


    // --- Particles.js Configuration ---
    particlesJS('particles-js', {
        "particles": {
            "number": {
                "value": 80,
                "density": {
                    "enable": true,
                    "value_area": 800
                }
            },
            "color": {
                "value": body.classList.contains('dark-theme') ? "#48D1CC" : "#00A86B"
            },
            "shape": {
                "type": "circle",
            },
            "opacity": {
                "value": 0.5,
                "random": true,
            },
            "size": {
                "value": 3,
                "random": true,
            },
            "line_linked": {
                "enable": true,
                "distance": 150,
                "color": "#808080",
                "opacity": 0.4,
                "width": 1
            },
            "move": {
                "enable": true,
                "speed": 1.5,
                "direction": "none",
                "random": true,
                "straight": false,
                "out_mode": "out",
                "bounce": false,
            }
        },
        "interactivity": {
            "detect_on": "canvas",
            "events": {
                "onhover": {
                    "enable": true,
                    "mode": "repulse"
                },
                "onclick": {
                    "enable": false,
                },
                "resize": true
            }
        },
        "retina_detect": true
    });

});
