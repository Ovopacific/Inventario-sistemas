const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const USE_MYSQL = !!process.env.DB_HOST;

let mysqlPool = null;
let sqliteDb = null;

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!USE_MYSQL) {
    const dbPath = path.join(dataDir, 'database.sqlite');
    sqliteDb = new sqlite3.Database(dbPath);
}

// Utilidad para ejecutar querys abstractos (MySQL o SQLite)
async function runQuery(sql, params = []) {
    if (USE_MYSQL) {
        // En MySQL, reemplazar INSERT OR REPLACE por INSERT ... ON DUPLICATE KEY UPDATE o REPLACE INTO
        let mysqlSql = sql.replace(/INSERT OR REPLACE INTO/gi, 'REPLACE INTO');
        const [result] = await mysqlPool.execute(mysqlSql, params);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }
}

async function getQuery(sql, params = []) {
    if (USE_MYSQL) {
        let mysqlSql = sql.replace(/INSERT OR REPLACE INTO/gi, 'REPLACE INTO');
        const [rows] = await mysqlPool.execute(mysqlSql, params);
        return rows[0] || null;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

async function allQuery(sql, params = []) {
    if (USE_MYSQL) {
        let mysqlSql = sql.replace(/INSERT OR REPLACE INTO/gi, 'REPLACE INTO');
        const [rows] = await mysqlPool.execute(mysqlSql, params);
        return rows;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

async function initDB() {
    if (USE_MYSQL) {
        const host = process.env.DB_HOST || 'host.docker.internal';
        const port = Number(process.env.DB_PORT || 3306);
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASS || '';
        const database = process.env.DB_NAME || 'inventario_sistemas';

        console.log(`Conectando a MySQL en ${host}:${port}...`);
        
        // Crear la BD en MySQL si no existe
        const tempConn = await mysql.createConnection({ host, port, user, password });
        await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
        await tempConn.end();

        // Crear el Pool de conexiones
        mysqlPool = mysql.createPool({
            host,
            port,
            user,
            password,
            database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Crear Tablas en MySQL
        await runQuery(`CREATE TABLE IF NOT EXISTS productos (
            ID VARCHAR(255) PRIMARY KEY,
            Nombre TEXT,
            Categoria VARCHAR(255),
            Descripcion TEXT,
            Cantidad DOUBLE DEFAULT 0,
            Unidad VARCHAR(100),
            FechaRegistro VARCHAR(100)
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS entradas (
            ID_Movimiento VARCHAR(255) PRIMARY KEY,
            ID_Producto VARCHAR(255),
            Nombre_Producto TEXT,
            Cantidad DOUBLE DEFAULT 0,
            Fecha VARCHAR(100),
            Observacion TEXT
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS salidas (
            ID_Movimiento VARCHAR(255) PRIMARY KEY,
            ID_Producto VARCHAR(255),
            Nombre_Producto TEXT,
            Cantidad DOUBLE DEFAULT 0,
            Fecha VARCHAR(100),
            Observacion TEXT
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS entregas (
            id VARCHAR(255) PRIMARY KEY,
            Destinatario TEXT,
            Articulo TEXT,
            Cantidad DOUBLE DEFAULT 0,
            Fecha VARCHAR(100),
            Estado VARCHAR(100),
            Nombre TEXT,
            Descripcion TEXT
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS bitacora (
            id VARCHAR(255) PRIMARY KEY,
            Titulo TEXT,
            AsociadoA VARCHAR(255),
            Fecha VARCHAR(100),
            Descripcion TEXT,
            DriveUrl TEXT,
            UsuarioSistemas VARCHAR(255)
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS tareas_mensuales (
            id VARCHAR(255) PRIMARY KEY,
            Nombre TEXT,
            Mes VARCHAR(50),
            Estado VARCHAR(100),
            FechaCreacion VARCHAR(100),
            FechaFinalizacion VARCHAR(100),
            UsuarioSistema VARCHAR(255)
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS usuarios_preventivo (
            id VARCHAR(255) PRIMARY KEY,
            Nombre TEXT,
            Area VARCHAR(255),
            UsuarioSistema VARCHAR(255)
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS mantenimiento_preventivo (
            id VARCHAR(255) PRIMARY KEY,
            UsuarioId VARCHAR(255),
            Mes VARCHAR(50),
            Semana VARCHAR(50),
            FechaRealizacion VARCHAR(100),
            Estado VARCHAR(100),
            Estados TEXT,
            Notas TEXT,
            UsuarioSistema VARCHAR(255),
            Fecha VARCHAR(100)
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS tareas_semanales (
            id VARCHAR(255) PRIMARY KEY,
            Nombre TEXT,
            Semana VARCHAR(50),
            FechaRealizacion VARCHAR(100),
            Estado VARCHAR(100),
            UsuarioSistema VARCHAR(255),
            FechaCreacion VARCHAR(100),
            FechaFinalizacion VARCHAR(100),
            LogsDiarios LONGTEXT
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS bitacora_evidencias (
            id VARCHAR(255) PRIMARY KEY,
            Titulo TEXT,
            Descripcion TEXT,
            Fecha VARCHAR(100),
            ImagenBase64 LONGTEXT,
            UsuarioSistema VARCHAR(255)
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS usuarios (
            Username VARCHAR(255) PRIMARY KEY,
            Password VARCHAR(255),
            Nombre TEXT,
            Rol VARCHAR(100)
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS tareas_base (
            id VARCHAR(255) PRIMARY KEY,
            Nombre TEXT,
            Area VARCHAR(255),
            Periocidad VARCHAR(100),
            Responsable VARCHAR(255),
            UsuarioSistema VARCHAR(255)
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS seguimiento_semanal (
            id VARCHAR(255) PRIMARY KEY,
            TareaId VARCHAR(255),
            Nombre TEXT,
            Area VARCHAR(255),
            Responsable VARCHAR(255),
            Semana VARCHAR(50),
            Mes VARCHAR(50),
            L TEXT,
            M TEXT,
            M2 TEXT,
            J TEXT,
            V TEXT,
            S TEXT,
            Estados LONGTEXT,
            UsuarioSistema VARCHAR(255),
            Cerrada VARCHAR(50)
        )`);

    } else {
        // Modo SQLite
        return new Promise((resolve, reject) => {
            sqliteDb.serialize(async () => {
                try {
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS productos (
                        ID TEXT PRIMARY KEY, Nombre TEXT, Categoria TEXT, Descripcion TEXT, Cantidad REAL, Unidad TEXT, FechaRegistro TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS entradas (
                        ID_Movimiento TEXT PRIMARY KEY, ID_Producto TEXT, Nombre_Producto TEXT, Cantidad REAL, Fecha TEXT, Observacion TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS salidas (
                        ID_Movimiento TEXT PRIMARY KEY, ID_Producto TEXT, Nombre_Producto TEXT, Cantidad REAL, Fecha TEXT, Observacion TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS entregas (
                        id TEXT PRIMARY KEY, Destinatario TEXT, Articulo TEXT, Cantidad REAL, Fecha TEXT, Estado TEXT, Nombre TEXT, Descripcion TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS bitacora (
                        id TEXT PRIMARY KEY, Titulo TEXT, AsociadoA TEXT, Fecha TEXT, Descripcion TEXT, DriveUrl TEXT, UsuarioSistemas TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS tareas_mensuales (
                        id TEXT PRIMARY KEY, Nombre TEXT, Mes TEXT, Estado TEXT, FechaCreacion TEXT, FechaFinalizacion TEXT, UsuarioSistema TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS usuarios_preventivo (
                        id TEXT PRIMARY KEY, Nombre TEXT, Area TEXT, UsuarioSistema TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS mantenimiento_preventivo (
                        id TEXT PRIMARY KEY, UsuarioId TEXT, Mes TEXT, Semana TEXT, FechaRealizacion TEXT, Estado TEXT, Estados TEXT, Notas TEXT, UsuarioSistema TEXT, Fecha TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS tareas_semanales (
                        id TEXT PRIMARY KEY, Nombre TEXT, Semana TEXT, FechaRealizacion TEXT, Estado TEXT, UsuarioSistema TEXT, FechaCreacion TEXT, FechaFinalizacion TEXT, LogsDiarios TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS bitacora_evidencias (
                        id TEXT PRIMARY KEY, Titulo TEXT, Descripcion TEXT, Fecha TEXT, ImagenBase64 TEXT, UsuarioSistema TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS usuarios (
                        Username TEXT PRIMARY KEY, Password TEXT, Nombre TEXT, Rol TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS tareas_base (
                        id TEXT PRIMARY KEY, Nombre TEXT, Area TEXT, Periocidad TEXT, Responsable TEXT, UsuarioSistema TEXT
                    )`);
                    sqliteDb.run(`CREATE TABLE IF NOT EXISTS seguimiento_semanal (
                        id TEXT PRIMARY KEY, TareaId TEXT, Nombre TEXT, Area TEXT, Responsable TEXT, Semana TEXT, Mes TEXT, L TEXT, M TEXT, M2 TEXT, J TEXT, V TEXT, S TEXT, Estados TEXT, UsuarioSistema TEXT, Cerrada TEXT
                    )`);
                    resolve();
                } catch (e) { reject(e); }
            });
        });
    }

    // Migración inicial desde Excel si la tabla productos está vacía
    const checkProd = await getQuery("SELECT COUNT(*) as count FROM productos");
    const count = checkProd.count !== undefined ? checkProd.count : (checkProd['COUNT(*)'] || 0);

    if (count === 0) {
        const excelPath = path.join(__dirname, 'Copia de inventario sistemas.xlsx');
        if (fs.existsSync(excelPath)) {
            console.log('Migrando datos iniciales desde Copia de inventario sistemas.xlsx...');
            const workbook = xlsx.readFile(excelPath);
            
            const importSheet = async (sheetName, mapper) => {
                if (workbook.Sheets[sheetName]) {
                    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                    for (const row of data) {
                        await mapper(row);
                    }
                }
            };

            await importSheet('Productos', async (r) => {
                if (r.ID || r.Nombre) {
                    await runQuery(
                        `INSERT OR REPLACE INTO productos (ID, Nombre, Categoria, Descripcion, Cantidad, Unidad, FechaRegistro) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [String(r.ID || ''), String(r.Nombre || ''), String(r.Categoria || ''), String(r.Descripcion || ''), Number(r.Cantidad || 0), String(r.Unidad || ''), String(r.FechaRegistro || '')]
                    );
                }
            });

            await importSheet('Entradas', async (r) => {
                if (r.ID_Movimiento || r.ID_Producto) {
                    await runQuery(
                        `INSERT OR REPLACE INTO entradas (ID_Movimiento, ID_Producto, Nombre_Producto, Cantidad, Fecha, Observacion) VALUES (?, ?, ?, ?, ?, ?)`,
                        [String(r.ID_Movimiento || Date.now() + Math.random()), String(r.ID_Producto || ''), String(r.Nombre_Producto || ''), Number(r.Cantidad || 0), String(r.Fecha || ''), String(r.Observacion || '')]
                    );
                }
            });

            await importSheet('Salidas', async (r) => {
                if (r.ID_Movimiento || r.ID_Producto) {
                    await runQuery(
                        `INSERT OR REPLACE INTO salidas (ID_Movimiento, ID_Producto, Nombre_Producto, Cantidad, Fecha, Observacion) VALUES (?, ?, ?, ?, ?, ?)`,
                        [String(r.ID_Movimiento || Date.now() + Math.random()), String(r.ID_Producto || ''), String(r.Nombre_Producto || ''), Number(r.Cantidad || 0), String(r.Fecha || ''), String(r.Observacion || '')]
                    );
                }
            });

            await importSheet('Entregas', async (r) => {
                if (r.id || r.Destinatario) {
                    await runQuery(
                        `INSERT OR REPLACE INTO entregas (id, Destinatario, Articulo, Cantidad, Fecha, Estado, Nombre, Descripcion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [String(r.id || Date.now() + Math.random()), String(r.Destinatario || ''), String(r.Articulo || ''), Number(r.Cantidad || 0), String(r.Fecha || ''), String(r.Estado || ''), String(r.Nombre || ''), String(r.Descripcion || '')]
                    );
                }
            });

            await importSheet('Bitacora', async (r) => {
                if (r.id || r.Titulo) {
                    await runQuery(
                        `INSERT OR REPLACE INTO bitacora (id, Titulo, AsociadoA, Fecha, Descripcion, DriveUrl, UsuarioSistemas) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [String(r.id || Date.now() + Math.random()), String(r.Titulo || ''), String(r.AsociadoA || ''), String(r.Fecha || ''), String(r.Descripcion || ''), String(r.DriveUrl || ''), String(r.UsuarioSistemas || '')]
                    );
                }
            });

            await importSheet('TareasMensuales', async (r) => {
                if (r.id || r.Nombre) {
                    await runQuery(
                        `INSERT OR REPLACE INTO tareas_mensuales (id, Nombre, Mes, Estado, FechaCreacion, FechaFinalizacion, UsuarioSistema) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [String(r.id || Date.now() + Math.random()), String(r.Nombre || ''), String(r.Mes || ''), String(r.Estado || ''), String(r.FechaCreacion || ''), String(r.FechaFinalizacion || ''), String(r.UsuarioSistema || '')]
                    );
                }
            });

            await importSheet('UsuariosPreventivo', async (r) => {
                if (r.id || r.Nombre) {
                    await runQuery(
                        `INSERT OR REPLACE INTO usuarios_preventivo (id, Nombre, Area, UsuarioSistema) VALUES (?, ?, ?, ?)`,
                        [String(r.id || Date.now() + Math.random()), String(r.Nombre || ''), String(r.Area || ''), String(r.UsuarioSistema || '')]
                    );
                }
            });

            await importSheet('MantenimientoPreventivo', async (r) => {
                if (r.id || r.UsuarioId) {
                    await runQuery(
                        `INSERT OR REPLACE INTO mantenimiento_preventivo (id, UsuarioId, Mes, Semana, FechaRealizacion, Estado, Estados, Notas, UsuarioSistema, Fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [String(r.id || Date.now() + Math.random()), String(r.UsuarioId || ''), String(r.Mes || ''), String(r.Semana || ''), String(r.FechaRealizacion || ''), String(r.Estado || ''), String(r.Estados || ''), String(r.Notas || ''), String(r.UsuarioSistema || ''), String(r.Fecha || '')]
                    );
                }
            });

            await importSheet('TareasSemanales', async (r) => {
                if (r.id || r.Nombre) {
                    let logsStr = typeof r.LogsDiarios === 'object' ? JSON.stringify(r.LogsDiarios) : String(r.LogsDiarios || '');
                    await runQuery(
                        `INSERT OR REPLACE INTO tareas_semanales (id, Nombre, Semana, FechaRealizacion, Estado, UsuarioSistema, FechaCreacion, FechaFinalizacion, LogsDiarios) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [String(r.id || Date.now() + Math.random()), String(r.Nombre || ''), String(r.Semana || ''), String(r.FechaRealizacion || ''), String(r.Estado || ''), String(r.UsuarioSistema || ''), String(r.FechaCreacion || ''), String(r.FechaFinalizacion || ''), logsStr]
                    );
                }
            });

            await importSheet('BitacoraEvidencias', async (r) => {
                if (r.id || r.Titulo) {
                    await runQuery(
                        `INSERT OR REPLACE INTO bitacora_evidencias (id, Titulo, Descripcion, Fecha, ImagenBase64, UsuarioSistema) VALUES (?, ?, ?, ?, ?, ?)`,
                        [String(r.id || Date.now() + Math.random()), String(r.Titulo || ''), String(r.Descripcion || ''), String(r.Fecha || ''), String(r.ImagenBase64 || ''), String(r.UsuarioSistema || '')]
                    );
                }
            });

            await importSheet('Usuarios', async (r) => {
                if (r.Username) {
                    await runQuery(
                        `INSERT OR REPLACE INTO usuarios (Username, Password, Nombre, Rol) VALUES (?, ?, ?, ?)`,
                        [String(r.Username || ''), String(r.Password || ''), String(r.Nombre || ''), String(r.Rol || '')]
                    );
                }
            });

            await importSheet(' TareasBase', async (r) => {
                if (r.id || r.Nombre) {
                    await runQuery(
                        `INSERT OR REPLACE INTO tareas_base (id, Nombre, Area, Periocidad, Responsable, UsuarioSistema) VALUES (?, ?, ?, ?, ?, ?)`,
                        [String(r.id || Date.now() + Math.random()), String(r.Nombre || ''), String(r.Area || ''), String(r.Periocidad || ''), String(r.Responsable || ''), String(r.UsuarioSistema || '')]
                    );
                }
            });

            await importSheet('SeguimientoSemanal', async (r) => {
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
}

module.exports = {
    runQuery,
    getQuery,
    allQuery,
    initDB
};
