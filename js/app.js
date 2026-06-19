// ============================================================
//  app.js — Controlador Principal
// ============================================================

const MainApp = {
    version: "1.1-RESCUE",
    // Estado Global
    state: {
        productos: [],
        entradas: [],
        salidas: [],
        entregas: [],
        tareasRecurrentes: [],
        tareasSemanales: [],
        planPreventivo: [],
        bitacora: [],
        checklistBase: [],
        checklistSeguimiento: [],
        chartInstance: null,
        vistaActual: '', // Vista activa (ej: 'productos', 'tareas-recurrentes')
        moduloActual: '', // Módulo principal (ej: 'inventario', 'tareas')
    },

    init() {
        console.log("%c SISTEMAS OVOPACIFIC - VERSION: 1.1-RESCUE ", "background: #6366f1; color: white; padding: 5px; border-radius: 5px;");
        this.inicializarNavegacion();
        this.inicializarEventos();
        this.inicializarLogin();
        
        // Generar checkboxes para tareas mensuales
        ui.generarCheckboxesMeses();
        
        // Inicializar Checklist Semanal
        if (window.checklistController) checklistController.init();
        
        // Verificar sesión persistente
        const session = api.getSession();
        
        if (session) {
            // Ocultar login y mostrar portal directamente
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('landing-portal').style.display = 'flex';
            document.getElementById('landing-portal').style.opacity = '1';
            
            this.actualizarUIUsuario(session);
            this.checkPermissions();
            this.cargarTodosLosDatos();
        } else {
            // Mostrar login
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('landing-portal').style.display = 'none';
        }
    },

    actualizarUIUsuario(session) {
        const currentName = session.nombre || session.usuario;
        const userBox = document.getElementById('sidebar-user');
        if (userBox) {
            userBox.style.display = 'flex';
            document.getElementById('user-name-display').textContent = currentName;
            document.getElementById('user-initial').textContent = currentName.charAt(0).toUpperCase();
            
            // Etiqueta de rol
            const roleBadge = document.getElementById('user-role-badge');
            if (roleBadge) {
                const role = (session.rol || 'usuario').toLowerCase();
                roleBadge.textContent = session.rol || 'Usuario';
                roleBadge.className = 'role-badge ' + role;
            }
        }
    },

    checkPermissions() {
        const session = api.getSession();
        if (!session) return;

        const isVisualizer = session.rol === 'visualizador';
        const isAdmin = session.rol === 'admin';
        const isSupervisor = session.rol === 'supervisor';
        
        // Ocultar módulo de tareas en el portal principal a roles no autorizados (ahora incluimos 'usuario')
        const cardTareas = document.getElementById('card-modulo-tareas');
        if (cardTareas) {
            const isUser = session.rol === 'usuario';
            if (!isAdmin && !isSupervisor && !isVisualizer && !isUser) { 
                cardTareas.style.display = 'none';
            } else {
                cardTareas.style.display = '';
            }
        }
        
        // Ocultar filtros de supervisor si no es Admin/Supervisor (NUCLEAR)
        const filtrosSupervisor = document.getElementById('prev-filtros-supervisor');
        if (filtrosSupervisor) {
            if (isAdmin || isSupervisor) {
                filtrosSupervisor.style.setProperty('display', 'flex', 'important');
            } else {
                filtrosSupervisor.style.setProperty('display', 'none', 'important');
            }
        }

        // Deshabilitar botones de escritura si es visualizador o supervisor
        const writeButtons = document.querySelectorAll('.btn-primary, .prev-add-btn, button[type="submit"], .action-btn.del, .action-btn.edit');
        writeButtons.forEach(btn => {
            if (isVisualizer || isSupervisor) {
                btn.style.display = 'none'; // Ocultar para evitar tentación
            } else {
                btn.style.display = '';
            }
        });

        // Ocultar formularios si es visualizador o supervisor
        const forms = document.querySelectorAll('form');
        forms.forEach(f => {
            if ((isVisualizer || isSupervisor) && f.id !== 'login-form') {
                const parentPanel = f.closest('.panel');
                if (parentPanel && parentPanel.classList.contains('mant-add-panel')) {
                    parentPanel.style.display = 'none';
                } else {
                    f.style.display = 'none';
                }
            } else {
                f.style.display = '';
            }
        });
    },

    logout() {
        if (confirm('¿Cerrar sesión?')) {
            api.logout();
        }
    },

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
                if (res.success) {
                    this.actualizarUIUsuario(res);
                    this.checkPermissions();
                    
                    // Ocultar login y mostrar portal
                    const loginScreen = document.getElementById('login-screen');
                    loginScreen.style.opacity = '0';
                    setTimeout(() => {
                        loginScreen.style.display = 'none';
                        const landing = document.getElementById('landing-portal');
                        if (landing) {
                            landing.style.display = 'flex';
                            setTimeout(() => {
                                landing.style.opacity = '1';
                                if (window.initPortalParticles) window.initPortalParticles();
                            }, 50);
                        }
                    }, 500);

                    this.cargarTodosLosDatos();
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

    /**
     * Inicializa los eventos de clic del sidebar para el menú de inventario.
     * El menú de tareas usa 'onclick' directamente en el HTML para mayor claridad.
     */
    inicializarNavegacion() {
        // Navegación de Inventario
        document.querySelectorAll('#nav-links li').forEach(li => {
            li.addEventListener('click', () => {
                if (li.dataset.view) this.cambiarVista(li.dataset.view);
            });
        });
    },

    /**
     * Maneja el cambio de usuario seleccionado para el rol visualizador.
     */
    handleVisualizerUserChange(modulo, usuario) {
        this.state[`selectedUser_${modulo}`] = usuario;
        this.actualizarUI();
    },

    setMode(mode) {
        this.state.moduloActual = mode;
        const logoText = document.getElementById('sidebar-logo-text');
        const logoIcon = document.getElementById('sidebar-logo-icon');
        const searchWrap = document.querySelector('.search-wrap');

        // Garantizar que el perfil de usuario siga visible siempre que haya sesión
        const session = api.getSession();
        const currentUser = session.usuario;
        if (currentUser) {
            const userBox = document.getElementById('sidebar-user');
            if (userBox) userBox.style.display = 'flex';
        }

        if (mode === 'inventario') {
            if (searchWrap) searchWrap.style.display = 'block';
            document.getElementById('nav-menu-inventario').style.display = 'block';
            document.getElementById('nav-menu-tareas').style.display = 'none';
            const miniStatsInv = document.getElementById('mini-stats-inventario');
            if (miniStatsInv) miniStatsInv.style.display = 'flex';
            const miniStatsTar = document.getElementById('mini-stats-tareas');
            if (miniStatsTar) miniStatsTar.style.display = 'none';
            this.cambiarVista('productos');
            
            document.getElementById('page-title').textContent = 'Inventario';
            document.getElementById('page-subtitle').textContent = 'Gestión del almacén';
            
            if (logoText) logoText.innerHTML = `Inventario<span> Sistemas</span>`;
            if (logoIcon) logoIcon.className = `fa-solid fa-boxes-stacked`;
            
        } else if (mode === 'tareas') {
            if (searchWrap) {
                searchWrap.style.display = 'none';
                const searchInput = searchWrap.querySelector('input');
                if (searchInput) searchInput.value = ''; // Limpiar búsqueda al cambiar
            }
            document.getElementById('nav-menu-inventario').style.display = 'none';
            document.getElementById('nav-menu-tareas').style.display = 'block';
            const miniStatsInv = document.getElementById('mini-stats-inventario');
            if (miniStatsInv) miniStatsInv.style.display = 'none';
            const miniStatsTar = document.getElementById('mini-stats-tareas');
            if (miniStatsTar) miniStatsTar.style.display = 'flex';
            
            // Al entrar a tareas, mostramos por defecto la vista Mensual (recurrentes)
            this.switchTareasView('recurrentes');
            
            document.getElementById('page-title').textContent = 'Seguimiento de Tareas';
            document.getElementById('page-subtitle').textContent = 'Mis responsabilidades y actividades programadas';
            
            if (logoText) logoText.innerHTML = `Gestión de<span> Tareas</span>`;
            if (logoIcon) logoIcon.className = `fa-solid fa-list-check`;
            
            // Re-renderizar con los datos ya cargados
            ui.renderizarTareasMensualesV3(this.state.tareasRecurrentes);
            ui.renderizarTareasSemanalesV3(this.state.tareasSemanales);
            ui.renderizarPreventivoV3(this.state.planPreventivo);
            if (ui.renderizarDashboardTareas) ui.renderizarDashboardTareas(this.state);
            ui.renderizarResponsables(this.state.usuariosPreventivo || []);
            ui.renderizarBitacoraV3(this.state.bitacora);
        }
    },

    /**
     * Cambia la vista activa del sistema, gestionando clases 'active' en sidebar y secciones.
     * @param {string} vista - Nombre de la vista (id sin el prefijo 'view-')
     */
    cambiarVista(vista) {
        this.state.vistaActual = vista;

        // Actualizar estados del sidebar (Inventario)
        document.querySelectorAll('#nav-links li').forEach(li => {
            li.classList.toggle('active', li.dataset.view === vista);
        });

        // Actualizar estados del sidebar (Tareas)
        document.querySelectorAll('#nav-links-tareas li').forEach(li => {
            const v = li.dataset.tareasView;
            li.classList.toggle('active', v === vista || `tareas-${v}` === vista);
        });

        // Mostrar la sección correspondiente
        document.querySelectorAll('.view-section').forEach(sec => {
            sec.classList.toggle('active', sec.id === `view-${vista}`);
        });

        this.actualizarUI();
    },

    /**
     * Especializado para cambiar entre las sub-vistas del módulo de Tareas.
     * @param {string} viewName - Nombre de la subview de tareas
     */
    switchTareasView(viewName) {
        // En nuestro nuevo diseño, las sub-vistas son vistas de primer nivel en el sidebar
        // Pero para mantener compatibilidad con las IDs de las secciones:
        const fullViewId = viewName === 'usuarios' ? 'usuarios' : `tareas-${viewName}`;
        this.cambiarVista(fullViewId);
        
        // Actualizar títulos según la vista
        const titles = {
            'dashboard': ['Dashboard de Cumplimiento', 'Indicadores Clave de Rendimiento'],
            'recurrentes': ['Mantenimiento Mensual', 'Programación de actividades fijas por mes'],
            'semanales': ['Seguimiento Semanal', 'Actividades de rutina de Lunes a Viernes'],
            'checklist': ['Tablero Checklist Semanal', 'Seguimiento detallado de tareas diarias'],
            'preventivo': ['Plan Preventivo', 'Seguimiento de mantenimiento por equipo'],
            'usuarios': ['Responsables de Mantenimiento', 'Gestión del personal y equipos asignados'],
            'bitacora': ['Bitácora de Evidencias', 'Registro fotográfico de actividades realizadas']
        };

        if (titles[viewName]) {
            document.getElementById('page-title').textContent = titles[viewName][0];
            document.getElementById('page-subtitle').textContent = titles[viewName][1];
        }
    },

    // ── DATOS ──
    async cargarTodosLosDatos() {
        if (GAS_URL.includes('TU_URL_WEB_APP')) {
            utils.ocultarLoader();
            ui.setConexionStatus('error');
            utils.mostrarToast('⚠️ Configura la URL de tu Web App en api.js', 'warning');
            this.usarDatosDemo();
            return;
        }

        utils.mostrarLoader('Cargando...');
        ui.setConexionStatus('connecting');

        try {
            const data = await api.getAllData();

            this.state.productos = Array.isArray(data.productos) ? data.productos : [];
            this.state.entradas = Array.isArray(data.entradas) ? data.entradas : [];
            this.state.salidas = Array.isArray(data.salidas) ? data.salidas : [];
            this.state.entregas = Array.isArray(data.entregas) ? data.entregas : [];
            
            const tRec = data.tareasRecurrentes || [];
            const tSem = data.tareasSemanales || [];
            const pPrev = data.planPreventivo || []; 
            const bit = data.bitacora || [];
            const uPrev = data.usuariosPreventivo || [];
            
            // FILTRADO POR USUARIO (Aislamiento de tareas)
            const session = api.getSession() || {};
            const isAdmin = session.rol === 'admin' || session.rol === 'supervisor';
            const curUser = (session.usuario || "").toLowerCase();

            const f = (arr) => {
                if (isAdmin) return arr;
                return arr.filter(item => {
                    const uStr = (item.UsuarioSistema || item.usuariosistema || item.UsuarioSistemas || item.usuariosistemas || "").toString().trim().toLowerCase();
                    const uDoc = (item.Usuario || item.usuario || item.UsuarioId || "").toString().trim().toLowerCase();
                    return uStr === curUser || uDoc === curUser || uStr === ""; 
                });
            };

            this.state.tareasRecurrentes = f(tRec);
            this.state.tareasSemanales = f(tSem);
            this.state.bitacora = f(bit);
            this.state.planPreventivo = pPrev;
            this.state.usuariosPreventivo = uPrev;
            this.state.usuariosAdmin = Array.isArray(data.usuarios) ? data.usuarios : [];
            this.state.checklistBase = data.checklistBase || [];
            this.state.checklistSeguimiento = data.checklistSeguimiento || [];

            ui.setConexionStatus('ok');
            this.actualizarUI();
        } catch (err) {
            console.error('Error cargando datos:', err);
            ui.setConexionStatus('error');
            utils.mostrarToast('Error de conexión: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    /**
     * Sincronización rápida: Solo carga productos y movimientos.
     * Ideal para operaciones de almacén que no requieren datos de tareas.
     */
    async cargarSoloInventario() {
        utils.mostrarLoader('Actualizando inventario...');
        try {
            const data = await api.getAllData();

            this.state.productos = Array.isArray(data.productos) ? data.productos : [];
            this.state.entradas  = Array.isArray(data.entradas)  ? data.entradas  : [];
            this.state.salidas   = Array.isArray(data.salidas)   ? data.salidas   : [];
            this.state.entregas  = Array.isArray(data.entregas)  ? data.entregas  : [];

            this.actualizarUI();
        } catch (err) {
            console.error('[SYNC FAST] Error:', err);
        } finally {
            utils.ocultarLoader();
        }
    },

    actualizarUI() {
        const { vistaActual, productos, entradas, salidas, chartInstance } = this.state;
        ui.actualizarMiniStats(productos);
        ui.llenarSelectsProductos(productos);
        ui.llenarSelectsEquipos(productos);

        const enModuloTareas = vistaActual === 'inicio-tareas-view' || this.state.moduloActual === 'tareas';
        if (enModuloTareas) {
            ui.renderizarDashboardTareas(this.state);
            ui.renderizarTareasMensualesV3(this.state.tareasRecurrentes);
            ui.renderizarTareasSemanalesV3(this.state.tareasSemanales);
            ui.renderizarPreventivoV3(this.state.planPreventivo);
            ui.renderizarBitacoraV3(this.state.bitacora);
            ui.actualizarMiniStatsTareas(this.state);
            if (vistaActual === 'tareas-checklist' && window.checklistController) {
                checklistController.injectData(this.state.checklistSeguimiento, this.state.checklistBase);
            }
        }
        if (vistaActual === 'productos') ui.renderizarProductos(productos);
        if (vistaActual === 'entradas') ui.renderizarEntradas(this.state.entradas);
        if (vistaActual === 'salidas') ui.renderizarSalidas(this.state.salidas);
        if (vistaActual === 'entregas') ui.renderizarEntregas(this.state.entregas);
        
        if (vistaActual === 'tareas-semanales' || this.state.moduloActual === 'tareas') {
            ui.renderizarTareasSemanalesV3(this.state.tareasSemanales);
        }

        if (vistaActual === 'usuarios') {
            ui.renderizarResponsables(this.state.usuariosPreventivo);
        }
        if (vistaActual === 'grafica') {
            this.state.chartInstance = ui.renderizarGrafica(productos, chartInstance);
        }
    },

    // Renderiza la matriz preventiva llamando a la función en tareasUI.js
    renderizarPreventivoMatriz() {
        ui.renderizarMatrizPreventivo(this.state.planPreventivo, this.state.usuariosPreventivo);
    },

    // Abre el modal para registrar un mantenimiento en una celda usuario×mes×semana
    abrirModalPrevReg(usuarioId, nombreUsuario, mes, semana) {
        const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        document.getElementById('prev-reg-usuario-id').value = usuarioId;
        document.getElementById('prev-reg-mes').value = mes;
        document.getElementById('prev-reg-semana').value = semana;
        document.getElementById('prev-reg-usuario').textContent = nombreUsuario;
        document.getElementById('prev-reg-periodo').textContent = `${MESES[Number(mes)-1]} – Semana ${semana}`;

        // BUSCAR SI YA EXISTE UN REGISTRO PARA ESTA CELDA
        const existing = (this.state.planPreventivo || []).find(r => {
            const rUid = String(r.UsuarioId || r.usuarioid || r.Usuario || r.usuario || '').trim();
            const rMes = parseInt(r.Mes || r.mes || 0);
            const rSem = parseInt(r.Semana || r.semana || 0);
            return rUid === String(usuarioId).trim() && rMes === parseInt(mes) && rSem === parseInt(semana);
        });

        const now = new Date();
        if (existing) {
            // Cargar datos existentes
            document.getElementById('prev-reg-id').value = existing.id || existing.ID || '';
            document.getElementById('prev-reg-fecha').value = (existing.FechaRealizacion || existing.fecha || now.toISOString().split('T')[0]).split('T')[0];
            document.getElementById('prev-reg-hora').value = existing.hora || now.toTimeString().slice(0, 5);
            document.getElementById('prev-reg-notas').value = existing.Notas || existing.notas || '';
        } else {
            // Valores por defecto para nuevo registro
            document.getElementById('prev-reg-id').value = '';
            document.getElementById('prev-reg-fecha').value = now.toISOString().split('T')[0];
            document.getElementById('prev-reg-hora').value = now.toTimeString().slice(0, 5);
            document.getElementById('prev-reg-notas').value = '';
        }

        const modal = document.getElementById('modal-prev-registro');
        const btnDelete = document.getElementById('btn-prev-reg-delete');
        if (btnDelete) btnDelete.style.display = existing ? 'block' : 'none';

        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
    },

    async guardarRegistroPreventivo(e) {
        if (e) e.preventDefault();
        const usuarioId = document.getElementById('prev-reg-usuario-id').value;
        const nombre = document.getElementById('prev-reg-usuario').textContent;
        const mes = document.getElementById('prev-reg-mes').value;
        const semana = document.getElementById('prev-reg-semana').value;
        const fecha = document.getElementById('prev-reg-fecha').value;
        const hora = document.getElementById('prev-reg-hora').value;
        const notas = document.getElementById('prev-reg-notas').value.trim();

        if (!fecha || !hora) return;
        const session = api.getSession();
        utils.mostrarLoader('Guardando mantenimiento...');
        try {
            // ENVIO AL BACKEND
            const existingId = document.getElementById('prev-reg-id').value;
            const res = await api.post({ 
                action: 'addRegistroPreventivo', 
                registro: {
                    id: existingId || ('PREV-' + Date.now()), // Si existe ID, se mantiene para actualización
                    Usuario: nombre, 
                    UsuarioId: usuarioId, 
                    Mes: mes,
                    Semana: semana,
                    Estado: 'Realizado', 
                    FechaRealizacion: fecha, 
                    Notas: notas || 'Mantenimiento Individual',
                    UsuarioSistema: session.usuario || 'Admin'
                }
            });

            // Forzar recarga completa para sincronizar con el servidor
            await this.cargarTodosLosDatos();
            document.getElementById('modal-prev-registro').style.display = 'none';
            this.renderizarPreventivoMatriz();
            utils.mostrarToast('Mantenimiento guardado ✓', 'success');
        } catch (err) {
            utils.mostrarToast('Error al guardar: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async eliminarRegistroPreventivo() {
        const id = document.getElementById('prev-reg-id').value;
        if (!id) return;

        if (!confirm('¿Estás seguro de eliminar este registro de mantenimiento?')) return;

        utils.mostrarLoader('Eliminando registro...');
        try {
            await api.post({ action: 'deletePreventivo', id: id });
            document.getElementById('modal-prev-registro').style.display = 'none';
            await this.cargarTodosLosDatos();
            this.renderizarPreventivoMatriz();
            utils.mostrarToast('Registro eliminado con éxito', 'success');
        } catch (err) {
            utils.mostrarToast('Error al eliminar: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async eliminarUsuarioPreventivo(id, nombre) {
        if (!id) return;
        if (!confirm(`¿Estás seguro de eliminar a "${nombre}" del directorio preventivo?`)) return;

        utils.mostrarLoader('Eliminando usuario...');
        try {
            await api.post({ action: 'deleteUsuarioPreventivo', id: id });
            await this.cargarTodosLosDatos();
            this.renderizarPreventivoMatriz();
            utils.mostrarToast('Usuario eliminado', 'success');
        } catch (err) {
            utils.mostrarToast('Error: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async registrarUsuarioPreventivo(e, nombreProp, areaProp) {
        if (e) e.preventDefault();
        
        // Intentar obtener valores de diferentes formularios posibles (Quick-add o Formulario Completo)
        const nombre = nombreProp || (document.getElementById('uprev-nombre') ? document.getElementById('uprev-nombre').value.trim() : '');
        const area = areaProp || (document.getElementById('uprev-area') ? document.getElementById('uprev-area').value.trim() : '');
        
        if (!nombre) {
            utils.mostrarToast('Nombre del técnico es obligatorio', 'warning');
            return;
        }
        
        const session = api.getSession();
        utils.mostrarLoader('Guardando usuario...');
        try {
            await api.post({
                action: 'addUsuarioPreventivo',
                usuario: {
                    id: 'UPREV-' + Date.now(),
                    Nombre: nombre,
                    Area: area || 'General',
                    UsuarioSistema: session.usuario || 'Admin'
                }
            });
            await this.cargarTodosLosDatos();
            this.renderizarPreventivoMatriz();
            utils.mostrarToast('Usuario agregado con éxito ✓', 'success');
        } catch (err) {
            utils.mostrarToast('Error al agregar: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    agregarUsuarioMatriz() {
        // Alias para el botón rápido de la matriz
        const nombre = (document.getElementById('filter-prev-usuario') || {}).value?.trim();
        const area = (document.getElementById('filter-prev-area') || {}).value?.trim();
        
        if (!nombre) {
            utils.mostrarToast('Escribe el nombre del técnico en el buscador para agregarlo', 'warning');
            return;
        }
        this.registrarUsuarioPreventivo(null, nombre, area || 'Producción');
    },

    usarDatosDemo() {
        this.state.productos = [
            { ID: 'PRD-001', Nombre: 'Laptop Dell XPS', Categoria: 'Electrónica', Descripcion: 'Demo', Cantidad: 15, Unidad: 'Unidades' },
            { ID: 'PRD-002', Nombre: 'Monitor 27"', Categoria: 'Electrónica', Descripcion: 'Demo', Cantidad: 4, Unidad: 'Unidades' }
        ];
        this.state.entradas = [];
        this.state.salidas = [];
        this.state.entregas = [];
        this.state.inicioTareas = [];
        this.state.tareasRecurrentes = [];
        this.state.bitacora = [];
        this.actualizarUI();
    },

    // ── EVENTOS DOM ──
    inicializarEventos() {
        // Búsqueda global
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.addEventListener('input', e => {
                const term = e.target.value.toLowerCase().trim();
                if (this.state.vistaActual === 'productos') ui.renderizarProductos(this.state.productos, term);
                if (this.state.vistaActual === 'inventario') ui.renderizarInventario(this.state.productos, term);
            });
        }

        // Selección de filas (Resaltado Premium solicitado por el usuario)
        document.addEventListener('click', (e) => {
            const tr = e.target.closest('tbody tr');
            if (tr && !e.target.closest('button')) {
                // Limpiar otros resaltados en la misma tabla
                const table = tr.closest('table');
                if (table) {
                    table.querySelectorAll('tr.selected-row').forEach(row => row.classList.remove('selected-row'));
                    tr.classList.add('selected-row');
                }
            }
        });

        // Filtros de Productos
        const filterProdNombre = document.getElementById('filter-prod-nombre');
        const filterProdFecha = document.getElementById('filter-prod-fecha');
        if (filterProdNombre) filterProdNombre.addEventListener('input', () => this.filtrarProductos());
        if (filterProdFecha) filterProdFecha.addEventListener('input', () => this.filtrarProductos());

        // Botones Generales
        document.getElementById('btn-refresh').addEventListener('click', () => this.cargarTodosLosDatos());
        
        // Filtros Módulo de Tareas V3
        ['filter-tm-mes', 'filter-tm-estado'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => ui.renderizarTareasMensualesV3(this.state.tareasRecurrentes));
        });

        ['filter-ts-semana', 'filter-ts-date', 'filter-ts-estado'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => ui.renderizarTareasSemanalesV3(this.state.tareasSemanales));
                if (id !== 'filter-ts-estado') el.addEventListener('input', () => ui.renderizarTareasSemanalesV3(this.state.tareasSemanales));
            }
        });

        ['filter-prev-usuario', 'filter-prev-mes', 'filter-prev-semana'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => ui.renderizarPreventivoV3(this.state.planPreventivo));
                if (id === 'filter-prev-usuario') el.addEventListener('input', () => ui.renderizarPreventivoV3(this.state.planPreventivo));
            }
        });

        document.getElementById('btn-export-inv').addEventListener('click', () => {
            if (this.state.moduloActual === 'tareas') {
                if (this.state.tabTareasActual === 'bitacora') {
                    utils.exportarCSV(this.state.bitacora, 'bitacora', ['Fecha', 'Descripcion', 'Usuario']);
                } else {
                    const mesesName = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                    const dataExport = this.state.tareasRecurrentes.map(t => {
                        // Normalización robusta (igual que en ui.js)
                        const vals = Object.values(t);
                        const mProgRaw = t.MesesProg || t.mesesprog || vals[3] || '[]';
                        const mCompRaw = t.MesesComp || t.mesescomp || vals[4] || '[]';
                        
                        let prog = []; let comp = [];
                        try { prog = typeof mProgRaw === 'string' ? JSON.parse(mProgRaw) : (Array.isArray(mProgRaw) ? mProgRaw : []); } catch(e){}
                        try { comp = typeof mCompRaw === 'string' ? JSON.parse(mCompRaw) : (Array.isArray(mCompRaw) ? mCompRaw : []); } catch(e){}
                        
                        return {
                            Actividad: t.Nombre || t.nombre || t.Actividad || vals[1] || 'Sin nombre',
                            Categoria: t.Categoria || t.categoria || t.Tipo || vals[2] || 'General',
                            Meses_Programados: Array.isArray(prog) ? prog.map(m => mesesName[m-1]).join(', ') : '',
                            Meses_Completados: Array.isArray(comp) ? comp.map(m => mesesName[m-1]).join(', ') : '',
                            Usuario: t.Usuario || vals[5] || ''
                        };
                    });
                    utils.exportarCSV(dataExport, 'plan_mantenimiento', ['Actividad', 'Categoria', 'Meses_Programados', 'Meses_Completados', 'Usuario']);
                }
            } else {
                utils.exportarCSV(this.state.productos, 'inventario', ['ID', 'Nombre', 'Categoria', 'Descripcion', 'Cantidad', 'Unidad', 'FechaRegistro']);
            }
        });

        // Modal Productos
        const modalProd = document.getElementById('modal-producto');
        document.getElementById('btn-nuevo-producto').addEventListener('click', () => this.abrirNuevoProducto());
        document.getElementById('close-modal-producto').addEventListener('click', () => this.cerrarModal());
        document.getElementById('btn-cancelar-prod').addEventListener('click', () => this.cerrarModal());
        modalProd.addEventListener('click', e => { if (e.target === modalProd) this.cerrarModal(); });
        document.getElementById('form-producto').addEventListener('submit', async e => {
            e.preventDefault();
            await this.guardarProducto();
        });

        // Formularios Movimientos
        document.getElementById('form-entrada').addEventListener('submit', async e => {
            e.preventDefault();
            await this.registrarEntrada();
        });
        document.getElementById('form-salida').addEventListener('submit', async e => {
            e.preventDefault();
            await this.registrarSalida();
        });

        // Cambio de producto en salida para mostrar stock
        document.getElementById('salida-producto').addEventListener('change', e => {
            const prod = this.state.productos.find(p => String(p.ID) === String(e.target.value));
            const info = document.getElementById('salida-stock-info');
            if (prod) {
                const qty = Number(prod.Cantidad) || 0;
                info.innerHTML = `<i class="fa-solid fa-boxes-stacked"></i> Disponible: <strong>${qty} ${prod.Unidad}</strong>`;
                document.getElementById('salida-cantidad').max = qty;
            } else {
                info.innerHTML = `<i class="fa-solid fa-info-circle"></i> Seleccione un producto`;
            }
        });

        // Fechas por defecto
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('entrada-fecha').value = hoy;
        document.getElementById('salida-fecha').value = hoy;
        const prodFecha = document.getElementById('prod-fecha');
        if (prodFecha) prodFecha.value = hoy;
        if (document.getElementById('ts-fecha-inicio')) document.getElementById('ts-fecha-inicio').value = hoy;
        
        // Entregas
        const formEntrega = document.getElementById('form-entrega');
        if (formEntrega) {
            formEntrega.addEventListener('submit', e => {
                e.preventDefault();
                this.registrarEntrega();
            });
            document.getElementById('entrega-fecha').value = hoy;
            
            document.getElementById('filter-entrega-nombre').addEventListener('input', () => this.filtrarEntregas());
            document.getElementById('filter-entrega-fecha').addEventListener('input', () => this.filtrarEntregas());
        }



        // Tareas V3.0
        const formMensual = document.getElementById('form-tarea-mensual');
        if (formMensual) formMensual.addEventListener('submit', e => this.registrarTareaMensual(e));

        const formSemanal = document.getElementById('form-tarea-semanal');
        if (formSemanal) formSemanal.addEventListener('submit', e => this.registrarTareaSemanalV3(e));

        const formPrev = document.getElementById('form-prev-masivo');
        if (formPrev) formPrev.addEventListener('submit', e => this.asignacionMasivaPreventivo(e));

        // Modal registro preventivo por celda
        const formPrevReg = document.getElementById('form-prev-reg');
        if (formPrevReg) formPrevReg.addEventListener('submit', e => this.guardarRegistroPreventivo(e));
        const closePrevReg = document.getElementById('close-modal-prev-reg');
        if (closePrevReg) closePrevReg.addEventListener('click', () => { document.getElementById('modal-prev-registro').style.display = 'none'; });
        const cancelPrevReg = document.getElementById('btn-prev-reg-cancel');
        if (cancelPrevReg) cancelPrevReg.addEventListener('click', () => { document.getElementById('modal-prev-registro').style.display = 'none'; });
        window.addEventListener('click', e => {
            const m = document.getElementById('modal-prev-registro');
            if (m && e.target === m) m.style.display = 'none';
        });

        const formUsuPrev = document.getElementById('form-usuario-preventivo');
        if (formUsuPrev) formUsuPrev.addEventListener('submit', e => this.registrarUsuarioPreventivo(e));

        // Quick-add user form en la sección Preventivo
        const formUsuPrevQuick = document.getElementById('form-usuario-preventivo-quick');
        if (formUsuPrevQuick) {
            formUsuPrevQuick.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nombre = document.getElementById('uprev-nombre-q').value.trim();
                const area = document.getElementById('uprev-area-q').value.trim();
                if (!nombre || !area) return;
                await this.registrarUsuarioPreventivo(null, nombre, area);
                formUsuPrevQuick.reset();
            });
        }

        const formBitacora = document.getElementById('form-bitacora');
        if (formBitacora) {
            formBitacora.addEventListener('submit', async (e) => {
                e.preventDefault(); 
                e.stopPropagation();
                try {
                    await this.registrarBitacoraDrive(e);
                } catch (err) {
                    console.error('Error Bitacora:', err);
                    utils.mostrarToast('Error al registrar: ' + err.message, 'danger');
                }
            });
        }

        // Logs Diarios
        const formLogDiario = document.getElementById('form-log-diario');
        if (formLogDiario) formLogDiario.addEventListener('submit', e => this.guardarLogDiario(e));
        
        const closeModalLogs = document.getElementById('close-modal-logs');
        if (closeModalLogs) {
            closeModalLogs.onclick = () => document.getElementById('modal-logs-diarios').style.display = 'none';
        }
        window.addEventListener('click', e => {
            const modal = document.getElementById('modal-logs-diarios');
            if (e.target === modal) modal.style.display = 'none';
        });

        if(document.getElementById('btn-masivo-mensual')) document.getElementById('btn-masivo-mensual').addEventListener('click', () => this.masivoMensual());
        if(document.getElementById('btn-masivo-semanal')) document.getElementById('btn-masivo-semanal').addEventListener('click', () => this.masivoSemanal());
        if(document.getElementById('btn-masivo-prev')) document.getElementById('btn-masivo-prev').addEventListener('click', () => this.masivoPreventivo());

        // Listeners Pestaña Filtros Tareas
        const evRenderMes = () => ui.renderizarTareasMensualesV3(this.state.tareasRecurrentes);
        ['filter-tm-nombre', 'filter-tm-mes', 'filter-tm-estado'].forEach(id => {
            if(document.getElementById(id)) {
                document.getElementById(id).addEventListener('change', evRenderMes);
                document.getElementById(id).addEventListener('input', evRenderMes);
            }
        });
        const evRenderSem = () => ui.renderizarTareasSemanalesV3(this.state.tareasSemanales);
        ['filter-ts-nombre', 'filter-ts-semana', 'filter-ts-estado'].forEach(id => {
            if(document.getElementById(id)) {
                document.getElementById(id).addEventListener('change', evRenderSem);
                document.getElementById(id).addEventListener('input', evRenderSem);
            }
        });
        const evRenderPre = () => ui.renderizarPreventivoV3(this.state.planPreventivo);
        ['filter-prev-usuario', 'filter-prev-area', 'filter-prev-mes', 'filter-prev-estado'].forEach(id => {
            if(document.getElementById(id)) {
                document.getElementById(id).addEventListener('change', evRenderPre);
                document.getElementById(id).addEventListener('input', evRenderPre);
            }
        });
    },

};
window.MainApp = MainApp;

// ==========================================
// AUTOARANQUE Y VENTANA
// ==========================================
window.startApp = function(mode) {
    const landing = document.getElementById('landing-portal');
    const appCont = document.getElementById('app-container');
    
    if (landing) {
        landing.style.opacity = '0';
        setTimeout(() => {
            landing.style.display = 'none';
            if (appCont) {
                appCont.style.display = 'flex';
                // Trigger a reflow
                void appCont.offsetWidth;
                appCont.style.opacity = '1';
                MainApp.setMode(mode);
            }
        }, 600);
    } else {
        MainApp.setMode(mode);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    MainApp.init();
});
