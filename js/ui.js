// ============================================================
//  ui.js — Manejo de la Interfaz de Usuario (UI) y Vistas
// ============================================================

const ui = {
    toggleAllChecks(masterId, childClass) {
        const checked = document.getElementById(masterId).checked;
        document.querySelectorAll(childClass).forEach(ch => ch.checked = checked);
    },

    // ── Elementos DOM cacheados ──
    els: {
        getConnectionStatus: () => document.getElementById('connection-status'),
        getProductosTbody: () => document.getElementById('productos-tbody'),
        getInventarioTbody: () => document.getElementById('inventario-tbody'),
        getEntradasTbody: () => document.getElementById('entradas-tbody'),
        getSalidasTbody: () => document.getElementById('salidas-tbody'),
        getEntregasTbody: () => document.getElementById('entregas-tbody'),
        getInicioInventarioTbody: () => document.getElementById('inicio-inventario-tbody'),
        getTareasRecurrentesTbody: () => document.getElementById('tareas-recurrentes-tbody'),
        getMantCategoriasContainer: () => document.getElementById('mant-categorias-container'),
        getMantSemanalContainer: () => document.getElementById('mant-semanal-container'),
        getMantPreventivoTable: () => ({ thead: document.getElementById('thead-preventivo'), tbody: document.getElementById('tbody-preventivo') }),
        getBitacoraGrid: () => document.getElementById('bitacora-grid'),
        getSummaryGrid: () => document.getElementById('summary-grid'),
        getResponsablesTbody: () => document.getElementById('tbody-responsables'),
    },

    /**
     * Actualiza el indicador de estado de conexión en el sidebar.
     * @param {string} estado - 'ok', 'error' o 'connecting'
     */
    setConexionStatus(estado) {
        const el = this.els.getConnectionStatus();
        if (!el) return;
        const dot = el.querySelector('.dot');
        const text = el.querySelector('span:last-child');
        
        dot.className = 'dot ' + (estado === 'ok' ? 'dot-success' : estado === 'error' ? 'dot-danger' : 'dot-warning');
        text.textContent = estado === 'ok' ? 'Conectado' : estado === 'error' ? 'Sin conexión' : 'Conectando...';
    },

    actualizarMiniStats(productos) {
        const total = productos.length;
        const bajoStock = productos.filter(p => Number(p.Cantidad) <= 5).length;
        const cats = new Set(productos.map(p => p.Categoria)).size;

        utils.animateNumber('stat-total', total);
        utils.animateNumber('stat-bajo-stock', bajoStock);
        utils.animateNumber('stat-categorias', cats);
    },

    actualizarMiniStatsTareas(state) {
        const session = api.getSession() || {};
        const isAdminStrict = session.rol === 'admin';
        const isSupervisor = session.rol === 'supervisor';
        const isVisualizer = session.rol === 'visualizador';

        // Determinar qué usuario está seleccionado según la vista activa
        const vista = state.vistaActual || '';
        let modulo = '';
        if (vista.startsWith('tareas-')) {
            modulo = vista.replace('tareas-', '');
        } else if (vista === 'usuarios') {
            modulo = 'responsables';
        }
        
        let selectedUsr = '';
        if (modulo) {
            selectedUsr = (state[`selectedUser_${modulo}`] || '').toLowerCase().trim();
        }

        // Si no es admin y no hay selección específica, el usuario se ve a sí mismo
        if (!isAdminStrict && !isSupervisor && !isVisualizer && selectedUsr === '') {
            selectedUsr = (session.usuario || '').toLowerCase().trim();
        }

        const filtrarPorUsuario = (arr) => {
            if (selectedUsr === '') {
                if (isSupervisor) {
                    const targetTechs = ['yolfranlle', 'danny'];
                    return arr.filter(t => {
                        const tUsr = (t.UsuarioSistema || t.usuariosistema || t.Usuario || t.usuario || t.UsuarioId || '').toLowerCase().trim();
                        const tNom = (t.Nombre || t.nombre || '').toLowerCase().trim();
                        return targetTechs.some(tech => tUsr.includes(tech) || tNom.includes(tech));
                    });
                }
                return arr;
            }
            return arr.filter(t => {
                const tUsr = (t.UsuarioSistema || t.usuariosistema || t.Usuario || t.usuario || t.UsuarioId || '').toLowerCase().trim();
                const tNom = (t.Nombre || t.nombre || '').toLowerCase().trim();
                return tUsr === selectedUsr || tNom === selectedUsr;
            });
        };

        const RecFiltered = filtrarPorUsuario(state.tareasRecurrentes);
        const SemFiltered = filtrarPorUsuario(state.tareasSemanales);
        const PrevFiltered = filtrarPorUsuario(state.planPreventivo);

        const programadas = RecFiltered.length + SemFiltered.length;
        
        let completadas = 0;
        RecFiltered.forEach(t => { if (t.Estado === 'Finalizada') completadas++; });
        SemFiltered.forEach(t => { if (t.Estado === 'Finalizada') completadas++; });
        PrevFiltered.forEach(t => { if (t.Estado === 'Realizado') completadas++; });

        utils.animateNumber('stat-tareas-prog', programadas);
        utils.animateNumber('stat-tareas-comp', completadas);
        utils.animateNumber('stat-tareas-equipos', PrevFiltered.length);
    },
};
window.ui = ui;
