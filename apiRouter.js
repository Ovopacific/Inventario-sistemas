const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('./db');

// Middleware para parsear JSON y multipart/form-data o urlencoded si aplica
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper para responder
const sendSuccess = (res, data = { status: 'success' }) => res.json(data);
const sendError = (res, message, code = 400) => res.status(code).json({ error: message });

// Safe query helper
const safeAll = (sql, params = []) => allQuery(sql, params).catch(err => {
    console.error(`[SQL WARNING] Error en allQuery (${sql}):`, err.message || err);
    return [];
});

const safeGet = (sql, params = []) => getQuery(sql, params).catch(err => {
    console.error(`[SQL WARNING] Error en getQuery (${sql}):`, err.message || err);
    return null;
});

// ════════════════════════════════════════════════════════════
// GET ACTIONS
// ════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
    const action = req.query.action;

    try {
        if (action === 'getAllData') {
            const productos = await safeAll("SELECT * FROM productos");
            const entradas = await safeAll("SELECT * FROM entradas");
            const salidas = await safeAll("SELECT * FROM salidas");
            const entregas = await safeAll("SELECT * FROM entregas");
            const bitacora = await safeAll("SELECT * FROM bitacora");
            const tareasMensuales = await safeAll("SELECT * FROM tareas_mensuales");
            const usuariosPreventivo = await safeAll("SELECT * FROM usuarios_preventivo");
            const mantenimientoPreventivo = await safeAll("SELECT * FROM mantenimiento_preventivo");
            const tareasSemanalesRaw = await safeAll("SELECT * FROM tareas_semanales");
            const bitacoraEvidencias = await safeAll("SELECT * FROM bitacora_evidencias");
            const usuarios = await safeAll("SELECT Username as usuario, Nombre as nombre, Rol as rol FROM usuarios");
            const tareasBase = await safeAll("SELECT * FROM tareas_base");
            const seguimientoSemanalRaw = await safeAll("SELECT * FROM seguimiento_semanal");

            const tareasSemanales = tareasSemanalesRaw.map(t => {
                let logs = t.LogsDiarios;
                if (typeof logs === 'string' && (logs.startsWith('{') || logs.startsWith('['))) {
                    try { logs = JSON.parse(logs); } catch (e) {}
                }
                return { ...t, LogsDiarios: logs };
            });

            const seguimientoSemanal = seguimientoSemanalRaw.map(s => {
                let estados = s.Estados;
                if (typeof estados === 'string' && (estados.startsWith('{') || estados.startsWith('['))) {
                    try { estados = JSON.parse(estados); } catch (e) {}
                }
                return { ...s, Estados: estados };
            });

            return res.json({
                productos,
                entradas,
                salidas,
                entregas,
                bitacora,
                tareasMensuales,
                tareasRecurrentes: tareasMensuales,
                usuariosPreventivo,
                mantenimientoPreventivo,
                planPreventivo: mantenimientoPreventivo,
                tareasSemanales,
                bitacoraEvidencias,
                usuarios,
                tareasBase,
                checklistBase: tareasBase,
                seguimientoSemanal,
                checklistSeguimiento: seguimientoSemanal
            });
        }

        if (action === 'getChecklistOnly') {
            const tareasBase = await safeAll("SELECT * FROM tareas_base");
            const seguimientoSemanalRaw = await safeAll("SELECT * FROM seguimiento_semanal");

            const seguimientoSemanal = seguimientoSemanalRaw.map(s => {
                let estados = s.Estados;
                if (typeof estados === 'string' && (estados.startsWith('{') || estados.startsWith('['))) {
                    try { estados = JSON.parse(estados); } catch (e) {}
                }
                return { ...s, Estados: estados };
            });

            return res.json({
                tareasBase,
                checklistBase: tareasBase,
                seguimientoSemanal,
                checklistSeguimiento: seguimientoSemanal
            });
        }

        if (action === 'login') {
            const usuarioStr = (req.query.usuario || '').trim();
            const passwordStr = (req.query.password || '').trim();

            if (!usuarioStr) {
                return res.json({ success: false, error: 'Debe ingresar un usuario' });
            }

            const user = await safeGet(
                "SELECT Username as usuario, Nombre as nombre, Rol as rol FROM usuarios WHERE LOWER(Username) = LOWER(?) AND Password = ?",
                [usuarioStr, passwordStr]
            );

            if (user) {
                return res.json({ success: true, ...user });
            } else {
                return res.json({ success: false, error: 'Usuario o contraseña incorrectos' });
            }
        }

        return sendError(res, `Acción GET desconocida: ${action}`);
    } catch (err) {
        console.error("Error en GET /api:", err);
        return sendError(res, err.message, 500);
    }
});

