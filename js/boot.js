// ============================================================
//  boot.js — Control de Pantalla Inicial
// ============================================================

(function () {
    'use strict';

    // Ocultar pantalla de carga inicial por requerimiento explícito del usuario
    const bootScreen = document.getElementById('boot-screen');
    if (bootScreen) {
        bootScreen.style.display = 'none';
        bootScreen.style.opacity = '0';
    }

    // Verificar sesión existente para mostrar login o portal directamente
    const session = window.api ? window.api.getSession() : null;
    const currentUser = session ? session.usuario : null;
    
    if (!currentUser) {
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            loginScreen.style.opacity = '1';
        }
    } else {
        const landing = document.getElementById('landing-portal');
        if (landing) {
            landing.style.display = 'flex';
            landing.style.opacity = '1';
        }
    }
}());
