/* ────────────────────────────────────────────
   AUTHENTICATION FORMS & ONBOARDING LIFE-CYCLE
──────────────────────────────────────────── */
function initAuthForms() {
    const loginBtn = document.getElementById('btnLogin');
    const loginErr = document.getElementById('loginErrorMsg');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            
            if (loginErr) loginErr.style.display = 'none';

            if (!email || !password) {
                if (loginErr) { loginErr.textContent = 'Please enter username/email and password.'; loginErr.style.display = 'block'; }
                return showToast('Please enter username/email and password.', 'error');
            }
            
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AUTHENTICATING...';
            
            try {
                const res = await Api.login(email, password);
                if (res.token) {
                    showToast('Explorer session authenticated!', 'success');
                    
                    const status = await Api.getDatabaseStatus();
                    
                    const lockOverlay = document.getElementById('appLockOverlay');
                    if (lockOverlay) {
                        gsap.to(lockOverlay, { opacity: 0, duration: 0.5, onComplete: () => {
                            lockOverlay.style.display = 'none';
                        }});
                    }

                    if (status.configured) {
                        bootstrapApp();
                    } else {
                        initDbSetup();
                    }
                } else {
                    throw new Error("Authentication failed");
                }
            } catch (err) {
                const msg = err.message || 'Login failed.';
                if (loginErr) { loginErr.textContent = msg; loginErr.style.display = 'block'; }
                showToast(msg, 'error');
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> SIGN IN';
            }
        });
    }

    const registerBtn = document.getElementById('btnRegister');
    const regErr = document.getElementById('regErrorMsg');
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            
            if (regErr) regErr.style.display = 'none';

            if (!username || !email || !password) {
                if (regErr) { regErr.textContent = 'Please fill all registration fields.'; regErr.style.display = 'block'; }
                return showToast('Please fill all registration fields.', 'error');
            }
            
            registerBtn.disabled = true;
            registerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ESTABLISHING PROFILE...';
            
            try {
                const res = await Api.register(username, email, password);
                if (res.token) {
                    showToast('Profile established successfully!', 'success');
                    
                    const status = await Api.getDatabaseStatus();
                    
                    const lockOverlay = document.getElementById('appLockOverlay');
                    if (lockOverlay) {
                        gsap.to(lockOverlay, { opacity: 0, duration: 0.5, onComplete: () => {
                            lockOverlay.style.display = 'none';
                        }});
                    }

                    if (status.configured) {
                        bootstrapApp();
                    } else {
                        initDbSetup();
                    }
                } else {
                    throw new Error("Registration failed to return token");
                }
            } catch (err) {
                const msg = err.message || 'Registration failed.';
                if (regErr) { regErr.textContent = msg; regErr.style.display = 'block'; }
                showToast(msg, 'error');
                registerBtn.disabled = false;
                registerBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> SIGN UP';
            }
        });
    }
}

window.toggleAuth = function(e) {
    if (e) e.preventDefault();
    const login = document.getElementById('loginForm');
    const register = document.getElementById('registerForm');
    const title = document.querySelector('#authCard h2');
    const subtitle = document.querySelector('#authCard .sub-text');
    
    if (login.style.display === 'none') {
        gsap.to(register, { opacity: 0, y: 10, duration: 0.3, onComplete: () => {
            register.style.display = 'none';
            login.style.display = 'block';
            if (title) title.textContent = "COGNITIVE SIGN IN";
            if (subtitle) subtitle.textContent = "Authenticate your explorer profile to boot workspace cores.";
            gsap.fromTo(login, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 });
        }});
    } else {
        gsap.to(login, { opacity: 0, y: 10, duration: 0.3, onComplete: () => {
            login.style.display = 'none';
            register.style.display = 'block';
            if (title) title.textContent = "ESTABLISH PROFILE";
            if (subtitle) subtitle.textContent = "Create an explorer identity to initialize the system.";
            gsap.fromTo(register, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 });
        }});
    }
};


