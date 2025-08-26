document.addEventListener('DOMContentLoaded', () => {
    // --- Form Switching Logic ---
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const resetForm = document.getElementById('reset-form');

    const showRegisterLink = document.getElementById('show-register');
    const showResetLink = document.getElementById('show-reset');
    const showLoginFromRegisterLink = document.getElementById('show-login-from-register');
    const showLoginFromResetLink = document.getElementById('show-login-from-reset');

    const switchForm = (formToShow) => {
        loginForm.classList.remove('active');
        registerForm.classList.remove('active');
        resetForm.classList.remove('active');
        formToShow.classList.add('active');
    };

    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); switchForm(registerForm); });
    showResetLink.addEventListener('click', (e) => { e.preventDefault(); switchForm(resetForm); });
    showLoginFromRegisterLink.addEventListener('click', (e) => { e.preventDefault(); switchForm(loginForm); });
    showLoginFromResetLink.addEventListener('click', (e) => { e.preventDefault(); switchForm(loginForm); });

    // --- API Login Logic ---
    const loginFormElement = document.getElementById('login-form-element');
    const authMessage = document.getElementById('auth-message');

    loginFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitButton = loginFormElement.querySelector('.auth-btn');
        const currentLang = localStorage.getItem('language') || 'pt';

        // Reset message and show loading state
        authMessage.textContent = '';
        authMessage.className = 'auth-message';
        submitButton.disabled = true;
        submitButton.textContent = currentLang === 'pt' ? 'Entrando...' : 'Signing in...';

        try {
            const response = await fetch('https://for-restful-apis-or-backend-services.onrender.com/api/login', {
                method: 'POST',
                mode: 'cors', // Explicitly set mode for cross-origin requests
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) { // Status 200-299
                const data = await response.json();
                authMessage.textContent = currentLang === 'pt' ? 'Login bem-sucedido!' : 'Login successful!';
                authMessage.classList.add('success');
                
                // Store the token for future requests
                sessionStorage.setItem('authToken', data.token);

                // Redirect to the main dashboard after a short delay
                setTimeout(() => {
                    window.location.href = 'main-dashboard.html'; 
                }, 1500);

            } else {
                // Handle specific HTTP errors
                if (response.status === 401) { // Unauthorized
                    authMessage.textContent = currentLang === 'pt' ? 'Credenciais inválidas. Tente novamente.' : 'Invalid credentials. Please try again.';
                } else {
                    authMessage.textContent = `${currentLang === 'pt' ? 'Erro no servidor' : 'Server error'}: ${response.status}`;
                }
                authMessage.classList.add('error');
            }

        } catch (error) {
            // This error is often a CORS issue or a network failure.
            // CORS must be configured on the server (onrender.com) to allow requests from your website's domain.
            console.error('Login error:', error);
            authMessage.textContent = currentLang === 'pt' ? 'Erro de conexão. Verifique a internet ou as permissões da API (CORS).' : 'Connection error. Check your internet or API permissions (CORS).';
            authMessage.classList.add('error');
        } finally {
            // Restore button state with correct language
            const buttonText = submitButton.getAttribute(`data-lang-${currentLang}`);
            submitButton.disabled = false;
            submitButton.textContent = buttonText;
        }
    });
});
