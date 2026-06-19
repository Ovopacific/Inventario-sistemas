// ============================================================
//  js/ui/checklistUI.js
//  UI del Checklist Semanal - V2.0 (Dashboard Style)
// ============================================================

window.checklistUI = {

    // ── BANNER DE SEMANA ──────────────────────────────────────
    renderWeekBanner(semanaLabel, mesLabel, cerrada, historial) {
        // Normalizar etiqueta para mostrar
        let displayLabel = semanaLabel;
        if (!displayLabel.toLowerCase().includes('semana')) {
            displayLabel = 'Semana ' + displayLabel;
        }
        if (!displayLabel.includes('20')) {
             displayLabel += ' - ' + new Date().getFullYear();
        }

        // Actualizar label visible
        const lblSemana = document.getElementById('checklist-semana-label');
        if (lblSemana) {
            lblSemana.innerHTML = `${displayLabel} <span style="color:#64748b; font-size:0.9rem; font-weight:400; margin-left:8px;">— ${mesLabel}</span>`;
            lblSemana.className = 'semana-label-badge ' + (cerrada ? 'cerrada' : 'activa');
        }

        // Ícono/badge de estado
        const badge = document.getElementById('checklist-semana-badge');
        if (badge) {
            badge.innerHTML = cerrada
                ? `<i class="fa-solid fa-lock"></i> Cerrada`
                : `<i class="fa-solid fa-clock"></i> En curso`;
            badge.className = 'week-status-badge ' + (cerrada ? 'badge-cerrada' : 'badge-activa');
        }

        // Botones
        const session = api.getSession() || {};
        const isReadOnly = session.rol === 'visualizador' || session.rol === 'supervisor';
        const btnCerrar = document.getElementById('btn-cerrar-semana');
        if (btnCerrar) btnCerrar.style.display = (cerrada || isReadOnly) ? 'none' : 'inline-flex';
        const btnNueva = document.getElementById('btn-nueva-semana');
        if (btnNueva) btnNueva.style.display = isReadOnly ? 'none' : 'inline-flex';

        // Llenar selector de historial
        this.updateWeekSelector(semanaLabel, historial);
    },

    updateWeekSelector(actual, historial) {
        const sel = document.getElementById('checklist-semana-selector');
        if (!sel) return;
        const opciones = historial.length > 0 ? historial : [{ label: actual, cerrada: false }];
        
        const getWeekNum = (l) => {
            const m = String(l || '').match(/(\d+)/);
            return m ? parseInt(m[1]) : 0;
        };
        const actualNum = getWeekNum(actual);

        let selectedValue = null;
        sel.innerHTML = opciones.map(h => {
            const hNum = getWeekNum(h.label);
            const isSel = hNum === actualNum;
            if (isSel) {
                selectedValue = h.label;
            }
            return `
                <option value="${h.label}" ${isSel ? 'selected' : ''}>
                    ${h.label}${h.cerrada ? ' 🔒' : ''}
                </option>
            `;
        }).join('');

        if (selectedValue !== null) {
            sel.value = selectedValue;
        }
    },

    // ── TABLA PRINCIPAL ───────────────────────────────────────
    renderTable(data, filters, cerrada, skipAnimation = false) {
        const tbody = document.getElementById('checklist-tbody');
        if (!tbody) return;

        // Efecto de transición: reiniciar animación si no se omite
        if (!skipAnimation) {
            tbody.classList.remove('anim-refresh');
            void tbody.offsetWidth; // Forzar reflow para reiniciar la animación CSS
            tbody.classList.add('anim-refresh');
        }

        // Normalizar campos
        const normalize = (t) => ({
            ...t,
            nombre:       t.Nombre       || t.nombre       || '',
            area:         t.Area         || t.area         || 'Sin Área',
            periodicidad: t.Periodicidad || t.periodicidad || 'Diario',
            responsable:  t.Responsable  || t.responsable  || '',
            l:  Number(t.L  ?? t.l  ?? 0),
            m:  Number(t.M  ?? t.m  ?? 0),
            m2: Number(t.M2 ?? t.m2 ?? 0),
            j:  Number(t.J  ?? t.j  ?? 0),
            v:  Number(t.V  ?? t.v  ?? 0),
        });

        // Aplicar filtro responsable
        let filtrado = data.map(normalize);
        if (filters.responsable) {
            filtrado = filtrado.filter(t =>
                t.responsable.toLowerCase().includes(filters.responsable.toLowerCase())
            );
        }

        if (filtrado.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="empty-state">
                <i class="fa-solid fa-clipboard-list" style="font-size:2rem; color:#cbd5e1; display:block; margin-bottom:10px;"></i>
                No hay tareas para esta semana. Usa el botón <strong>"Nueva Semana"</strong> para iniciar.
            </td></tr>`;
            this.renderResumenGlobal([], cerrada);
            return;
        }

        // Agrupar por área
        const grupos = {};
        filtrado.forEach(t => {
            if (!grupos[t.area]) grupos[t.area] = [];
            grupos[t.area].push(t);
        });

        // Calcular resumen global
        this.renderResumenGlobal(filtrado, cerrada);

        // Renderizar por grupo
        const areaIconos = {
            'Infraestructura':          { icon: 'fa-server',        color: '#6366f1' },
            'Comunicaciones':           { icon: 'fa-phone-volume',   color: '#0ea5e9' },
            'Gestión Administrativa':   { icon: 'fa-folder-open',    color: '#f59e0b' },
        };

        let html = '';

        Object.keys(grupos).sort().forEach(area => {
            const tareas = grupos[area];
            const meta = areaIconos[area] || { icon: 'fa-tasks', color: '#64748b' };

            // Calcular % área
            let total = 0, cumplidos = 0;
            tareas.forEach(t => {
                ['l','m','m2','j','v'].forEach(d => {
                    total++;
                    if (t[d] === 1) cumplidos++;
                });
            });
            const pct = Math.round((cumplidos / total) * 100) || 0;

            const areaSlug = area.replace(/\s+/g, '-');
            // Fila cabecera de área
            html += `
                <tr class="area-header-row">
                    <td colspan="2">
                        <span class="area-icon-wrap" style="background:${meta.color};">
                            <i class="fa-solid ${meta.icon}"></i>
                        </span>
                        <strong>${area.toUpperCase()}</strong>
                    </td>
                    <td colspan="6">
                        <div class="inline-progress-wrap">
                            <div class="inline-progress-bar">
                                <div id="area-fill-${areaSlug}" class="inline-progress-fill" style="width:${pct}%; background:${this.getColorByPerc(pct)};"></div>
                            </div>
                            <span id="area-text-${areaSlug}" class="inline-progress-pct" style="color:${this.getColorByPerc(pct)};">${pct}%</span>
                        </div>
                    </td>
                    <td colspan="3" style="text-align:right; padding-right:16px;">
                        <span style="font-size:0.75rem; color:#94a3b8;">${tareas.length} tareas</span>
                    </td>
                </tr>
            `;

            // Filas de tareas
            tareas.forEach(t => {
                const pctTask = this.calculateTaskPerc(t);
                html += `
                    <tr class="${cerrada ? 'row-cerrada' : ''}">
                        <td class="tarea-nombre-cell">
                            <span class="tarea-nombre">${t.nombre}</span>
                        </td>
                        <td>
                            <span class="periodicity-badge ${t.periodicidad === 'Diario' ? 'periody' : 'periodsem'}">
                                ${t.periodicidad}
                            </span>
                        </td>
                        ${['l','m','m2','j','v'].map(d => this.renderDayCell(t, d, cerrada)).join('')}
                        <td class="estado-cell">
                            <div class="mini-progress-wrap">
                                <div class="mini-progress-bar">
                                    <div id="progress-fill-${t.id}" class="mini-progress-fill" style="width:${pctTask}%; background:${this.getColorByPerc(pctTask)};"></div>
                                </div>
                                <span id="progress-text-${t.id}" style="font-size:0.78rem; font-weight:700; color:${this.getColorByPerc(pctTask)};">${pctTask}%</span>
                            </div>
                        </td>
                        <td class="responsable-cell">${t.responsable || '<span style="color:#cbd5e1; font-size:0.8rem;">—</span>'}</td>
                        <td class="actions-cell">
                            ${cerrada ? '' : `
                            <button class="action-btn del" onclick="checklistController.eliminarTarea('${t.id}')" title="Eliminar">
                                <i class="fa-solid fa-trash"></i>
                            </button>`}
                        </td>
                    </tr>
                `;
            });
        });

        tbody.innerHTML = html;
    },

    // ── CELDA DE DÍA ─────────────────────────────────────────
    renderDayCell(task, day, cerrada) {
        const val = task[day];
        const active = val === 1;
        const session = api.getSession() || {};
        const isReadOnly = session.rol === 'visualizador' || session.rol === 'supervisor';
        const clickable = (!cerrada && !isReadOnly) ? `onclick="checklistController.toggleDay('${task.id}', '${day}')"` : '';
        const cursor = (cerrada || isReadOnly) ? 'default' : 'pointer';
        const helpText = (cerrada || isReadOnly) ? '' : ' — clic para marcar/desmarcar';

        return `<td class="day-cell">
            <div id="dot-${task.id}-${day}"
                 class="checklist-dot ${active ? 'dot-active' : 'dot-empty'}"
                 ${clickable}
                 style="cursor:${cursor};"
                 title="${active ? 'Completado' : 'Pendiente'}${helpText}">
                ${active ? '<i class="fa-solid fa-check"></i>' : ''}
            </div>
        </td>`;
    },

    // ── RESUMEN GLOBAL ────────────────────────────────────────
    renderResumenGlobal(data, cerrada) {
        const wrap = document.getElementById('checklist-resumen-global');
        if (!wrap) return;

        if (data.length === 0) {
            wrap.innerHTML = '';
            return;
        }

        let total = 0, cumplidos = 0;
        data.forEach(t => {
            ['l','m','m2','j','v'].forEach(d => {
                total++;
                const v = Number(t[d] ?? t[d.toUpperCase()] ?? 0);
                if (v === 1) cumplidos++;
            });
        });

        const pct = Math.round((cumplidos / total) * 100) || 0;
        const color = this.getColorByPerc(pct);
        const completas = data.filter(t => this.calculateTaskPerc(t) === 100).length;

        wrap.innerHTML = `
            <div class="resumen-global-card">
                <div class="resumen-global-left">
                    <div class="resumen-global-circle" style="--pct:${pct}; --color:${color};">
                        <span class="resumen-pct-num">${pct}%</span>
                        <span class="resumen-pct-label">Cumplimiento</span>
                    </div>
                </div>
                <div class="resumen-global-right">
                    <div class="resumen-stat">
                        <i class="fa-solid fa-list-check" style="color:#6366f1;"></i>
                        <span><strong>${data.length}</strong> tareas totales</span>
                    </div>
                    <div class="resumen-stat">
                        <i class="fa-solid fa-circle-check" style="color:#10b981;"></i>
                        <span><strong>${completas}</strong> tareas 100% completadas</span>
                    </div>
                    <div class="resumen-stat">
                        <i class="fa-solid fa-circle-xmark" style="color:#ef4444;"></i>
                        <span><strong>${data.length - completas}</strong> tareas pendientes</span>
                    </div>
                    ${cerrada ? `<div class="resumen-stat"><i class="fa-solid fa-lock" style="color:#f59e0b;"></i> <span>Semana <strong>cerrada</strong></span></div>` : ''}
                </div>
                <div class="resumen-global-barra-wrap">
                    <div class="resumen-global-barra">
                        <div class="resumen-global-fill" style="width:${pct}%; background: linear-gradient(90deg, ${color}, ${color}cc);"></div>
                    </div>
                </div>
            </div>
        `;
    },

    renderLoading() {
        const tbody = document.getElementById('checklist-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center; padding: 80px;">
                        <div class="loading-wrap" style="display:flex; flex-direction:column; align-items:center; gap:20px;">
                            <div class="checklist-spinner"></div>
                            <span style="color:#64748b; font-weight:600; letter-spacing:0.5px;">SINCRONIZANDO DATOS...</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    },

    // ── HELPERS ───────────────────────────────────────────────
    calculateTaskPerc(t) {
        const days = ['l','m','m2','j','v'];
        let count = 0;
        days.forEach(d => {
            const v = Number(t[d] ?? t[d.toUpperCase()] ?? 0);
            if (v === 1) count++;
        });
        return Math.round((count / 5) * 100);
    },

    getColorByPerc(p) {
        if (p >= 80) return '#10b981';
        if (p >= 50) return '#f59e0b';
        return '#ef4444';
    },

    updateFilters(data) {
        const respSelect = document.getElementById('checklist-filter-resp');
        if (!respSelect) return;
        const get = (t, ...keys) => { for (const k of keys) if (t[k]) return t[k]; return ''; };
        const responsables = [...new Set(data.map(t => get(t,'Responsable','responsable')).filter(Boolean))].sort();
        const cur = respSelect.value;
        respSelect.innerHTML = '<option value="">— Todos —</option>' +
            responsables.map(r => `<option value="${r}" ${r===cur?'selected':''}>${r}</option>`).join('');
    }
};
