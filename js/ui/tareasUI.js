// ============================================================
//  js/ui/tareasUI.js
//  Renderizado UI de Tareas y Mantenimiento
// ============================================================

Object.assign(window.ui, {
    renderizarSelectorVisualizador(containerId, modulo, onchange) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const session = api.getSession();
        if (!['admin', 'supervisor', 'visualizador'].includes(session.rol)) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        
        // Obtener lista única de usuarios de todos los datos de tareas
        const appState = window.MainApp.state;
        const allTasks = [...appState.tareasRecurrentes, ...appState.tareasSemanales, ...appState.planPreventivo, ...appState.bitacora, ...appState.usuariosPreventivo];
        
        let usersRaw = [];
        allTasks.forEach(t => {
            const uSys = (t.UsuarioSistema || t.usuariosistema || t.UsuarioSistemas || t.usuariosistemas || '').toString().trim();
            const uNom = (t.Nombre || t.nombre || t.Usuario || t.usuario || '').toString().trim();
            if (uSys) usersRaw.push(uSys);
            if (uNom) usersRaw.push(uNom);
        });
        
        // Mantener solo valores únicos y válidos
        let uniqueUsers = [...new Set(usersRaw)].filter(u => u !== '' && u.toLowerCase() !== 'admin');

        // AISLAMIENTO: Si no es Admin, el usuario solo puede verse a sí mismo en el selector
        const curUserLogin = (session.usuario || '').trim().toLowerCase();
        const curUserName = (session.nombre || '').trim().toLowerCase();
        const isAdminStrict = session.rol === 'admin';
        
        let users = [];
        if (isAdminStrict) {
            users = uniqueUsers;
        } else if (session.rol === 'supervisor') {
            // El supervisor SOLO ve a sus técnicos (Yolfranlle y Danny), NO se ve a sí mismo
            const supervisorId = (session.usuario || '').toLowerCase().trim();
            const supervisorName = (session.nombre || '').toLowerCase().trim();

            const targetTechs = ['yolfranlle', 'danny'];
            
            // 1. Buscamos en la lista global de usuarios detectados (uniqueUsers)
            users = uniqueUsers.filter(u => {
                const low = u.toLowerCase();
                // Excluir al supervisor
                if (low === supervisorId || low === supervisorName || low.includes('ingrid')) return false;
                
                // Incluir solo si es uno de los técnicos objetivo
                return targetTechs.some(tech => low.includes(tech));
            });

            // 2. Si no hay coincidencias en las tareas, buscamos en el directorio preventivo
            if (users.length < 2) {
                (appState.usuariosPreventivo || []).forEach(u => {
                    const n = (u.Nombre || u.nombre || '').trim();
                    const s = (u.UsuarioSistema || u.usuariosistema || u.UsuarioTecnico || u.usuariotecnico || '').trim();
                    
                    [n, s].forEach(val => {
                        if (val && targetTechs.some(tech => val.toLowerCase().includes(tech))) {
                            if (!users.some(ext => ext.toLowerCase() === val.toLowerCase())) {
                                users.push(val);
                            }
                        }
                    });
                });
            }

            // 3. Fallback final: Si siguen sin aparecer, los forzamos
            targetTechs.forEach(tech => {
                if (!users.some(u => u.toLowerCase().includes(tech))) {
                    users.push(tech);
                }
            });

            // Limpieza extra: asegurar que NUNCA aparezca ingrid ni admin
            users = users.filter(u => {
                const l = u.toLowerCase();
                return l !== supervisorId && l !== supervisorName && !l.includes('ingrid') && l !== 'admin';
            });
        } else {
            // Otros roles (Usuario, Visualizador) solo se ven a sí mismos
            users = uniqueUsers.filter(u => u.toLowerCase() === curUserLogin || u.toLowerCase() === curUserName);
            if (users.length === 0) users = [session.usuario];
        }

        // Unificar nombres y limpiar duplicados (Case-insensitive)
        const userSet = new Set();
        const finalUsers = [];
        users.forEach(u => {
            if (!userSet.has(u.toLowerCase())) {
                userSet.add(u.toLowerCase());
                finalUsers.push(u);
            }
        });

        users = finalUsers.sort();
        
        let currentSelected = appState[`selectedUser_${modulo}`] || '';
        if (currentSelected === '' && !isAdminStrict && users.length > 0) {
            currentSelected = users[0];
            appState[`selectedUser_${modulo}`] = currentSelected;
        }

        container.innerHTML = `
            <label><i class="fa-solid fa-filter"></i> Ver tareas de:</label>
            <select onchange="window.MainApp.handleVisualizerUserChange('${modulo}', this.value)">
                ${isAdminStrict ? '<option value="">— Ver Todos —</option>' : ''}
                ${users.map(u => `<option value="${u}" ${u.toLowerCase() === currentSelected.toLowerCase() ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
        `;
    },

    // ==========================================
    // ── V3.0 RENDERERS ──
    // ==========================================
    
    renderizarTareasMensualesV3(tareas) {
        const tbody = document.getElementById('tbody-tareas-mensuales');
        if (!tbody) return;
        tbody.innerHTML = '';

        this.renderizarSelectorVisualizador('visualizer-filter-recurrentes', 'recurrentes');

        const session = api.getSession();
        const isAdminStrict = session.rol === 'admin';
        
        let selectedUsr = (window.MainApp.state.selectedUser_recurrentes || '').toLowerCase().trim();
        if (!isAdminStrict && selectedUsr === '') {
            selectedUsr = (session.usuario || '').toLowerCase().trim();
        }
        
        const fNom = document.getElementById('filter-tm-nombre') ? document.getElementById('filter-tm-nombre').value.toLowerCase().trim() : '';
        const fMes = document.getElementById('filter-tm-mes') ? document.getElementById('filter-tm-mes').value : '';
        const fEst = document.getElementById('filter-tm-estado') ? document.getElementById('filter-tm-estado').value : '';

        const filtrado = tareas.filter(t => {
            const tUsr = (t.UsuarioSistema || t.usuariosistema || '').toLowerCase().trim();
            const tNom = (t.Nombre || t.nombre || '').toLowerCase().trim();
            
            if (selectedUsr !== '' && tUsr !== selectedUsr && tNom !== selectedUsr) return false;
            
            if (fNom && !tNom.includes(fNom)) return false;
            if (fMes && String(t.Mes) !== String(fMes)) return false;
            if (fEst && String(t.Estado) !== String(fEst)) return false;
            return true;
        });

        if (filtrado.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No se encontraron tareas</td></tr>';
            return;
        }

        // Agrupar filtrado por Nombre
        const grupos = {};
        filtrado.forEach(t => {
            const nom = t.Nombre || 'Sin Nombre';
            if (!grupos[nom]) grupos[nom] = [];
            grupos[nom].push(t);
        });

        const mesesStr = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        let groupIndex = 0;

        for (const [nombreGrupo, items] of Object.entries(grupos)) {
            groupIndex++;
            const groupId = 'grupo-tm-' + groupIndex;
            
            // Header del Acordeón
            const finCount = items.filter(t => t.Estado === 'Finalizada').length;
            const allFinished = finCount === items.length && items.length > 0;
            const badgeBg = allFinished ? '#ecfdf5' : '#f8fafc';
            const badgeColor = allFinished ? '#10b981' : '#64748b';

            const hr = document.createElement('tr');
            hr.style.cursor = 'pointer';
            hr.style.background = '#f1f5f9';
            hr.onclick = () => {
                const rows = document.querySelectorAll('.' + groupId);
                let isOpen = false;
                rows.forEach(r => {
                    if (r.style.display === 'none') {
                        r.style.display = 'table-row';
                        isOpen = true;
                    } else {
                        r.style.display = 'none';
                    }
                });
                const icon = hr.querySelector('.fa-chevron-right, .fa-chevron-down');
                if (icon) {
                    if (isOpen) {
                        icon.classList.remove('fa-chevron-right');
                        icon.classList.add('fa-chevron-down');
                    } else {
                        icon.classList.remove('fa-chevron-down');
                        icon.classList.add('fa-chevron-right');
                    }
                }
            };
            
            hr.innerHTML = `
                <td colspan="6" style="padding: 12px; font-weight: 600; border-bottom: 2px solid #e2e8f0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <i class="fa-solid fa-chevron-right" style="margin-right: 8px; color: #64748b; width: 14px;"></i>
                            ${utils.escHtml(nombreGrupo)} 
                        </div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <span style="font-size: 0.85em; color: ${badgeColor}; background: ${badgeBg}; padding: 2px 8px; border-radius: 12px; border: 1px solid #cbd5e1;">
                                ${finCount} / ${items.length} Finalizadas
                            </span>
                            <button class="action-btn del" onclick="event.stopPropagation(); MainApp.eliminarTareaMensualGrupo('${utils.escAttr(nombreGrupo)}')" title="Eliminar Grupo Completo">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(hr);

            // Ordenar por mes y renderizar los registros (ocultos inicialmente)
            items.sort((a, b) => {
                const mesA = a.Mes || a.mes || a.MES || 0;
                const mesB = b.Mes || b.mes || b.MES || 0;
                return Number(mesA) - Number(mesB);
            });

            items.forEach(t => {
                // Normalización robusta de campos
                const mesVal = t.Mes || t.mes || t.MES || "";
                const mesName = mesesStr[Number(mesVal) - 1] || mesVal || '?';
                
                const estado = t.Estado || t.estado || "Pendiente";
                const fCreacion = t.FechaCreacion || t.fechacreacion || "N/A";
                const fFinRaw = t.FechaFinalizacion || t.fechafinalizacion || "N/A";
                const fFin = fFinRaw.length > 10 ? fFinRaw.split('T')[0] : fFinRaw;
                
                const idTarea = t.id || t.ID || "";

                const estadoCls = estado === 'Finalizada' ? 'status-success' : 'status-warning';
                
                const tr = document.createElement('tr');
                tr.className = groupId;
                tr.style.display = 'none'; // Oculto por defecto
                tr.innerHTML = `
                    <td style="padding-left: 20px;"><input type="checkbox" class="tm-check" value="${idTarea}"></td>
                    <td><span style="color:#64748b;">${utils.escHtml(t.Nombre || t.nombre || "Sin nombre")}</span></td>
                    <td><span class="category-tag">${mesName}</span></td>
                    <td style="font-size:0.85em; color:#64748b;">Creación: ${fCreacion}<br>Fin: ${fFin}</td>
                    <td><span class="status-badge ${estadoCls}">${utils.escHtml(estado)}</span></td>
                    <td>
                        <button class="action-btn del" onclick="MainApp.eliminarTareaMensual('${idTarea}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    },

    renderizarTareasSemanalesV3(tareas) {
        const tbody = document.getElementById('tbody-tareas-semanales');
        if (!tbody) return;
        tbody.innerHTML = '';

        this.renderizarSelectorVisualizador('visualizer-filter-semanales', 'semanales');

        const session = api.getSession();
        const isAdminStrict = session.rol === 'admin';
        
        let selectedUsr = (window.MainApp.state.selectedUser_semanales || '').toLowerCase().trim();
        if (!isAdminStrict && selectedUsr === '') {
            selectedUsr = (session.usuario || '').toLowerCase().trim();
        }
        
        const fNom = document.getElementById('filter-ts-nombre') ? document.getElementById('filter-ts-nombre').value.toLowerCase().trim() : '';
        const fSem = document.getElementById('filter-ts-semana') ? document.getElementById('filter-ts-semana').value : '';
        const fEst = document.getElementById('filter-ts-estado') ? document.getElementById('filter-ts-estado').value : '';

        const filtrado = tareas.filter(t => {
            const tUsr = (t.UsuarioSistema || t.usuariosistema || '').toLowerCase().trim();
            const tNom = (t.Nombre || t.nombre || '').toLowerCase().trim();
            if (selectedUsr !== '' && tUsr !== selectedUsr && tNom !== selectedUsr) return false;

            if (fNom && !tNom.includes(fNom)) return false;
            if (fSem && String(t.Semana) !== String(fSem)) return false;
            if (fEst && String(t.Estado) !== String(fEst)) return false;
            return true;
        });

        if (filtrado.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No se encontraron tareas</td></tr>';
            return;
        }

        filtrado.forEach(t => {
            const estadoCls = t.Estado === 'Finalizada' ? 'status-success' : 'status-warning';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="ts-check" value="${t.id}"></td>
                <td><strong>${utils.escHtml(t.Nombre)}</strong></td>
                <td style="font-size:0.85em; color:#64748b;">Creación: ${t.FechaCreacion || 'N/A'}<br>Fin: ${t.FechaFinalizacion || 'N/A'}</td>
                <td><span class="status-badge ${estadoCls}">${utils.escHtml(t.Estado)}</span></td>
                <td>
                    <button class="action-btn" onclick="MainApp.abrirModalLogs('${t.id}')" title="Reportes Diarios" style="background:#6366f1; color:white;"><i class="fa-solid fa-clipboard-list"></i></button>
                    <button class="action-btn edit" onclick="MainApp.editarTareaSemanalV3('${t.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn del" onclick="MainApp.eliminarTareaSemanalV3('${t.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderizarLogsDiarios(logs) {
        const tbody = document.getElementById('tbody-logs-diarios');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No hay reportes diarios para esta tarea</td></tr>';
            return;
        }

        const sortedLogs = [...logs].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        sortedLogs.forEach((log, idx) => {
            let duracion = '-';
            if (log.inicio && log.fin) {
                const [h1, m1] = log.inicio.split(':').map(Number);
                const [h2, m2] = log.fin.split(':').map(Number);
                let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                if (diff < 0) diff += 24 * 60;
                const hrs = Math.floor(diff / 60);
                const mins = diff % 60;
                duracion = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${log.fecha}</td>
                <td>${log.inicio}</td>
                <td>${log.fin}</td>
                <td><strong>${duracion}</strong></td>
                <td>
                    <button class="action-btn del" onclick="MainApp.eliminarLogDiario(${idx})" title="Eliminar Log"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            if (log.notas) {
                const trNota = document.createElement('tr');
                trNota.innerHTML = `<td colspan="5" style="font-size:0.8rem; color:#64748b; padding-top:0; border-top:none;">📝 ${utils.escHtml(log.notas)}</td>`;
                tbody.appendChild(tr);
                tbody.appendChild(trNota);
            } else {
                tbody.appendChild(tr);
            }
        });
    },

    // Matriz Preventivo: filas = usuarios, columnas = meses × semanas
    renderizarPreventivoV3(registros) {
        // Alias para compatibilidad interna — delegamos a la nueva función
        window.MainApp && window.MainApp.renderizarPreventivoMatriz
            ? window.MainApp.renderizarPreventivoMatriz()
            : this.renderizarMatrizPreventivo(registros, window.MainApp ? window.MainApp.state.usuariosPreventivo : []);
    },

    renderizarMatrizPreventivo(registros, usuarios) {
        const wrap = document.getElementById('prev-matrix-wrap');
        if (!wrap) return;

        // Renderizar selector si es visualizador/supervisor/admin
        this.renderizarSelectorVisualizador('visualizer-filter-preventivo', 'preventivo');

        const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const SEMANAS = [1, 2, 3, 4];

        const session = api.getSession();
        const isAdminStrict = session.rol === 'admin';
        const curUser = (session.usuario || '').toLowerCase().trim();
        
        // Si no es admin estricto, forzamos que se vea solo lo propio por defecto
        let selectedUsr = (window.MainApp.state.selectedUser_preventivo || '').toLowerCase().trim();
        if (!isAdminStrict && selectedUsr === '') {
            selectedUsr = curUser;
        }

        const fUsr = (document.getElementById('filter-prev-usuario') || {}).value?.toLowerCase().trim() || '';
        const fAre = (document.getElementById('filter-prev-area') || {}).value?.toLowerCase().trim() || '';

        let usuariosFiltrados = (usuarios || []).filter(u => {
            const nombre = (u.Nombre || u.nombre || u.Usuario || '').toLowerCase();
            const area = (u.Area || u.area || '').toLowerCase();
            const usuSist = (u.UsuarioSistema || u.usuariosistema || '').toLowerCase();
            
            // Filtro por selector (para supervisor/admin)
            // Si el selector está vacío (Admin o Supervisor viendo todo), permitimos pasar
            if (selectedUsr === '') return true;

            // Si hay selección, la fila (técnico) debe coincidir con la selección
            // O el técnico debe pertenecer al supervisor seleccionado
            const coincideNombre = nombre.includes(selectedUsr);
            const coincideUsuario = usuSist.includes(selectedUsr);
            
            // Si el Supervisor se selecciona a SI MISMO en el dropdown, debe ver a todos sus técnicos
            // usuSist es el supervisor del tecnico
            const esMio = usuSist === selectedUsr;

            if (coincideNombre || coincideUsuario || esMio) return true;
            
            return false;
            
            // Filtro por búsqueda manual
            return (!fUsr || nombre.includes(fUsr)) && (!fAre || area.includes(fAre));
        });

        if (usuariosFiltrados.length === 0) {
            wrap.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-users" style="font-size:2rem;opacity:0.3;"></i><p style="margin-top:12px;">No hay usuarios en el directorio. Agrégalos en "Responsables / Equipos" o usa el formulario de arriba.</p></div>';
            return;
        }

        // Construir índice de registros: key = "uid_mes_semana"
        const idx = {};
        
        (registros || []).forEach(r => {
            // Normalización extrema de los campos clave
            const uid = String(r.UsuarioId || r.usuarioid || r.Usuario || r.usuario || '').trim();
            
            // Extraer Mes y Semana buscando en múltiples variantes de nombres de columna
            let mN = r.Mes || r.mes || r.MES || 0;
            let sN = r.Semana || r.semana || r.SEMANA || 0;

            // Si no se encontraron por nombre directo, intentar el "Modo Carroñero" simplificado
            if (!mN || !sN) {
                for (let key in r) {
                    const kLow = key.toLowerCase();
                    if (!mN && kLow.includes('mes')) mN = r[key];
                    if (!sN && kLow.includes('sem')) sN = r[key];
                }
            }

            // Asegurar que sean números limpios
            const mesFinal = parseInt(mN) || 0;
            const semFinal = parseInt(sN) || 0;

            if (uid && mesFinal >= 1 && mesFinal <= 12 && semFinal >= 1 && semFinal <= 4) {
                // Guardamos metadatos para depuración visual si fuera necesario
                r._mesDetectado = mesFinal;
                r._semDetectada = semFinal;
                // La clave del índice debe ser idéntica a la que usará el generador de la tabla
                idx[`${uid}_${mesFinal}_${semFinal}`] = r;
            }
        });

        let html = '<table style="border-collapse:separate; border-spacing:0; font-size:0.78rem; table-layout:fixed; width:2430px; border:1px solid #e4e9f5;">';
        
        // Estabilización de columnas con colgroup
        html += '<colgroup>';
        html += '<col style="width:160px;">';
        html += '<col style="width:110px;">';
        for(let i=0; i<48; i++) html += '<col style="width:45px;">';
        html += '</colgroup>';

        // Header row 1: Meses
        html += '<thead><tr>';
        html += '<th rowspan="2" style="position:sticky; left:0; top:0; background:#e8ecf5; z-index:20; padding:10px 14px; text-align:left; color:#475569; border-right:1px solid #cbd5e1; border-bottom:1px solid #cbd5e1;">Usuario</th>';
        html += '<th rowspan="2" style="position:sticky; left:160px; top:0; background:#e8ecf5; z-index:20; padding:10px 8px; text-align:left; color:#475569; border-right:1px solid #cbd5e1; border-bottom:1px solid #cbd5e1;">Área</th>';
        MESES.forEach(m => {
            html += `<th colspan="4" style="text-align:center; background:#6366f1; color:#fff; padding:6px; font-weight:700; border-right:1px solid rgba(255,255,255,0.1); border-bottom:1px solid rgba(255,255,255,0.1);">${m}</th>`;
        });
        html += '</tr><tr>';
        MESES.forEach(() => {
            SEMANAS.forEach(s => {
                html += `<th style="text-align:center; background:#f1f5f9; padding:5px 3px; color:#64748b; font-size:0.68rem; border-right:1px solid #cbd5e1; border-bottom:1px solid #cbd5e1;">S${s}</th>`;
            });
        });
        html += '</tr></thead><tbody>';

        // Data rows
        usuariosFiltrados.forEach((u, i) => {
            const nombre = utils.escHtml(u.Nombre || u.nombre || u.Usuario || u.usuario || 'Sin Nombre');
            const area = utils.escHtml(u.Area || u.area || '');
            const uid = u.id || u.Id || '';
            const bg = i % 2 === 0 ? '#ffffff' : '#f8faff';

            html += `<tr style="background:${bg};">`;
            html += `<td style="position:sticky; left:0; background:${bg}; z-index:1; padding:8px 14px; font-weight:600; color:#1e293b; border-bottom:1px solid #e4e9f5;">
                        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${nombre}</span>
                            <i class="fa-solid fa-trash-can" style="color:#fca5a5; cursor:pointer; font-size:0.75rem; opacity:0.6; padding-left:5px;" title="Eliminar usuario" onclick="event.stopPropagation(); MainApp.eliminarUsuarioPreventivo('${uid}', '${nombre.replace(/'/g,"\\'")}');"></i>
                        </div>
                    </td>`;
            html += `<td style="position:sticky; left:160px; background:${bg}; z-index:1; padding:8px 8px; color:#64748b; border-bottom:1px solid #e4e9f5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${area}</td>`;

            for (let m = 1; m <= 12; m++) {
                for (let s = 1; s <= 4; s++) {
                    const nameKey = (u.Nombre || u.nombre || u.Usuario || u.usuario || '');
                    const keyId = `${uid}_${m}_${s}`;
                    const keyName = `${nameKey}_${m}_${s}`;
                    const reg = idx[keyId] || idx[keyName];
                    const hecho = !!reg;
                    // Rescate de fecha (Prioridad al campo real, luego al rescatado del desorden)
                    const fechaRaw = reg ? (reg.FechaRealizacion || reg.fecha || reg._fechaRescate || '') : '';
                    const fecha = (fechaRaw && fechaRaw.includes('T')) ? fechaRaw.split('T')[0] : fechaRaw;
                    const fParts = fecha ? fecha.split('-') : [];
                    const fechaShort = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}` : (fecha || ''); 
                    
                    const hora = reg ? (reg.HoraRealizacion || reg.hora || '') : '';
                    const title = hecho ? `Realizado: ${fecha} ${hora}` : 'Clic para registrar';
                    const cursor = 'cursor:pointer;';
                    const cellBg = hecho ? '#d1fae5' : 'transparent';
                    const content = hecho
                        ? `<span style="color:#059669;font-size:0.75rem;font-weight:700;">✓<br>${fechaShort}</span>`
                        : `<span style="color:#cbd5e1;font-size:1rem;">·</span>`;

                    html += `<td onclick="MainApp.abrirModalPrevReg('${uid}','${nombre.replace(/'/g,"\\'")}','${m}','${s}')" title="${title}" style="text-align:center;padding:4px 2px;border:1px solid #e4e9f5;${cursor}background:${cellBg};">${content}</td>`;
                }
            }
            html += '</tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;
    },

    
    renderizarDashboardTareas(state) {
        if (!document.getElementById('view-tareas-dashboard')) return;

        this.renderizarSelectorVisualizador('visualizer-filter-dashboard', 'dashboard');

        const session = api.getSession();
        const isAdminStrict = session.rol === 'admin';
        const curUser = (session.usuario || '').toLowerCase().trim();
        
        // Si no es admin estricto, forzamos aislamiento en Dashboard
        let selectedUsr = (window.MainApp.state.selectedUser_dashboard || '').toLowerCase().trim();
        if (!isAdminStrict && selectedUsr === '') {
            selectedUsr = curUser;
        }

        const filterByUser = (arr) => {
            if (selectedUsr === '') return arr;
            return arr.filter(t => {
                const u = (t.UsuarioSistema || t.usuariosistema || '').toLowerCase().trim();
                const n = (t.Nombre || t.nombre || '').toLowerCase().trim();
                return u === selectedUsr || n === selectedUsr;
            });
        };

        const tRec = filterByUser(state.tareasRecurrentes);
        const tSem = filterByUser(state.tareasSemanales);
        const pPrev = filterByUser(state.planPreventivo);

        // KPI Calculations
        const menTotal = tRec.length;
        const menFin = tRec.filter(t => t.Estado === 'Finalizada').length;
        const semTotal = tSem.length;
        const semFin = tSem.filter(t => t.Estado === 'Finalizada').length;
        const preTotal = pPrev.length;
        const preFin = pPrev.filter(t => t.Estado === 'Realizado').length;

        const totalGlobal = menTotal + semTotal + preTotal;
        const finGlobal = menFin + semFin + preFin;
        const pendGlobal = totalGlobal - finGlobal;
        const eficiencia = totalGlobal > 0 ? Math.round((finGlobal / totalGlobal) * 100) : 0;

        // Render KPI Cards
        const kpiContainer = document.getElementById('dashboard-kpi-container');
        if (kpiContainer) {
            kpiContainer.innerHTML = `
                <div class="kpi-card">
                    <div class="kpi-icon blue"><i class="fa-solid fa-list-check"></i></div>
                    <div>
                        <div class="kpi-value">${totalGlobal}</div>
                        <div class="kpi-label">Total Tareas</div>
                    </div>
                    <div class="kpi-trend neutral"><i class="fa-solid fa-circle-info"></i> Actividades hoy</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon green"><i class="fa-solid fa-check-double"></i></div>
                    <div>
                        <div class="kpi-value">${finGlobal}</div>
                        <div class="kpi-label">Completadas</div>
                    </div>
                    <div class="kpi-trend up"><i class="fa-solid fa-arrow-up"></i> ${finGlobal > 0 ? 'Progreso activo' : 'Sin iniciar'}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon orange"><i class="fa-solid fa-clock"></i></div>
                    <div>
                        <div class="kpi-value">${pendGlobal}</div>
                        <div class="kpi-label">Pendientes</div>
                    </div>
                    <div class="kpi-trend neutral"><i class="fa-solid fa-hourglass-half"></i> Requiere atención</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon purple"><i class="fa-solid fa-gauge-high"></i></div>
                    <div>
                        <div class="kpi-value">${eficiencia}%</div>
                        <div class="kpi-label">Eficiencia Final</div>
                    </div>
                    <div class="kpi-trend up"><i class="fa-solid fa-rocket"></i> Cumplimiento</div>
                </div>
            `;
        }

        const updateEfficiencyUI = (prefix, fin, total) => {
            const perc = total > 0 ? Math.round((fin / total) * 100) : 0;
            const badge = document.getElementById(`eff-${prefix}`);
            const bar = document.getElementById(`prog-${prefix}`);
            if (badge) badge.textContent = `${perc}%`;
            if (bar) bar.style.width = `${perc}%`;
            return perc;
        };

        const eMen = updateEfficiencyUI('mensual', menFin, menTotal);
        const eSem = updateEfficiencyUI('semanal', semFin, semTotal);
        const ePre = updateEfficiencyUI('preventivo', preFin, preTotal);

        const renderPie = (canvasId, fin, total, color) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const pend = total - fin;
            const ctx = canvas.getContext('2d');
            if (this[canvasId+'Instance']) this[canvasId+'Instance'].destroy();
            
            this[canvasId+'Instance'] = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Completado', 'Pendiente'],
                    datasets: [{
                        data: [fin, pend],
                        backgroundColor: [color, '#f1f5f9'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    cutout: '75%',
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        };

        renderPie('chart-mensuales', menFin, menTotal, '#3b82f6');
        renderPie('chart-semanales', semFin, semTotal, '#10b981');
        renderPie('chart-preventivo', preFin, preTotal, '#f59e0b');
    },
    
    renderizarBitacoraV3(registros) {
        const container = this.els.getBitacoraGrid();
        if (!container) return;
        container.innerHTML = '';

        this.renderizarSelectorVisualizador('visualizer-filter-bitacora', 'bitacora');

        const session = api.getSession();
        const isAdmin = session.rol === 'admin';
        const isSupervisor = session.rol === 'supervisor';
        const isVisualizer = session.rol === 'visualizador';
        const curUser = (session.usuario || '').toLowerCase().trim();
        
        let selectedUsr = (window.MainApp.state.selectedUser_bitacora || '').toLowerCase().trim();
        // Si no es admin/supervisor, forzamos ver solo lo propio
        if (!isAdmin && !isSupervisor && selectedUsr === '') {
            selectedUsr = curUser;
        }

        const filtrado = registros.filter(b => {
            const bUsr = String(b.UsuarioSistema || b.UsuarioSistemas || b.usuariosistema || b.usuariosistemas || b.Usuario || b.usuario || '').toLowerCase().trim();
            
            // Administradores ven todo. Supervisores solo su equipo.
            if (isAdmin) {
                if (selectedUsr !== '' && bUsr !== selectedUsr) return false;
                return true;
            }
            if (isSupervisor) {
                const misTecs = (window.MainApp.state.usuariosPreventivo || [])
                    .filter(u => (u.UsuarioSistema || u.usuariosistema || '').toLowerCase().trim() === curUser);
                
                const misTecNames = misTecs.map(u => (u.Nombre || u.nombre || '').trim().toLowerCase());
                const misTecSystem = misTecs.map(u => (u.UsuarioTecnico || u.usuariotecnico || '').trim().toLowerCase());

                const esDeMiEquipo = bUsr === curUser || misTecNames.includes(bUsr) || misTecSystem.includes(bUsr);
                
                if (selectedUsr !== '') {
                    return bUsr === selectedUsr && esDeMiEquipo;
                }
                return esDeMiEquipo;
            }
            
            // Otros (Usuarios o Visualizadores) ven lo propio o lo seleccionado si tienen permiso
            if (isVisualizer) {
                if (selectedUsr !== '' && bUsr !== selectedUsr) return false;
                return true;
            }

            // Usuarios normales: SOLO lo propio
            return bUsr === curUser || bUsr === '';
        });

        if (filtrado.length === 0) {
            container.innerHTML = `
                <div class="mant-empty" style="grid-column:1/-1;">
                    <i class="fa-solid fa-images"></i>
                    <p>No hay evidencias registradas en Drive.</p>
                </div>`;
            return;
        }

        filtrado.forEach(b => {
            const card = document.createElement('div');
            card.className = 'bitacora-card';
            
            let btnAction = '';
            if (b.DriveUrl) {
                // Si es un enlace de Drive lo abrimos en nueva pestaña
                btnAction = `<a href="${utils.escAttr(b.DriveUrl)}" target="_blank" class="btn btn-outline" style="width:100%; text-align:center; margin-top:10px;"><i class="fa-brands fa-google-drive" style="color:#10b981;"></i> Abrir Evidencia</a>`;
            } else {
                btnAction = `<button disabled class="btn btn-outline" style="width:100%; border-color:#e2e8f0; color:#94a3b8;"><i class="fa-solid fa-unlink"></i> Sin archivo</button>`;
            }

            card.innerHTML = `
                <div class="bitacora-content" style="padding: 16px;">
                    <h3 style="margin-top:0; margin-bottom:8px; font-size:1.1rem; color:#0f172a;">${utils.escHtml(b.Titulo || 'Evidencia')}</h3>
                    <div style="font-size:0.8rem; background:#f1f5f9; padding:4px 8px; border-radius:4px; margin-bottom:12px; display:inline-block; font-family:monospace;">
                        🔗 ${utils.escHtml(b.AsociadoA || 'Ninguna')}
                    </div>
                    <div class="bitacora-date" style="margin-bottom:8px;"><i class="fa-regular fa-calendar"></i> ${utils.formatearFecha(b.Fecha)}</div>
                    <div class="bitacora-desc" style="color:#475569; font-size:0.9rem; margin-bottom:16px;">${utils.escHtml(b.Descripcion)}</div>
                    ${btnAction}
                </div>
            `;
            container.appendChild(card);
        });
    },

    renderizarGrafica(productos, chartInstance) {
        const ctx = document.getElementById('inventoryChart').getContext('2d');
        const labels = productos.map(p => p.Nombre && p.Nombre.length > 20 ? p.Nombre.substring(0, 20) + '…' : (p.Nombre || 'N/A'));
        const data = productos.map(p => Number(p.Cantidad) || 0);

        const bgColors = data.map(qty => {
            if (qty <= 5) return 'rgba(239,68,68,0.75)';
            if (qty <= 20) return 'rgba(245,158,11,0.75)';
            return 'rgba(16,185,129,0.75)';
        });
        const borderColors = bgColors.map(c => c.replace('0.75', '1'));

        if (chartInstance) {
            chartInstance.data.labels = labels;
            chartInstance.data.datasets[0].data = data;
            chartInstance.data.datasets[0].backgroundColor = bgColors;
            chartInstance.data.datasets[0].borderColor = borderColors;
            chartInstance.update('active');
        } else {
            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Cantidad Disponible',
                        data,
                        backgroundColor: bgColors,
                        borderColor: borderColors,
                        borderWidth: 2,
                        borderRadius: 6,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => `  ${ctx.parsed.y} ${productos[ctx.dataIndex]?.Unidad || 'unid.'}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.06)' },
                            ticks: { color: '#94a3b8', font: { size: 12 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8', font: { size: 11 }, maxRotation: 40, minRotation: 20 }
                        }
                    }
                }
            });
        }

        // Resumen en tarjetas
        const grid = this.els.getSummaryGrid();
        if(grid) {
            grid.innerHTML = '';
            productos.forEach(p => {
                const qty = Number(p.Cantidad) || 0;
                let cls = qty > 20 ? 'sum-high' : qty > 5 ? 'sum-med' : 'sum-low';
                grid.innerHTML += `
                    <div class="sum-card ${cls}">
                        <span class="sum-name">${utils.escHtml(p.Nombre)}</span>
                        <span class="sum-qty">${qty}</span>
                        <span class="sum-unit">${utils.escHtml(p.Unidad)}</span>
                    </div>
                `;
            });
            if (productos.length === 0) grid.innerHTML = '<p class="empty-state">Sin productos.</p>';
        }
        
        return chartInstance;
    },

    renderizarSugerenciasInventario(productos) {
        // Esta función puede usarse para la vista de inventario si se añade el elemento al HTML
        const tbody = this.els.getInventarioTbody();
        if (!tbody) return;
        this.renderizarInventario(productos);
    },

    llenarSelectsEquipos(productos) {
        const selects = ['ts-equipo', 'prev-equipo'];
        selects.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const prev = sel.value;
            sel.innerHTML = `<option value="">-- Seleccionar Equipo --</option>`;
            
            // Ordenar por nombre
            const sorted = [...productos].sort((a,b) => (a.Nombre||'').localeCompare(b.Nombre||''));
            
            sorted.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.Nombre || p.ID;
                opt.textContent = `${p.Nombre} (${p.ID})`;
                sel.appendChild(opt);
            });
            if (prev) sel.value = prev;
        });
    },

    generarCheckboxesMeses() {
        const container = document.getElementById('tr-meses-checkboxes');
        if (!container) return;
        
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        
        container.innerHTML = '';
        meses.forEach((mes, idx) => {
            const num = idx + 1;
            const item = document.createElement('div');
            item.className = 'tr-mes-item';
            item.innerHTML = `
                <input type="checkbox" id="tr-mes-${num}" class="tr-mes-check" value="${num}">
                <label for="tr-mes-${num}">${mes}</label>
            `;
            container.appendChild(item);
        });
    },

    llenarSelectsProductos(productos) {
        ['entrada-producto', 'salida-producto'].forEach(selId => {
            const sel = document.getElementById(selId);
            if (!sel) return;
            const prev = sel.value;
            sel.innerHTML = '<option value="" disabled selected>— Seleccione un producto —</option>';
            productos.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.ID;
                opt.textContent = `${p.ID} — ${p.Nombre}`;
                sel.appendChild(opt);
            });
            if (prev && productos.some(p => String(p.ID) === prev)) sel.value = prev;
        });
    },

    renderizarResponsables(responsables) {
        const tbody = document.getElementById('tbody-usuarios-preventivo');
        if (!tbody) return;
        tbody.innerHTML = '';
        if(!responsables || responsables.length === 0){
             tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No hay usuarios dados de alta</td></tr>';
             return;
        }
        
        responsables.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
               <td><strong>${utils.escHtml(u.Nombre)}</strong></td>
               <td>${utils.escHtml(u.Area)}</td>
               <td><button class="action-btn del" onclick="MainApp.eliminarUsuarioPreventivo('${u.id || u.ID}', '${utils.escAttr(u.Nombre || 'Usuario')}')"><i class="fa-solid fa-trash"></i></button></td>
            `;
            tbody.appendChild(tr);
        });
    },

    _old_renderizarResponsables(responsables) { // just ignoring old signature

        const tbody = this.els.getResponsablesTbody();
        if (!tbody) return;
        tbody.innerHTML = '';
        
        // Renderizar selector si es visualizador
        this.renderizarSelectorVisualizador('visualizer-filter-responsables', 'responsables');

        const session = api.getSession();
        const usr = (session.usuario || '').toLowerCase().trim();
        const isSupervisor = session.rol === 'supervisor';
        const isAdmin = session.rol === 'admin' || isSupervisor;
        const isVisualizer = ['visualizador', 'admin', 'supervisor'].includes(session.rol);
        const selectedUsr = isVisualizer ? (window.MainApp.state.selectedUser_responsables || '').toLowerCase().trim() : '';

        const filtrado = responsables.filter(u => {
            const uUsr = String(u.UsuarioSistema || u.Usuariosistema || u.UsuarioSist || '').toLowerCase().trim();
            if (isAdmin) return true;
            if (isVisualizer && selectedUsr !== '') return uUsr === selectedUsr;
            return uUsr === '' || uUsr === usr;
        });

        if (!filtrado || filtrado.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay responsables para mostrar.</td></tr>';
            return;
        }

        filtrado.forEach(u => {
            const userName = u.Usuario || u.Nombre || '?';
            const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            const tr = document.createElement('tr');
            
            // Ocultar botón borrar para visualizadores
            const actionBtn = isVisualizer ? '' : `
                <button class="action-btn del" onclick="MainApp.eliminarResponsable('${utils.escAttr(u.id)}')" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            tr.innerHTML = `
                <td style="padding:12px; font-weight:500; color:var(--primary-color);">${utils.escHtml(u.Area || 'Gral')}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="prev-avatar" style="width:30px; height:30px; font-size:0.75rem;">${initials}</div>
                        <strong>${utils.escHtml(userName)}</strong>
                    </div>
                </td>
                <td>
                    <i class="fa-solid fa-laptop" style="opacity:0.5; margin-right:5px;"></i>
                    ${utils.escHtml(u.Equipo || 'N/A')}
                </td>
                <td>
                    ${actionBtn}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
});
