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

        // Reset message and show loading state
        authMessage.textContent = '';
        authMessage.className = 'auth-message';
        submitButton.disabled = true;
        submitButton.textContent = 'Entrando...';

        try {
            const response = await fetch('https://for-restful-apis-or-backend-services.onrender.com/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const data = await response.json();
                authMessage.textContent = 'Login bem-sucedido!';
                authMessage.classList.add('success');
                
                // Store the token for future requests
                sessionStorage.setItem('authToken', data.token);

                // Redirect to the main dashboard after a short delay
                setTimeout(() => {
                    // We will create this page in the next step
                    // window.location.href = 'main-dashboard.html'; 
                }, 1500);

            } else {
                authMessage.textContent = 'Credenciais inválidas. Tente novamente.';
                authMessage.classList.add('error');
            }

        } catch (error) {
            console.error('Login error:', error);
            authMessage.textContent = 'Erro de conexão. Verifique sua internet.';
            authMessage.classList.add('error');
        } finally {
            // Restore button state
            submitButton.disabled = false;
            submitButton.textContent = 'Entrar';
        }
    });
});
