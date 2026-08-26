// ============================================================
//  api.js — Módulo de Comunicación con Google Apps Script
// ============================================================

const GAS_URL = window.ENV_GAS_URL || '/api';

const api = {
    // Clave para localStorage
    SESSION_KEY: 'ovopacific_session',

    setSession(user) {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
    },

    getSession() {
        try {
            const s = localStorage.getItem(this.SESSION_KEY);
            return s ? JSON.parse(s) : null;
        } catch (e) {
            console.error("Error al leer sesión:", e);
            return null;
        }
    },

    logout() {
        localStorage.removeItem(this.SESSION_KEY);
        window.location.reload();
    },

    async get(action, params = {}) {
        let url = `${GAS_URL}?action=${action}`;
        for (let key in params) {
            url += `&${key}=${encodeURIComponent(params[key])}`;
        }
        url += `&t=${Date.now()}`;

        try {
            const res = await fetch(url, {
                method: 'GET',
                mode: 'cors',
                redirect: 'follow'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            return JSON.parse(text);
        } catch (err) {
            throw err;
        }
    },

    async getAllData() {
        return this.get('getAllData');
    },

    async login(usuario, password) {
        const data = await this.get('login', { usuario, password });
        if (data && !data.error) {
            this.setSession(data);
        }
        return data;
    },

    async post(payload) {
        // Adjuntar usuario actual a cualquier envío de datos
        const user = this.getSession();
        if (user && user.usuario) {
            payload.UsuarioSistema = user.usuario;
            payload.UsuarioSistemas = user.usuario;
            payload.quien_registro = user.usuario;
            payload.ejecutor = user.usuario;
        }

        const parseTextSafe = (text) => {
            const trimmed = text.trim();
            if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                throw new Error('Respuesta no es JSON válido del servidor');
            }
            return JSON.parse(trimmed);
        };

        try {
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload),
                redirect: 'follow'
            });
            const text = await res.text();
            const data = parseTextSafe(text);
            if (data.error) throw new Error(data.error);
            return data;
        } catch (err1) {
            try {
                const formData = new FormData();
                formData.append('data', JSON.stringify(payload));
                const res2 = await fetch(GAS_URL, {
                    method: 'POST',
                    body: formData,
                    redirect: 'follow'
                });
                const text2 = await res2.text();
                const data2 = parseTextSafe(text2);
                if (data2.error) throw new Error(data2.error);
                return data2;
            } catch (err2) {
                throw new Error(err1.message || err2.message);
            }
        }
    }
};

window.api = api;
