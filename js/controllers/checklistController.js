// ============================================================
//  js/controllers/checklistController.js
//  Controlador del Checklist Semanal - V2.0
// ============================================================

// Tareas base predefinidas por sección
const TAREAS_BASE_PREDEFINIDAS = [];

window.checklistController = {
    state: {
        semanaActual: '',        // Label "Semana N - YYYY"
        mesActual: '',           // Nombre del mes
        semanaCerrada: false,
        checklistData: [],       // Tareas de la semana activa
        baseTasks: [],           // Tareas de la hoja TareasBase
        historialSemanas: [],    // Lista de semanas disponibles [ { label, cerrada } ]
        filtroResponsable: '',
    },

    // ── INIT ──
    init() {
        this.state.semanaActual = this.getSemanaLabel(new Date());
        this.montarEventos();
        this.refreshData();
    },

    montarEventos() {
        // Botón nueva semana
        const btnNueva = document.getElementById('btn-nueva-semana');
        if (btnNueva) btnNueva.addEventListener('click', () => this.crearNuevaSemana());

        // Botón cerrar semana
        const btnCerrar = document.getElementById('btn-cerrar-semana');
        if (btnCerrar) btnCerrar.addEventListener('click', () => this.cerrarSemana());

        // Selector de historial
        const selHistorial = document.getElementById('checklist-semana-selector');
        if (selHistorial) selHistorial.addEventListener('change', (e) => this.cargarSemana(e.target.value));

        // Filtro responsable
        const inpResp = document.getElementById('checklist-filter-resp');
        if (inpResp) inpResp.addEventListener('input', () => {
            this.state.filtroResponsable = inpResp.value;
            this.render(true);
        });

        // Form nueva tarea personalizada
        const tbody = document.getElementById('checklist-tbody');
        if (!tbody) return;

        // Limpiar y añadir clase de animación
        tbody.innerHTML = '';
        tbody.classList.remove('anim-refresh');
        void tbody.offsetWidth; // Trigger reflow
        tbody.classList.add('anim-refresh');

        const form = document.getElementById('form-checklist-nueva');
        if (form) form.addEventListener('submit', (e) => this.guardarTareaNueva(e));
    },

    // ── UTILIDADES DE SEMANA ──
    getSemanaLabel(fecha) {
        const num = this.getWeekNumber(fecha);
        const year = fecha.getFullYear();
        return `Semana ${num} - ${year}`;
    },

    getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    },

    getSemanaNum(label) {
        if (!label) return 0;
        const m = String(label).match(/Semana\s+(\d+)/i);
        if (m) return parseInt(m[1]);
        const n = parseInt(label);
        return isNaN(n) ? 0 : n;
    },

    getYearFromLabel(label) {
        const m = String(label).match(/(\d{4})/);
        return m ? parseInt(m[1]) : new Date().getFullYear();
    },

    // ── CARGA DE DATOS ──
    async refreshData() {
        console.log('[Checklist] Cargando datos...');
        try {
            checklistUI.renderLoading();
            let res = await api.get('getChecklistOnly');
            
            // Si la acción no existe o falla, intentar con la original (fallback)
            if (!res || res.error || res.checklistSeguimiento === undefined) {
                console.warn('[Checklist] getChecklistOnly falló, intentando getAllData...');
                res = await api.get('getAllData');
            }

            if (res && !res.error) {
                // Sincronizar con el estado global para evitar sobrescrituras
                if (window.MainApp) {
                    MainApp.state.checklistSeguimiento = res.checklistSeguimiento || [];
                    MainApp.state.checklistBase = res.checklistBase || [];
                    MainApp.state.semanaActual = this.state.semanaActual;
                }
                this._procesarDatos(res.checklistSeguimiento || [], res.checklistBase || []);
            } else {
                throw new Error(res && res.error ? res.error : 'Error en respuesta');
            }
        } catch (e) {
            console.error('[Checklist] Error al cargar:', e);
            // Fallback final a datos cacheados
            if (window.MainApp && MainApp.state.checklistSeguimiento) {
                this._procesarDatos(MainApp.state.checklistSeguimiento, MainApp.state.checklistBase || []);
            } else {
                this._inicializarSemanaVacia();
            }
        }
    },

    // Llamado por app.js -> actualizarUI
    injectData(checklistSeguimiento, checklistBase) {
        this._procesarDatos(checklistSeguimiento || [], checklistBase || []);
    },

    _procesarDatos(datos, baseTasks) {
        if (baseTasks) this.state.baseTasks = baseTasks;
        // Construir historial de semanas únicas
        const semanasMap = {};
        datos.forEach(t => {
            const lbl = t.SemanaLabel || t.semanalabel || t.Semana || t.semana || '';
            if (lbl) {
                const isClosed = (t.Cerrada === true || t.cerrada === true || t.Cerrada === 1 || t.cerrada === 1 || String(t.Cerrada || t.cerrada).toLowerCase() === 'true');
                if (!semanasMap[lbl]) {
                    semanasMap[lbl] = { 
                        label: lbl, 
                        cerrada: isClosed,
                        mes: t.Mes || t.mes || ''
                    };
                } else if (!isClosed) {
                    semanasMap[lbl].cerrada = false;
                }
                // Si no tiene mes y este registro sí, lo guardamos
                if (!semanasMap[lbl].mes && (t.Mes || t.mes)) {
                    semanasMap[lbl].mes = t.Mes || t.mes;
                }
            }
        });

        this.state.historialSemanas = Object.values(semanasMap).sort((a, b) => {
            const yearA = this.getYearFromLabel(a.label);
            const yearB = this.getYearFromLabel(b.label);
            if (yearA !== yearB) return yearB - yearA;
            return this.getSemanaNum(b.label) - this.getSemanaNum(a.label);
        });

        // Robust filter for week data
        const currentSemNum = this.getSemanaNum(this.state.semanaActual);
        const currentYear = this.getYearFromLabel(this.state.semanaActual);

        const semanaEnDatos = datos.filter(t => {
            const tLbl = t.SemanaLabel || t.semanalabel || '';
            const tSem = t.Semana || t.semana || '';
            
            // 1. Direct label match (includes year)
            if (String(tLbl) === String(this.state.semanaActual)) return true;
            
            // 2. Week number + Year match (more robust)
            const tNum = this.getSemanaNum(tLbl || tSem);
            const tYear = this.getYearFromLabel(tLbl || t.Año || t.anio || this.state.semanaActual);
            
            return tNum === currentSemNum && tYear === currentYear;
        });

        if (semanaEnDatos.length > 0) {
            // MERGE MISSING TASKS: 
            // Only tasks that were interacted with exist in Google Sheets.
            // We must keep those and add the rest from baseTasks so the list is complete.
            // Update month from any task of the week
            const firstTask = semanaEnDatos[0];
            const currentMonth = firstTask.Mes || firstTask.mes || this._getNombreMes(new Date());
            this.state.mesActual = currentMonth;

            const savedTaskIds = new Set(semanaEnDatos.map(t => String(t.TareaId || t.tareaid || '').trim()));
            const missingTasks = [];

            if (this.state.baseTasks && this.state.baseTasks.length > 0) {
                this.state.baseTasks.forEach(base => {
                    const bId = String(base.TareaId || base.id || base.ID || '').trim();
                    if (!savedTaskIds.has(bId)) {
                        missingTasks.push({
                            // Non-random ID for consistency
                            id: `SEG-${this.state.semanaActual.replace(/\s/g,'-')}-${bId}`,
                            TareaId: bId,
                            Nombre: base.Nombre || base.nombre || '',
                            Area: base.Area || base.area || 'General',
                            Periodicidad: base.Periodicidad || base.periodicidad || 'Diario',
                            Responsable: base.Responsable || base.responsable || '',
                            SemanaLabel: this.state.semanaActual,
                            Semana: currentSemNum,
                            Mes: currentMonth,
                            L: 0, M: 0, M2: 0, J: 0, V: 0,
                            Estado: '0%',
                            Cerrada: false,
                        });
                    }
                });
            }

            this.state.checklistData = [...semanaEnDatos, ...missingTasks];

            const historyInfo = semanasMap[this.state.semanaActual];
            if (historyInfo) {
                this.state.semanaCerrada = historyInfo.cerrada;
            } else {
                // For safety on new/unsaved weeks, assume open
                this.state.semanaCerrada = false;
            }
        } else {
            this.state.mesActual = this._getNombreMes(new Date());
            // Inheritance logic for new weeks
            let lastWeekTasks = [];
            if (this.state.historialSemanas.length > 0) {
                const lastWeekLabel = this.state.historialSemanas[0].label;
                lastWeekTasks = datos.filter(t => {
                    const lbl = t.SemanaLabel || t.semanalabel || t.Semana || t.semana || '';
                    return String(lbl) === String(lastWeekLabel);
                });
            }
            this._inicializarSemanaVacia(lastWeekTasks.length > 0 ? lastWeekTasks : null);
        }

        this.render();
    },

    _inicializarSemanaVacia(sourceTasks = null) {
        const source = sourceTasks ? sourceTasks : (this.state.baseTasks.length > 0 ? this.state.baseTasks : []);
        
        this.state.checklistData = source.map(base => {
            const b = {
                nombre: base.Nombre || base.nombre || '',
                area: base.Area || base.area || 'General',
                peri: base.Periodicidad || base.periodicidad || 'Diario',
                resp: base.Responsable || base.responsable || '',
                id_base: base.TareaId || base.id || base.ID || 'N/A'
            };
            return {
                id: `SEG-${this.state.semanaActual.replace(/\s/g,'-')}-${b.id_base}`,
                TareaId: b.id_base,
                Nombre: b.nombre,
                Area: b.area,
                Periodicidad: b.peri,
                Responsable: b.resp,
                SemanaLabel: this.state.semanaActual,
                Semana: this.getSemanaNum(this.state.semanaActual),
                Mes: this.state.mesActual,
                L: 0, M: 0, M2: 0, J: 0, V: 0,
                Estado: '0%',
                Cerrada: false,
            };
        });
        this.state.semanaCerrada = false;
    },

    // ── RENDER ──
    render(skipAnimation = false) {
        checklistUI.renderWeekBanner(
            this.state.semanaActual,
            this.state.mesActual,
            this.state.semanaCerrada,
            this.state.historialSemanas
        );
        checklistUI.renderTable(
            this.state.checklistData,
            { responsable: this.state.filtroResponsable },
            this.state.semanaCerrada,
            skipAnimation
        );
    },

    cargarSemana(label) {
        if (!label) return;
        
        // Efecto visual inmediato en el selector
        checklistUI.renderLoading();
        
        // Normalizar label a "Semana X - 20YY" si es solo un número
        let normalized = label;
        if (!String(label).toLowerCase().includes('semana')) {
            normalized = 'Semana ' + label;
            if (!String(label).includes('20')) {
                normalized += ' - ' + new Date().getFullYear();
            }
        }
        
        this.state.semanaActual = normalized;
        this.refreshData();
    },

    // ── CREAR NUEVA SEMANA ──
    async crearNuevaSemana() {
        const session = api.getSession() || {};
        if (session.rol === 'visualizador' || session.rol === 'supervisor') {
            utils.mostrarToast('Tu rol es de solo lectura. No puedes editar 🔒', 'warning');
            return;
        }

        const siguiente = this.getSemanaLabel(this._sumarSemanas(this.state.semanaActual, 1));
        if (!confirm(`¿Crear la ${siguiente}? Se copiarán las tareas de la semana actual.`)) return;

        utils.mostrarLoader('Creando nueva semana...');
        try {
            // Usar la semana actual si tiene datos para conservar custom tasks, sino usar baseTasks
            const source = this.state.checklistData.length > 0 ? this.state.checklistData : (this.state.baseTasks.length > 0 ? this.state.baseTasks : []);
            
            const nuevasTareas = source.map(base => {
                const b = {
                    nombre: base.Nombre || base.nombre || '',
                    area: base.Area || base.area || 'General',
                    peri: base.Periodicidad || base.periodicidad || 'Diario',
                    resp: base.Responsable || base.responsable || '',
                    id_base: base.TareaId || base.id || base.ID || 'N/A'
                };
                return {
                    id: `SEG-${siguiente.replace(/\s/g,'-')}-${b.id_base}-${Date.now()}`,
                    TareaId: b.id_base,
                    Nombre: b.nombre,
                    Area: b.area,
                    Periodicidad: b.peri,
                    Responsable: b.resp,
                    SemanaLabel: siguiente,
                    Semana: this.getSemanaNum(siguiente),
                    Mes: this._getNombreMes(new Date()),
                    L: 0, M: 0, M2: 0, J: 0, V: 0,
                    Estado: '0%',
                    Cerrada: false,
                    UsuarioSistema: session.usuario || 'admin'
                };
            });

            // Guardar todas en backend
            for (const t of nuevasTareas) {
                await api.post({ action: 'updateChecklist', item: t });
            }

            this.state.semanaActual = siguiente;
            this.state.checklistData = nuevasTareas;
            this.state.semanaCerrada = false;
            this.state.historialSemanas.unshift({ label: siguiente, cerrada: false });

            this.render();
            utils.mostrarToast(`${siguiente} creada con éxito ✓`, 'success');
        } catch (err) {
            utils.mostrarToast('Error al crear semana: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    _sumarSemanas(label, n) {
        // Calcula la fecha del lunes de la semana del label, suma n semanas
        const numSem = this.getSemanaNum(label);
        const year = parseInt((label.match(/\d{4}/) || [new Date().getFullYear()])[0]);
        // Obtener fecha del primer día del año + (semana * 7) días
        const jan4 = new Date(year, 0, 4);
        const weekStart = new Date(jan4);
        weekStart.setDate(jan4.getDate() + (numSem - 1) * 7);
        weekStart.setDate(weekStart.getDate() + n * 7);
        return weekStart;
    },

    // ── CERRAR SEMANA ──
    async cerrarSemana() {
        const session = api.getSession() || {};
        if (session.rol === 'visualizador' || session.rol === 'supervisor') {
            utils.mostrarToast('Tu rol es de solo lectura. No puedes editar 🔒', 'warning');
            return;
        }

        if (!confirm(`¿Cerrar la ${this.state.semanaActual}? No se podrán editar los datos.`)) return;
        utils.mostrarLoader('Cerrando semana...');
        try {
            // Actualizar todas las tareas con Cerrada: true
            for (const t of this.state.checklistData) {
                t.Cerrada = true;
                t.cerrada = true;
                await api.post({ action: 'updateChecklist', item: t });
            }
            this.state.semanaCerrada = true;
            const h = this.state.historialSemanas.find(h => h.label === this.state.semanaActual);
            if (h) h.cerrada = true;
            this.render();
            utils.mostrarToast('Semana cerrada correctamente 🔒', 'success');
        } catch (err) {
            utils.mostrarToast('Error al cerrar: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    // ── TOGGLE DÍA ──
    async toggleDay(taskId, day) {
        const session = api.getSession() || {};
        if (session.rol === 'visualizador' || session.rol === 'supervisor') {
            utils.mostrarToast('Tu rol es de solo lectura. No puedes editar 🔒', 'warning');
            return;
        }

        if (this.state.semanaCerrada) {
            utils.mostrarToast('Esta semana está cerrada. No se puede editar 🔒', 'warning');
            return;
        }

        const item = this.state.checklistData.find(t => String(t.id) === String(taskId));
        if (!item) return;

        const cur = Number(item[day] ?? item[day.toUpperCase()] ?? 0);
        const newVal = cur === 1 ? 0 : 1;
        
        // Update both versions for compatibility
        item[day] = newVal;
        item[day.toUpperCase()] = newVal;
        if (day === 'm2') item['M2'] = newVal;

        const perc = checklistUI.calculateTaskPerc(item);
        item.Estado = perc + '%';
        item.estado = perc + '%';

        // --- ACTUALIZAR DOM EN TIEMPO REAL SIN RECONSTRUIR LA TABLA (SIN PARPADEOS NI SALTOS) ---
        const dot = document.getElementById(`dot-${taskId}-${day}`);
        if (dot) {
            if (newVal === 1) {
                dot.className = 'checklist-dot dot-active';
                dot.innerHTML = '<i class="fa-solid fa-check"></i>';
                dot.title = 'Completado — clic para desmarcar';
            } else {
                dot.className = 'checklist-dot dot-empty';
                dot.innerHTML = '';
                dot.title = 'Pendiente — clic para marcar';
            }
        }

        const fill = document.getElementById(`progress-fill-${taskId}`);
        const txt = document.getElementById(`progress-text-${taskId}`);
        if (fill) {
            fill.style.width = perc + '%';
            fill.style.background = checklistUI.getColorByPerc(perc);
        }
        if (txt) {
            txt.textContent = perc + '%';
            txt.style.color = checklistUI.getColorByPerc(perc);
        }

        // Recalcular y actualizar barras de áreas
        const areas = {};
        this.state.checklistData.forEach(t => {
            const areaName = t.Area || t.area || 'General';
            if (!areas[areaName]) areas[areaName] = { total: 0, completed: 0 };
            ['l','m','m2','j','v'].forEach(d => {
                areas[areaName].total++;
                if (Number(t[d] ?? 0) === 1) areas[areaName].completed++;
            });
        });

        for (let areaName in areas) {
            const pct = Math.round((areas[areaName].completed / areas[areaName].total) * 100) || 0;
            const areaSlug = areaName.replace(/\s+/g, '-');
            const areaFill = document.getElementById(`area-fill-${areaSlug}`);
            const areaText = document.getElementById(`area-text-${areaSlug}`);
            if (areaFill) {
                areaFill.style.width = pct + '%';
                areaFill.style.background = checklistUI.getColorByPerc(pct);
            }
            if (areaText) {
                areaText.textContent = pct + '%';
                areaText.style.color = checklistUI.getColorByPerc(pct);
            }
        }

        // Recalcular y actualizar Resumen Global superior (re-renderiza el card superior, es muy rápido y no afecta al scroll de la tabla)
        checklistUI.renderResumenGlobal(this.state.checklistData, this.state.semanaCerrada);

        try {
            await api.post({ action: 'updateChecklist', item });
        } catch (e) {
            utils.mostrarToast('Error al guardar cambio', 'danger');
            await this.refreshData();
        }
    },

    // ── AGREGAR TAREA PERSONALIZADA ──
    async guardarTareaNueva(e) {
        if (e) e.preventDefault();
        const session = api.getSession() || {};
        if (session.rol === 'visualizador' || session.rol === 'supervisor') {
            utils.mostrarToast('Tu rol es de solo lectura. No puedes editar 🔒', 'warning');
            return;
        }

        if (this.state.semanaCerrada) {
            utils.mostrarToast('Esta semana está cerrada 🔒', 'warning');
            return;
        }

        const nombre = (document.getElementById('cl-nombre') || {}).value?.trim();
        const area = (document.getElementById('cl-area') || {}).value?.trim();
        const periodicidad = (document.getElementById('cl-periodicidad') || {}).value || 'Diario';
        const responsable = (document.getElementById('cl-responsable') || {}).value?.trim() || '';

        if (!nombre || !area) return;

        const id = 'SEG-CUSTOM-' + Date.now();
        const tarea = {
            id,
            TareaId: id,
            Nombre: nombre,
            Area: area,
            Periodicidad: periodicidad,
            Responsable: responsable,
            SemanaLabel: this.state.semanaActual,
            Semana: this.getSemanaNum(this.state.semanaActual),
            Mes: this.state.mesActual,
            L: 0, M: 0, M2: 0, J: 0, V: 0,
            Estado: '0%',
            Cerrada: false,
            UsuarioSistema: session.usuario || 'admin'
        };

        utils.mostrarLoader('Guardando...');
        try {
            await api.post({ action: 'updateChecklist', item: tarea });
            this.state.checklistData.push(tarea);
            this.render(true);
            document.getElementById('form-checklist-nueva').reset();
            utils.mostrarToast('Tarea agregada ✓', 'success');
        } catch (err) {
            utils.mostrarToast('Error: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    _getNombreMes(fecha) {
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        return meses[fecha.getMonth()];
    },

    // ── ELIMINAR TAREA ──
    async eliminarTarea(taskId) {
        const session = api.getSession() || {};
        if (session.rol === 'visualizador' || session.rol === 'supervisor') {
            utils.mostrarToast('Tu rol es de solo lectura. No puedes editar 🔒', 'warning');
            return;
        }

        if (this.state.semanaCerrada) {
            utils.mostrarToast('Semana cerrada 🔒', 'warning');
            return;
        }
        if (!confirm('¿Eliminar esta tarea del checklist?')) return;
        utils.mostrarLoader('Eliminando...');
        try {
            await api.post({ action: 'eliminarChecklistItem', id: taskId });
            this.state.checklistData = this.state.checklistData.filter(t => String(t.id) !== String(taskId));
            this.render(true);
            utils.mostrarToast('Tarea eliminada', 'success');
        } catch (e) {
            utils.mostrarToast('Error al eliminar', 'danger');
        } finally {
            utils.ocultarLoader();
        }
    }
};
