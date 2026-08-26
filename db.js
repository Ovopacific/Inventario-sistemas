const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Utilidad para ejecutar querys con Promises
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function initDB() {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // 1. Crear Tablas
                db.run(`CREATE TABLE IF NOT EXISTS productos (
                    ID TEXT PRIMARY KEY,
                    Nombre TEXT,
                    Categoria TEXT,
                    Descripcion TEXT,
                    Cantidad REAL,
                    Unidad TEXT,
                    FechaRegistro TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS entradas (
                    ID_Movimiento TEXT PRIMARY KEY,
                    ID_Producto TEXT,
                    Nombre_Producto TEXT,
                    Cantidad REAL,
                    Fecha TEXT,
                    Observacion TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS salidas (
                    ID_Movimiento TEXT PRIMARY KEY,
                    ID_Producto TEXT,
                    Nombre_Producto TEXT,
                    Cantidad REAL,
                    Fecha TEXT,
                    Observacion TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS entregas (
                    id TEXT PRIMARY KEY,
                    Destinatario TEXT,
                    Articulo TEXT,
                    Cantidad REAL,
                    Fecha TEXT,
                    Estado TEXT,
                    Nombre TEXT,
                    Descripcion TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS bitacora (
                    id TEXT PRIMARY KEY,
                    Titulo TEXT,
                    AsociadoA TEXT,
                    Fecha TEXT,
                    Descripcion TEXT,
                    DriveUrl TEXT,
                    UsuarioSistemas TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS tareas_mensuales (
                    id TEXT PRIMARY KEY,
                    Nombre TEXT,
                    Mes TEXT,
                    Estado TEXT,
                    FechaCreacion TEXT,
                    FechaFinalizacion TEXT,
                    UsuarioSistema TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS usuarios_preventivo (
                    id TEXT PRIMARY KEY,
                    Nombre TEXT,
                    Area TEXT,
                    UsuarioSistema TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS mantenimiento_preventivo (
                    id TEXT PRIMARY KEY,
                    UsuarioId TEXT,
                    Mes TEXT,
                    Semana TEXT,
                    FechaRealizacion TEXT,
                    Estado TEXT,
                    Estados TEXT,
                    Notas TEXT,
                    UsuarioSistema TEXT,
                    Fecha TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS tareas_semanales (
                    id TEXT PRIMARY KEY,
                    Nombre TEXT,
                    Semana TEXT,
                    FechaRealizacion TEXT,
                    Estado TEXT,
                    UsuarioSistema TEXT,
                    FechaCreacion TEXT,
                    FechaFinalizacion TEXT,
                    LogsDiarios TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS bitacora_evidencias (
                    id TEXT PRIMARY KEY,
                    Titulo TEXT,
                    Descripcion TEXT,
                    Fecha TEXT,
                    ImagenBase64 TEXT,
                    UsuarioSistema TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS usuarios (
                    Username TEXT PRIMARY KEY,
                    Password TEXT,
                    Nombre TEXT,
                    Rol TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS tareas_base (
                    id TEXT PRIMARY KEY,
                    Nombre TEXT,
                    Area TEXT,
                    Periocidad TEXT,
                    Responsable TEXT,
                    UsuarioSistema TEXT
                )`);

                db.run(`CREATE TABLE IF NOT EXISTS seguimiento_semanal (
                    id TEXT PRIMARY KEY,
                    TareaId TEXT,
                    Nombre TEXT,
                    Area TEXT,
                    Responsable TEXT,
                    Semana TEXT,
                    Mes TEXT,
                    L TEXT,
                    M TEXT,
                    M2 TEXT,
                    J TEXT,
                    V TEXT,
                    S TEXT,
                    Estados TEXT,
                    UsuarioSistema TEXT,
                    Cerrada TEXT
                )`);

                // 2. Verificar si se requiere migración inicial desde Excel
                const checkProd = await getQuery("SELECT COUNT(*) as count FROM productos");
                if (checkProd.count === 0) {
                    const excelPath = path.join(__dirname, 'Copia de inventario sistemas.xlsx');
                    if (fs.existsSync(excelPath)) {
                        console.log('Migrando datos iniciales desde Copia de inventario sistemas.xlsx...');
                        const workbook = xlsx.readFile(excelPath);
                        
                        const importSheet = async (sheetName, tableName, mapper) => {
                            if (workbook.Sheets[sheetName]) {
                                const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                                for (const row of data) {
                                    await mapper(row, tableName);
                                }
                            }
                        };

                        // Productos
                        await importSheet('Productos', 'productos', async (r) => {
                            if (r.ID || r.Nombre) {
                                await runQuery(
                                    `INSERT OR REPLACE INTO productos (ID, Nombre, Categoria, Descripcion, Cantidad, Unidad, FechaRegistro) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    [String(r.ID || ''), String(r.Nombre || ''), String(r.Categoria || ''), String(r.Descripcion || ''), Number(r.Cantidad || 0), String(r.Unidad || ''), String(r.FechaRegistro || '')]
                                );
                            }
                        });

                        // Entradas
                        await importSheet('Entradas', 'entradas', async (r) => {
                            if (r.ID_Movimiento || r.ID_Producto) {
                                await runQuery(
                                    `INSERT OR REPLACE INTO entradas (ID_Movimiento, ID_Producto, Nombre_Producto, Cantidad, Fecha, Observacion) VALUES (?, ?, ?, ?, ?, ?)`,
                                    [String(r.ID_Movimiento || Date.now() + Math.random()), String(r.ID_Producto || ''), String(r.Nombre_Producto || ''), Number(r.Cantidad || 0), String(r.Fecha || ''), String(r.Observacion || '')]
                                );
                            }
                        });

                        // Salidas
                        await importSheet('Salidas', 'salidas', async (r) => {
                            if (r.ID_Movimiento || r.ID_Producto) {
                                await runQuery(
                                    `INSERT OR REPLACE INTO salidas (ID_Movimiento, ID_Producto, Nombre_Producto, Cantidad, Fecha, Observacion) VALUES (?, ?, ?, ?, ?, ?)`,
                                    [String(r.ID_Movimiento || Date.now() + Math.random()), String(r.ID_Producto || ''), String(r.Nombre_Producto || ''), Number(r.Cantidad || 0), String(r.Fecha || ''), String(r.Observacion || '')]
                                );
                            }
                        });

                        // Entregas
                        await importSheet('Entregas', 'entregas', async (r) => {
                            if (r.id || r.Destinatario) {
                                await runQuery(
                                    `INSERT OR REPLACE INTO entregas (id, Destinatario, Articulo, Cantidad, Fecha, Estado, Nombre, Descripcion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [String(r.id || Date.now() + Math.random()), String(r.Destinatario || ''), String(r.Articulo || ''), Number(r.Cantidad || 0), String(r.Fecha || ''), String(r.Estado || ''), String(r.Nombre || ''), String(r.Descripcion || '')]
                                );
                            }
                        });

                        // Bitacora
                        await importSheet('Bitacora', 'bitacora', async (r) => {
                            if (r.id || r.Titulo) {
                                await runQuery(
                                    `INSERT OR REPLACE INTO bitacora (id, Titulo, AsociadoA, Fecha, Descripcion, DriveUrl, UsuarioSistemas) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    [String(r.id || Date.now() + Math.random()), String(r.Titulo || ''), String(r.AsociadoA || ''), String(r.Fecha || ''), String(r.Descripcion || ''), String(r.DriveUrl || ''), String(r.UsuarioSistemas || '')]
                                );
                            }
                        });

                        // TareasMensuales
                        await importSheet('TareasMensuales', 'tareas_mensuales', async (r) => {
                            if (r.id || r.Nombre) {
                                await runQuery(
                                    `INSERT OR REPLACE INTO tareas_mensuales (id, Nombre, Mes, Estado, FechaCreacion, FechaFinalizacion, UsuarioSistema) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    [String(r.id || Date.now() + Math.random()), String(r.Nombre || ''), String(r.Mes || ''), String(r.Estado || ''), String(r.FechaCreacion || ''), String(r.FechaFinalizacion || ''), String(r.UsuarioSistema || '')]
                                );
                            }
                        });

                        // UsuariosPreventivo
                        await importSheet('UsuariosPreventivo', 'usuarios_preventivo', async (r) => {
                            if (r.id || r.Nombre) {
                                await runQuery(
                                    `INSERT OR REPLACE INTO usuarios_preventivo (id, Nombre, Area, UsuarioSistema) VALUES (?, ?, ?, ?)`,
                                    [String(r.id || Date.now() + Math.random()), String(r.Nombre || ''), String(r.Area || ''), String(r.UsuarioSistema || '')]
                                );
                            }
                        });

                        // MantenimientoPreventivo
                        await importSheet('MantenimientoPreventivo', 'mantenimiento_preventivo', async (r) => {
                            if (r.id || r.UsuarioId) {
                                await runQuery(
                                    `INSERT OR REPLACE INTO mantenimiento_preventivo (id, UsuarioId, Mes, Semana, FechaRealizacion, Estado, Estados, Notas, UsuarioSistema, Fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [String(r.id || Date.now() + Math.random()), String(r.UsuarioId || ''), String(r.Mes || ''), String(r.Semana || ''), String(r.FechaRealizacion || ''), String(r.Estado || ''), String(r.Estados || ''), String(r.Notas || ''), String(r.UsuarioSistema || ''), String(r.Fecha || '')]
                                );
                            }
                        });

                        // TareasSemanales
                        await importSheet('TareasSemanales', 'tareas_semanales', async (r) => {
                            if (r.id || r.Nombre) {
                                let logsStr = typeof r.LogsDiarios === 'object' ? JSON.stringify(r.LogsDiarios) : String(r.LogsDiarios || '');
                                await runQuery(
                                    `INSERT OR REPLACE INTO tareas_semanales (id, Nombre, Semana, FechaRealizacion, Estado, UsuarioSistema, FechaCreacion, FechaFinalizacion, LogsDiarios) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [String(r.id || Date.now() + Math.random()), String(r.Nombre || ''), String(r.Semana || ''), String(r.FechaRealizacion || ''), String(r.Estado || ''), String(r.UsuarioSistema || ''), String(r.FechaCreacion || ''), String(r.FechaFinalizacion || ''), logsStr]
                                );
                            }
                        });

                        // BitacoraEvidencias
                        await importSheet('BitacoraEvidencias', 'bitacora_evidencias', async (r) => {
                            if (r.id || r.Titulo) {
                                await runQuery(
                                    `INSERT OR REPLACE INTO bitacora_evidencias (id, Titulo, Descripcion, Fecha, ImagenBase64, UsuarioSistema) VALUES (?, ?, ?, ?, ?, ?)`,
                                    [String(r.id || Date.now() + Math.random()), String(r.Titulo || ''), String(r.Descripcion || ''), String(r.Fecha || ''), String(r.ImagenBase64 || ''), String(r.UsuarioSistema || '')]
                                );
                            }
                        });

                        // Usuarios
                        await importSheet('Usuarios', 'usuarios', async (r) => {
                            if (r.Username) {
                                await runQuery(
                                    `INSERT OR REPLACE INTO usuarios (Username, Password, Nombre, Rol) VALUES (?, ?, ?, ?)`,
                                    [String(r.Username || ''), String(r.Password || ''), String(r.Nombre || ''), String(r.Rol || '')]
                                );
                            }
                        });

                        // TareasBase
                        await importSheet(' TareasBase', 'tareas_base', async (r) => {
                            if (r.id || r.Nombre) {
                                await runQuery(
                                    `INSERT OR REPLACE INTO tareas_base (id, Nombre, Area, Periocidad, Responsable, UsuarioSistema) VALUES (?, ?, ?, ?, ?, ?)`,
                                    [String(r.id || Date.now() + Math.random()), String(r.Nombre || ''), String(r.Area || ''), String(r.Periocidad || ''), String(r.Responsable || ''), String(r.UsuarioSistema || '')]
                                );
                            }
                        });

                        // SeguimientoSemanal
                        await importSheet('SeguimientoSemanal', 'seguimiento_semanal', async (r) => {
                            if (r.id || r.TareaId) {
                                let estadosStr = typeof r.Estados === 'object' ? JSON.stringify(r.Estados) : String(r.Estados || '');
                                await runQuery(
                                    `INSERT OR REPLACE INTO seguimiento_semanal (id, TareaId, Nombre, Area, Responsable, Semana, Mes, L, M, M2, J, V, S, Estados, UsuarioSistema, Cerrada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [String(r.id || Date.now() + Math.random()), String(r.TareaId || ''), String(r.Nombre || ''), String(r.Area || ''), String(r.Responsable || ''), String(r.Semana || ''), String(r.Mes || ''), String(r.L || ''), String(r.M || ''), String(r.M2 || ''), String(r.J || ''), String(r.V || ''), String(r.S || ''), estadosStr, String(r.UsuarioSistema || ''), String(r.Cerrada || '')]
                                );
                            }
                        });

                        console.log('Migración completada exitosamente.');
                    }
                }
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    });
}

module.exports = {
    db,
    runQuery,
    getQuery,
    allQuery,
    initDB
};
