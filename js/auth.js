document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const resetForm = document.getElementById('reset-form');

    const showRegisterLink = document.getElementById('show-register');
    const showResetLink = document.getElementById('show-reset');
    const showLoginFromRegisterLink = document.getElementById('show-login-from-register');
    const showLoginFromResetLink = document.getElementById('show-login-from-reset');

    // Function to switch between forms
    const switchForm = (formToShow) => {
        loginForm.classList.remove('active');
        registerForm.classList.remove('active');
        resetForm.classList.remove('active');
        formToShow.classList.add('active');
    };

    // Event Listeners
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchForm(registerForm);
    });

    showResetLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchForm(resetForm);
    });

    showLoginFromRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchForm(loginForm);
    });

    showLoginFromResetLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchForm(loginForm);
    });
});
