// ============================================================
//  js/controllers/tareasController.js
//  Controlador de Tareas y Mantenimiento
// ============================================================

window.MainApp = window.MainApp || {};
Object.assign(window.MainApp, {
    async registrarTareaMensual(e) {
        if (e) e.preventDefault();
        const nombre = document.getElementById('tm-nombre').value.trim();
        if (!nombre) return;

        // Recolectar meses marcados
        const checks = document.querySelectorAll('.tr-mes-check:checked');
        if (checks.length === 0) {
            utils.mostrarToast('Debes seleccionar al menos un mes.', 'warning');
            return;
        }
        const mesesData = Array.from(checks).map(c => Number(c.value));

        const session = api.getSession();
        const payload = {
            Nombre: nombre,
            UsuarioSistema: session.usuario || 'Admin',
            meses: mesesData
        };

        const len = mesesData.length;
        utils.mostrarLoader(`Generando ${len} registro(s) mensual(es)...`);
        try {
            const res = await api.post({ action: 'addTareaMensualGroup', ...payload });
            if (res.success && res.generados) {
                this.state.tareasRecurrentes.push(...res.generados);
            }
            utils.mostrarToast(`${len} registro(s) generado(s)`, 'success');
            document.getElementById('form-tarea-mensual').reset();
            ui.renderizarTareasMensualesV3(this.state.tareasRecurrentes);
            ui.renderizarDashboardTareas(this.state);
        } catch (err) {
            utils.mostrarToast('Error al guardar: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async eliminarTareaMensualGrupo(nombre) {
        if (!confirm(`¿Estás seguro de eliminar TODO el grupo de tareas: "${nombre}"? Esto borrará todos sus meses asociados y es irreversible.`)) return;
        
        utils.mostrarLoader('Eliminando grupo de tareas...');
        try {
            const res = await api.post({
                action: 'deleteTareaMensualGroup',
                Nombre: nombre
            });
            if (res.success) {
                // Actualizar estado local
                this.state.tareasRecurrentes = this.state.tareasRecurrentes.filter(t => t.Nombre !== nombre);
                ui.renderizarTareasMensualesV3(this.state.tareasRecurrentes);
                ui.renderizarDashboardTareas(this.state);
                utils.mostrarToast(`Grupo "${nombre}" eliminado con éxito`, 'success');
            } else {
                throw new Error("El servidor no confirmó la eliminación");
            }
        } catch (e) {
            console.error(e);
            utils.mostrarToast('Error al eliminar el grupo', 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },
    async eliminarTareaMensual(id) {
        if (!confirm('¿Eliminar este registro mensual?')) return;
        utils.mostrarLoader('Eliminando tarea...');
        try {
            await api.post({ action: 'deleteTareaMensual', id });
            this.state.tareasRecurrentes = this.state.tareasRecurrentes.filter(t => String(t.id) !== String(id));
            ui.renderizarTareasMensualesV3(this.state.tareasRecurrentes);
            ui.renderizarDashboardTareas(this.state);
            utils.mostrarToast('Eliminada', 'success');
        } catch (err) {
            utils.mostrarToast('Error: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async masivoMensual() {
        const checkboxes = document.querySelectorAll('.tm-check:checked');
        if (checkboxes.length === 0) return utils.mostrarToast('Seleccione al menos una tarea', 'warning');
        
        // Obtener objetos de las tareas seleccionadas
        const selectedTasks = Array.from(checkboxes).map(chk => 
            this.state.tareasRecurrentes.find(x => String(x.id) === String(chk.value))
        ).filter(t => t);

        const alMenosUnaPendiente = selectedTasks.some(t => t.Estado !== 'Finalizada');

        if (!alMenosUnaPendiente) {
            // Si TODAS están finalizadas, preguntar si quiere DESMARCARLAS
            if (!confirm(`¿Deseas DESMARCAR ${selectedTasks.length} tareas y volverlas a PENDIENTE?`)) return;
            
            utils.mostrarLoader('Cambiando a Pendiente...');
            try {
                for (let t of selectedTasks) {
                    t.Estado = 'Pendiente';
                    t.FechaFinalizacion = '';
                    await api.post({ action: 'updateTareaMensual', tarea: t });
                }
                utils.mostrarToast('Tareas devueltas a Pendiente', 'success');
            } catch (err) {
                utils.mostrarToast('Error al desmarcar: ' + err.message, 'danger');
            }
        } else {
            // Si hay pendientes, el flujo normal de FINALIZAR
            const fechaFin = prompt('Ingrese la fecha de finalización (AAAA-MM-DD):', new Date().toISOString().split('T')[0]);
            if (!fechaFin) return;

            if (!confirm(`¿Marcar ${selectedTasks.length} tareas como Finalizadas con fecha ${fechaFin}?`)) return;

            utils.mostrarLoader('Actualizando...');
            try {
                for (let t of selectedTasks) {
                    if (t.Estado !== 'Finalizada') {
                        t.Estado = 'Finalizada';
                        t.FechaFinalizacion = fechaFin;
                        await api.post({ action: 'updateTareaMensual', tarea: t });
                    }
                }
                utils.mostrarToast('Tareas finalizadas', 'success');
            } catch (err) {
                utils.mostrarToast('Error: ' + err.message, 'danger');
            }
        }

        // Bloque final común
        utils.ocultarLoader();
        document.getElementById('check-all-tm').checked = false;
        ui.renderizarTareasMensualesV3(this.state.tareasRecurrentes);
        ui.renderizarDashboardTareas(this.state);
    },

    // ==========================================
    // ── ACCIONES TAREAS SEMANALES ──
    // ==========================================
    async registrarTareaSemanalV3(e) {
        if (e) e.preventDefault();
        const id = document.getElementById('ts-id').value;
        const nombre = document.getElementById('ts-nombre').value.trim();
        const fInicio = document.getElementById('ts-fecha-inicio').value;
        const fFin = document.getElementById('ts-fecha-fin').value;

        if (!nombre || !fInicio) return;

        const session = api.getSession();
        const isEdit = !!id;

        // Para crear: SIN LogsDiarios (compatibilidad con GAS que no conoce el campo)
        // Para editar: CON LogsDiarios (la acción updateTareaSemanal ya lo maneja)
        const basePayload = {
            id: isEdit ? id : 'TS-' + Date.now(),
            Nombre: nombre,
            Semana: 0,
            FechaCreacion: fInicio,
            FechaFinalizacion: fFin,
            Estado: isEdit ? (this.state.tareasSemanales.find(t=>t.id===id) || {}).Estado || 'Pendiente' : 'Pendiente',
            UsuarioSistema: session.usuario || 'Admin',
        };

        // Solo incluir LogsDiarios al editar (el GAS de addTareaSemanal puede no conocerlo)
        const payload = isEdit
            ? { ...basePayload, LogsDiarios: (this.state.tareasSemanales.find(t=>t.id===id) || {}).LogsDiarios || '[]' }
            : basePayload;

        const action = isEdit ? 'updateTareaSemanal' : 'addTareaSemanal';
        const msg = isEdit ? 'Actualizada' : 'Semanal registrada';

        utils.mostrarLoader('Guardando semanal...');
        try {
            await api.post({ action, ...(isEdit ? { tarea: payload } : payload) });

            // Asegurarnos de que el objeto local siempre tenga LogsDiarios
            const payloadConLogs = { ...payload, LogsDiarios: payload.LogsDiarios || '[]' };

            if (isEdit) {
                const idx = this.state.tareasSemanales.findIndex(t => String(t.id) === String(id));
                if (idx !== -1) this.state.tareasSemanales[idx] = payloadConLogs;
            } else {
                this.state.tareasSemanales.push(payloadConLogs);
            }

            this.cancelarEdicionSemanalV3();
            ui.renderizarTareasSemanalesV3(this.state.tareasSemanales);
            ui.renderizarDashboardTareas(this.state);
            utils.mostrarToast(msg, 'success');
        } catch (err) {
            utils.mostrarToast('Error al guardar: ' + err.message, 'danger');
            console.error('[registrarTareaSemanalV3] Error:', err);
        } finally {
            utils.ocultarLoader();
        }
    },

    editarTareaSemanalV3(id) {
        const t = this.state.tareasSemanales.find(x => String(x.id) === String(id));
        if (!t) return;
        document.getElementById('ts-id').value = t.id;
        document.getElementById('ts-nombre').value = t.Nombre;
        document.getElementById('ts-fecha-inicio').value = (t.FechaCreacion || '').split('T')[0];
        document.getElementById('ts-fecha-fin').value = (t.FechaFinalizacion || '').split('T')[0];
        
        document.getElementById('btn-save-ts').innerHTML = '<i class="fa-solid fa-save"></i> Actualizar Tarea';
        document.getElementById('btn-cancel-ts').style.display = 'inline-block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    cancelarEdicionSemanalV3() {
        document.getElementById('form-tarea-semanal').reset();
        document.getElementById('ts-id').value = '';
        document.getElementById('btn-save-ts').innerHTML = '<i class="fa-solid fa-save"></i> Guardar Tarea Semanal';
        document.getElementById('btn-cancel-ts').style.display = 'none';
        
        // Reset fecha inicio a hoy
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('ts-fecha-inicio').value = hoy;
    },

    async eliminarTareaSemanalV3(id) {
        if (!confirm('¿Eliminar registro semanal?')) return;
        utils.mostrarLoader('Eliminando...');
        try {
            await api.post({ action: 'deleteTareaSemanal', id });
            this.state.tareasSemanales = this.state.tareasSemanales.filter(t => String(t.id) !== String(id));
            ui.renderizarTareasSemanalesV3(this.state.tareasSemanales);
            ui.renderizarDashboardTareas(this.state);
            utils.mostrarToast('Eliminado', 'success');
        } catch (err) {
            utils.mostrarToast('Error: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async masivoSemanal() {
        const checkboxes = document.querySelectorAll('.ts-check:checked');
        if (checkboxes.length === 0) return utils.mostrarToast('Seleccione al menos una', 'warning');
        if (!confirm('¿Marcar seleccionadas como Finalizadas?')) return;
        utils.mostrarLoader('Actualizando...');
        try {
            for (let chk of checkboxes) {
                let id = chk.value;
                let t = this.state.tareasSemanales.find(x => x.id === id);
                if (t && t.Estado !== 'Finalizada') {
                    t.Estado = 'Finalizada';
                    t.FechaFinalizacion = new Date().toISOString().split('T')[0];
                    await api.post({ action: 'updateTareaSemanal', tarea: t });
                }
            }
            ui.renderizarTareasSemanalesV3(this.state.tareasSemanales);
            ui.renderizarDashboardTareas(this.state);
            document.getElementById('check-all-ts').checked = false;
            utils.mostrarToast('Actualizado', 'success');
        } catch (err) {
            utils.mostrarToast('Error', 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    abrirModalLogs(id) {
        const t = this.state.tareasSemanales.find(x => String(x.id) === String(id));
        if (!t) return;
        
        this.currentTaskForLogs = t;
        document.getElementById('modal-log-task-name').textContent = t.Nombre;
        document.getElementById('modal-log-task-id').textContent = 'ID: ' + t.id;
        
        let logs = [];
        try {
            logs = JSON.parse(t.LogsDiarios || '[]');
        } catch(e) { console.error("Error parse LogsDiarios:", e); }
        
        ui.renderizarLogsDiarios(logs);
        
        document.getElementById('form-log-diario').reset();
        const now = new Date();
        document.getElementById('log-fecha').value = now.toISOString().split('T')[0];
        document.getElementById('log-inicio').value = now.toTimeString().slice(0, 5);
        document.getElementById('log-fin').value = now.toTimeString().slice(0, 5);
        
        document.getElementById('modal-logs-diarios').style.display = 'flex';
        document.getElementById('modal-logs-diarios').style.alignItems = 'center';
        document.getElementById('modal-logs-diarios').style.justifyContent = 'center';
    },

    async guardarLogDiario(e) {
        if (e) e.preventDefault();
        if (!this.currentTaskForLogs) return;

        const fecha = document.getElementById('log-fecha').value;
        const inicio = document.getElementById('log-inicio').value;
        const fin = document.getElementById('log-fin').value;
        const notas = document.getElementById('log-notas').value.trim();

        if (!fecha || !inicio || !fin) return;

        let logs = [];
        try {
            logs = JSON.parse(this.currentTaskForLogs.LogsDiarios || '[]');
        } catch(e) {}

        logs.push({ fecha, inicio, fin, notas });
        this.currentTaskForLogs.LogsDiarios = JSON.stringify(logs);

        utils.mostrarLoader('Guardando...');
        try {
            await api.post({ action: 'updateTareaSemanal', tarea: this.currentTaskForLogs });
            ui.renderizarLogsDiarios(logs);
            document.getElementById('form-log-diario').reset();
            document.getElementById('log-fecha').value = new Date().toISOString().split('T')[0];
            utils.mostrarToast('Reporte guardado', 'success');
        } catch (err) {
            utils.mostrarToast('Error: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async eliminarLogDiario(idx) {
        if (!this.currentTaskForLogs || !confirm('¿Eliminar reporte?')) return;

        let logs = [];
        try {
            logs = JSON.parse(this.currentTaskForLogs.LogsDiarios || '[]');
        } catch(e) {}

        logs.splice(idx, 1);
        this.currentTaskForLogs.LogsDiarios = JSON.stringify(logs);

        utils.mostrarLoader('Eliminando...');
        try {
            await api.post({ action: 'updateTareaSemanal', tarea: this.currentTaskForLogs });
            ui.renderizarLogsDiarios(logs);
            utils.mostrarToast('Eliminado', 'success');
        } catch (err) {
            utils.mostrarToast('Error: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    // ==========================================
    // ── ACCIONES MANTENIMIENTO PREVENTIVO ──
    // ==========================================
    async asignacionMasivaPreventivo(e) {
        if (e) e.preventDefault();
        const mes = document.getElementById('prev-masivo-mes').value;
        const semana = document.getElementById('prev-masivo-semana').value;
        const fecha = new Date().toISOString().split('T')[0];

        if (!mes || !semana) return;

        const session = api.getSession();
        utils.mostrarLoader('Asignando masivamente...');
        try {
            const res = await api.post({ 
                action: 'addPreventivoMasivo', 
                Mes: mes, // Col F
                Semana: semana, // Col G
                Estado: 'Realizado', // Col H
                Estados: 'Realizado',
                Fecha: fecha, // Col I
                FechaRealizacion: fecha,
                UsuarioSistema: session.usuario || 'Admin', // Col K
                UsuarioSistemas: session.usuario || 'Admin',
                quien_registro: session.usuario || 'Admin'
            });
            
            // Forzar recarga completa y renderizado
            await MainApp.cargarTodosLosDatos();
            
            document.getElementById('form-prev-masivo').reset();
            utils.mostrarToast('Asignación registrada a todos los usuarios', 'success');
        } catch (err) {
            utils.mostrarToast('Error: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async eliminarPreventivoV3(id) {
        if (!confirm('¿Eliminar este mantenimiento asignado?')) return;
        utils.mostrarLoader('Eliminando...');
        try {
            await api.post({ action: 'deletePreventivo', id });
            this.state.planPreventivo = this.state.planPreventivo.filter(r => String(r.id) !== String(id));
            ui.renderizarPreventivoV3(this.state.planPreventivo);
            ui.renderizarDashboardTareas(this.state);
            utils.mostrarToast('Eliminado', 'success');
        } catch (err) {
            utils.mostrarToast('Error al eliminar: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    async masivoPreventivo() {
        const checkboxes = document.querySelectorAll('.prev-check:checked');
        if (checkboxes.length === 0) return utils.mostrarToast('Seleccione al menos una', 'warning');
        if (!confirm('¿Marcar seleccionados como Realizados hoy?')) return;
        utils.mostrarLoader('Actualizando...');
        try {
            const hoy = new Date().toISOString().split('T')[0];
            for (let chk of checkboxes) {
                let id = chk.value;
                let t = this.state.planPreventivo.find(x => x.id === id);
                if (t && t.Estado !== 'Realizado') {
                    t.Estado = 'Realizado';
                    t.FechaRealizacion = hoy;
                    await api.post({ action: 'updatePreventivo', preventivo: t });
                }
            }
            ui.renderizarPreventivoV3(this.state.planPreventivo);
            ui.renderizarDashboardTareas(this.state);
            document.getElementById('check-all-prev').checked = false;
            utils.mostrarToast('Actualizado', 'success');
        } catch (err) {
            utils.mostrarToast('Error', 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    // ── ACCIONES USUARIOS ──
    async registrarUsuarioPreventivo(e, nombreOverride, areaOverride) {
        if (e) e.preventDefault();
        const nom = nombreOverride || document.getElementById('uprev-nombre').value.trim();
        const area = areaOverride || document.getElementById('uprev-area').value.trim();
        if (!nom || !area) return;

        const session = api.getSession();
        utils.mostrarLoader('Guardando usuario...');
        try {
            const u = {
                id: 'UPREV-' + Date.now(),
                Nombre: nom,   // Coincide con la columna en Google Sheets
                Area: area,
                UsuarioSistema: session.usuario || 'Admin'
            };
            await api.post({ action: 'addUsuarioPreventivo', usuario: u });
            if (!this.state.usuariosPreventivo) this.state.usuariosPreventivo = [];
            this.state.usuariosPreventivo.push(u);
            document.getElementById('form-usuario-preventivo').reset();
            ui.renderizarResponsables(this.state.usuariosPreventivo);
            // También re-renderizar preventivo para que el nuevo usuario aparezca en los filtros
            ui.renderizarPreventivoV3(this.state.planPreventivo);
            utils.mostrarToast('Usuario guardado', 'success');
        } catch (err) {
            utils.mostrarToast('Error: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },
    
    async eliminarResponsable(id) {
        if (!confirm('¿Eliminar usuario preventivo?')) return;
        utils.mostrarLoader('Eliminando...');
        try {
            await api.post({ action: 'deleteUsuarioPreventivo', id });
            this.state.usuariosPreventivo = this.state.usuariosPreventivo.filter(u => u.id !== id);
            ui.renderizarResponsables(this.state.usuariosPreventivo);
            utils.mostrarToast('Eliminado', 'success');
        } catch(err) {
            utils.mostrarToast('Error', 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    // ==========================================
    // ── ACCIONES BITÁCORA V3.0 Y GOOGLE DRIVE ──
    // ==========================================
    async registrarBitacoraDrive(e) {
        if (e) e.preventDefault();
        const titulo = document.getElementById('bitacora-titulo').value.trim();
        const desc = document.getElementById('bitacora-desc').value.trim();
        const fecha = document.getElementById('bitacora-fecha').value;
        const fileInput = document.getElementById('bitacora-file');

        if (!titulo || !fecha || !desc || !fileInput.files[0]) return;
        const file = fileInput.files[0];

        utils.mostrarLoader('Subiendo evidencia a Google Drive (Puede tardar)...');
        try {
            const dataUrl = await this.fileToBase64(file);
            const b64Parts = dataUrl.split(',');
            const base64Data = b64Parts.length > 1 ? b64Parts[1] : dataUrl;

            const session = api.getSession();
            const payload = { 
                id: 'EVID-' + Date.now().toString(), 
                Titulo: titulo,
                AsociadoA: 'General', // Valor por defecto ahora que se quitó el select
                Fecha: fecha, 
                Descripcion: desc, 
                base64Data: base64Data, // Procesado en backend y luego descartado para Sheet
                mimeType: file.type,
                filename: file.name,
                UsuarioSistema: session.usuario || 'Admin' 
            };
            
            const res = await api.post({ action: 'uploadEvidencia', ...payload });
            
            // Reconstruimos objeto para el array local quitando base64 (muy pesado en RAM)
            const localObj = {
                id: payload.id,
                Titulo: payload.Titulo,
                AsociadoA: 'General',
                Fecha: payload.Fecha,
                Descripcion: payload.Descripcion,
                DriveUrl: res.data ? res.data.DriveUrl : '',
                UsuarioSistema: payload.UsuarioSistema
            };

            this.state.bitacora.unshift(localObj);
            document.getElementById('form-bitacora').reset();
            document.getElementById('bitacora-fecha').value = new Date().toISOString().split('T')[0];
            
            ui.renderizarBitacoraV3(this.state.bitacora);
            utils.mostrarToast('Subido a Drive y Registrado', 'success');
        } catch (err) {
            utils.mostrarToast('Error al subir a Drive: ' + err.message, 'danger');
        } finally {
            utils.ocultarLoader();
        }
    },

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => resolve(event.target.result);
            reader.onerror = error => reject(error);
        });
    }

});