// ════════════════════════════════════════════════════════════
// POST ACTIONS
// ════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
    let payload = req.body;

    // Si viene como FormData con un campo 'data'
    if (payload && payload.data && typeof payload.data === 'string') {
        try {
            payload = JSON.parse(payload.data);
        } catch (e) {}
    }

    const action = payload.action;
    if (!action) {
        return sendError(res, 'No se especificó ninguna acción POST');
    }

    try {
        // INVENTARIO: Guardar / Editar Producto
        if (action === 'guardarProducto') {
            const p = payload.producto || payload;
            await runQuery(
                `INSERT OR REPLACE INTO productos (ID, Nombre, Categoria, Descripcion, Cantidad, Unidad, FechaRegistro) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    String(p.ID || 'PROD-' + Date.now()),
                    String(p.Nombre || ''),
                    String(p.Categoria || ''),
                    String(p.Descripcion || ''),
                    Number(p.Cantidad || 0),
                    String(p.Unidad || 'Unidad'),
                    String(p.FechaRegistro || new Date().toISOString().split('T')[0])
                ]
            );
            return sendSuccess(res, { status: 'success', message: 'Producto guardado correctamente' });
        }

        // INVENTARIO: Eliminar Producto
        if (action === 'eliminarProducto') {
            const id = payload.id;
            await runQuery("DELETE FROM productos WHERE ID = ?", [String(id)]);
            return sendSuccess(res, { status: 'success', message: 'Producto eliminado' });
        }

        // INVENTARIO: Registrar Entrada
        if (action === 'registrarEntrada') {
            const m = payload.movimiento || payload;
            const idMov = 'ENT-' + Date.now();
            await runQuery(
                `INSERT INTO entradas (ID_Movimiento, ID_Producto, Nombre_Producto, Cantidad, Fecha, Observacion) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    idMov,
                    String(m.ID_Producto || ''),
                    String(m.Nombre_Producto || ''),
                    Number(m.Cantidad || 0),
                    String(m.Fecha || new Date().toISOString().split('T')[0]),
                    String(m.Observacion || '')
                ]
            );
            // Actualizar stock del producto
            await runQuery(
                `UPDATE productos SET Cantidad = Cantidad + ? WHERE ID = ?`,
                [Number(m.Cantidad || 0), String(m.ID_Producto)]
            );
            return sendSuccess(res, { status: 'success', id: idMov });
        }

        // INVENTARIO: Registrar Salida
        if (action === 'registrarSalida') {
            const m = payload.movimiento || payload;
            const idMov = 'SAL-' + Date.now();
            await runQuery(
                `INSERT INTO salidas (ID_Movimiento, ID_Producto, Nombre_Producto, Cantidad, Fecha, Observacion) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    idMov,
                    String(m.ID_Producto || ''),
                    String(m.Nombre_Producto || ''),
                    Number(m.Cantidad || 0),
                    String(m.Fecha || new Date().toISOString().split('T')[0]),
                    String(m.Observacion || '')
                ]
            );
            // Actualizar stock del producto
            await runQuery(
                `UPDATE productos SET Cantidad = MAX(0, Cantidad - ?) WHERE ID = ?`,
                [Number(m.Cantidad || 0), String(m.ID_Producto)]
            );
            return sendSuccess(res, { status: 'success', id: idMov });
        }

        // INVENTARIO: Registrar Entrega
        if (action === 'registrarEntrega') {
            const e = payload.entrega || payload;
            const idEnt = String(e.id || 'ENTR-' + Date.now());
            await runQuery(
                `INSERT OR REPLACE INTO entregas (id, Destinatario, Articulo, Cantidad, Fecha, Estado, Nombre, Descripcion) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    idEnt,
                    String(e.Destinatario || ''),
                    String(e.Articulo || ''),
                    Number(e.Cantidad || 0),
                    String(e.Fecha || new Date().toISOString().split('T')[0]),
                    String(e.Estado || 'Entregado'),
                    String(e.Nombre || e.Destinatario || ''),
                    String(e.Descripcion || '')
                ]
            );
            return sendSuccess(res, { status: 'success', id: idEnt });
        }

        // INVENTARIO: Eliminar Entrega
        if (action === 'eliminarEntrega') {
            await runQuery("DELETE FROM entregas WHERE id = ?", [String(payload.id)]);
            return sendSuccess(res, { status: 'success' });
        }

        // TAREAS: Agregar Grupo de Tareas Mensuales
        if (action === 'addTareaMensualGroup') {
            const nombre = payload.nombre || '';
            const meses = payload.meses || [];
            const user = payload.UsuarioSistema || payload.quien_registro || '';

            for (const m of meses) {
                const id = 'TM-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                await runQuery(
                    `INSERT INTO tareas_mensuales (id, Nombre, Mes, Estado, FechaCreacion, FechaFinalizacion, UsuarioSistema) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        nombre,
                        String(m),
                        'Pendiente',
                        new Date().toISOString().split('T')[0],
                        '',
                        user
                    ]
                );
            }
            return sendSuccess(res, { status: 'success' });
        }

        // TAREAS: Eliminar Grupo de Tareas Mensuales
        if (action === 'deleteTareaMensualGroup') {
            await runQuery("DELETE FROM tareas_mensuales WHERE LOWER(Nombre) = LOWER(?)", [String(payload.nombre)]);
            return sendSuccess(res, { status: 'success' });
        }

        // TAREAS: Eliminar Tarea Mensual
        if (action === 'deleteTareaMensual') {
            await runQuery("DELETE FROM tareas_mensuales WHERE id = ?", [String(payload.id)]);
            return sendSuccess(res, { status: 'success' });
        }

        // TAREAS: Actualizar Tarea Mensual
        if (action === 'updateTareaMensual') {
            const t = payload.tarea || payload;
            await runQuery(
                `UPDATE tareas_mensuales SET Nombre = ?, Mes = ?, Estado = ?, FechaCreacion = ?, FechaFinalizacion = ?, UsuarioSistema = ? WHERE id = ?`,
                [
                    String(t.Nombre || ''),
                    String(t.Mes || ''),
                    String(t.Estado || 'Pendiente'),
                    String(t.FechaCreacion || ''),
                    String(t.FechaFinalizacion || ''),
                    String(t.UsuarioSistema || ''),
                    String(t.id)
                ]
            );
            return sendSuccess(res, { status: 'success' });
        }

        // TAREAS: Agregar / Actualizar Tarea Semanal
        if (action === 'addTareaSemanal' || action === 'updateTareaSemanal') {
            const t = payload.tarea || payload;
            const id = String(t.id || 'TS-' + Date.now());
            const logsStr = typeof t.LogsDiarios === 'object' ? JSON.stringify(t.LogsDiarios) : String(t.LogsDiarios || '{}');

            await runQuery(
                `INSERT OR REPLACE INTO tareas_semanales (id, Nombre, Semana, FechaRealizacion, Estado, UsuarioSistema, FechaCreacion, FechaFinalizacion, LogsDiarios) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    String(t.Nombre || ''),
                    String(t.Semana || ''),
                    String(t.FechaRealizacion || ''),
                    String(t.Estado || 'Pendiente'),
                    String(t.UsuarioSistema || ''),
                    String(t.FechaCreacion || new Date().toISOString().split('T')[0]),
                    String(t.FechaFinalizacion || ''),
                    logsStr
                ]
            );
            return sendSuccess(res, { status: 'success', id });
        }

        // TAREAS: Eliminar Tarea Semanal
        if (action === 'deleteTareaSemanal') {
            await runQuery("DELETE FROM tareas_semanales WHERE id = ?", [String(payload.id)]);
            return sendSuccess(res, { status: 'success' });
        }

        // PREVENTIVO: Asignación Masiva
        if (action === 'addPreventivoMasivo') {
            const mes = String(payload.mes || '');
            const semana = String(payload.semana || '');
            const user = payload.UsuarioSistema || '';

            // Obtener todos los usuarios del directorio de preventivo
            const usuariosPrev = await safeAll("SELECT * FROM usuarios_preventivo");
            for (const u of usuariosPrev) {
                const id = 'PREV-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                await runQuery(
                    `INSERT INTO mantenimiento_preventivo (id, UsuarioId, Mes, Semana, FechaRealizacion, Estado, Estados, Notas, UsuarioSistema, Fecha) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        String(u.id),
                        mes,
                        semana,
                        '',
                        'Pendiente',
                        '{}',
                        '',
                        user,
                        new Date().toISOString().split('T')[0]
                    ]
                );
            }
            return sendSuccess(res, { status: 'success' });
        }

        // PREVENTIVO: Eliminar / Actualizar
        if (action === 'deletePreventivo') {
            await runQuery("DELETE FROM mantenimiento_preventivo WHERE id = ?", [String(payload.id)]);
            return sendSuccess(res, { status: 'success' });
        }

        if (action === 'updatePreventivo' || action === 'addRegistroPreventivo') {
            const p = payload.preventivo || payload;
            const id = String(p.id || 'PREV-' + Date.now());
            await runQuery(
                `INSERT OR REPLACE INTO mantenimiento_preventivo (id, UsuarioId, Mes, Semana, FechaRealizacion, Estado, Estados, Notas, UsuarioSistema, Fecha) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    String(p.UsuarioId || ''),
                    String(p.Mes || ''),
                    String(p.Semana || ''),
                    String(p.FechaRealizacion || ''),
                    String(p.Estado || 'Completado'),
                    String(p.Estados || '{}'),
                    String(p.Notas || ''),
                    String(p.UsuarioSistema || ''),
                    String(p.Fecha || new Date().toISOString().split('T')[0])
                ]
            );
            return sendSuccess(res, { status: 'success', id });
        }

        // USUARIOS PREVENTIVO
        if (action === 'addUsuarioPreventivo') {
            const u = payload.usuario || payload;
            const id = String(u.id || 'UPREV-' + Date.now());
            await runQuery(
                `INSERT OR REPLACE INTO usuarios_preventivo (id, Nombre, Area, UsuarioSistema) VALUES (?, ?, ?, ?)`,
                [id, String(u.Nombre || ''), String(u.Area || ''), String(u.UsuarioSistema || '')]
            );
            return sendSuccess(res, { status: 'success', id });
        }

        if (action === 'deleteUsuarioPreventivo') {
            await runQuery("DELETE FROM usuarios_preventivo WHERE id = ?", [String(payload.id)]);
            await runQuery("DELETE FROM mantenimiento_preventivo WHERE UsuarioId = ?", [String(payload.id)]);
            return sendSuccess(res, { status: 'success' });
        }

        // EVIDENCIAS / BITACORA
        if (action === 'uploadEvidencia') {
            const e = payload;
            const id = String('EVID-' + Date.now());
            await runQuery(
                `INSERT INTO bitacora_evidencias (id, Titulo, Descripcion, Fecha, ImagenBase64, UsuarioSistema) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    String(e.titulo || e.Titulo || ''),
                    String(e.descripcion || e.Descripcion || ''),
                    String(e.fecha || new Date().toISOString().split('T')[0]),
                    String(e.imagenBase64 || e.ImagenBase64 || ''),
                    String(e.UsuarioSistema || '')
                ]
            );
            return sendSuccess(res, { status: 'success', id });
        }

        // CHECKLIST / SEGUIMIENTO SEMANAL
        if (action === 'updateChecklist') {
            const item = payload.item || payload;
            const id = String(item.id || 'CHK-' + Date.now());
            const estadosStr = typeof item.Estados === 'object' ? JSON.stringify(item.Estados) : String(item.Estados || '{}');

            await runQuery(
                `INSERT OR REPLACE INTO seguimiento_semanal (id, TareaId, Nombre, Area, Responsable, Semana, Mes, L, M, M2, J, V, S, Estados, UsuarioSistema, Cerrada) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    String(item.TareaId || ''),
                    String(item.Nombre || ''),
                    String(item.Area || ''),
                    String(item.Responsable || ''),
                    String(item.Semana || ''),
                    String(item.Mes || ''),
                    String(item.L || ''),
                    String(item.M || ''),
                    String(item.M2 || ''),
                    String(item.J || ''),
                    String(item.V || ''),
                    String(item.S || ''),
                    estadosStr,
                    String(item.UsuarioSistema || ''),
                    String(item.Cerrada || 'NO')
                ]
            );
            return sendSuccess(res, { status: 'success', id });
        }

        if (action === 'eliminarChecklistItem') {
            await runQuery("DELETE FROM seguimiento_semanal WHERE id = ?", [String(payload.id)]);
            return sendSuccess(res, { status: 'success' });
        }

        return sendError(res, `Acción POST no soportada: ${action}`);
    } catch (err) {
        console.error("Error en POST /api:", err);
        return sendError(res, err.message, 500);
    }
});

module.exports = router;
