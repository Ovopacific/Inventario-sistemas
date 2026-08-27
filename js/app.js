    // ── AUTENTICACIÓN ──
    inicializarLogin() {
        const form = document.getElementById('login-form');
        const btn = document.getElementById('login-submit-btn');
        const errorMsg = document.getElementById('login-error-msg');
        
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('login-user').value.trim();
            const pass = document.getElementById('login-pass').value.trim();
            
            if (!user || !pass) return;

            btn.disabled = true;
            btn.textContent = 'Verificando...';
            errorMsg.textContent = '';

            try {
                const res = await api.login(user, pass);
                if (res && (res.success || (!res.error && (res.usuario || res.Nombre)))) {
                    this.actualizarUIUsuario(res);
                    this.checkPermissions();
                    
                    // Ocultar login y mostrar portal inmediatamente sin retrasos
                    const loginScreen = document.getElementById('login-screen');
                    if (loginScreen) {
                        loginScreen.style.opacity = '0';
                        loginScreen.style.display = 'none';
                    }
                    const landing = document.getElementById('landing-portal');
                    if (landing) {
                        landing.style.display = 'flex';
                        landing.style.opacity = '1';
                        if (window.initPortalParticles) window.initPortalParticles();
                    }

                    this.cargarTodosLosDatos();
                } else if (res && res.error) {
                    errorMsg.textContent = res.error;
                } else {
                    errorMsg.textContent = 'Usuario o contraseña incorrectos';
                }
            } catch (err) {
                console.error('[LOGIN] Error:', err);
                errorMsg.textContent = err.message || 'Error de conexión';
            } finally {
                btn.disabled = false;
                btn.textContent = 'Entrar';
            }
        });
    },
