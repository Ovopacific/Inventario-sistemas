const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

let USE_MYSQL = !!process.env.DB_HOST;

let mysqlPool = null;
let sqliteDb = null;

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Utilidad para ejecutar querys abstractos (MySQL o SQLite)
async function runQuery(sql, params = []) {
    if (USE_MYSQL && mysqlPool) {
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
    if (USE_MYSQL && mysqlPool) {
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
    if (USE_MYSQL && mysqlPool) {
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
        let host = process.env.DB_HOST || 'host.docker.internal';
        const port = Number(process.env.DB_PORT || 4547);
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASS || 'root_password';
        const database = process.env.DB_NAME || 'inventario_sistemas';

        // Si host.docker.internal no resuelve dentro del contenedor Linux, probar IP Gateway 172.17.0.1
        const hostsToTry = [host, '172.17.0.1', '192.168.11.68', 'localhost'];
        let connectedHost = null;

        for (const h of hostsToTry) {
            try {
                console.log(`Intentando conectar a MySQL en ${h}:${port}...`);
                const tempConn = await mysql.createConnection({ host: h, port, user, password, connectTimeout: 3000 });
                await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
                await tempConn.end();
                connectedHost = h;
                console.log(`✅ Conexión a MySQL exitosa en ${h}:${port}`);
                break;
            } catch (err) {
                console.warn(`No se pudo conectar a MySQL en ${h}:${port}:`, err.message);
            }
        }

        if (connectedHost) {
            mysqlPool = mysql.createPool({
                host: connectedHost,
                port,
                user,
                password,
                database,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
        } else {
            console.error("❌ No se pudo conectar a ningún host de MySQL. Cambiando a SQLite de emergencia.");
            USE_MYSQL = false;
            const dbPath = path.join(dataDir, 'database.sqlite');
            sqliteDb = new sqlite3.Database(dbPath);
        }
    } else {
        const dbPath = path.join(dataDir, 'database.sqlite');
        sqliteDb = new sqlite3.Database(dbPath);
    }

    if (!USE_MYSQL) {
        console.log("Inicializando base de datos en modo SQLite...");
    }

    // Crear Tablas
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
        Notas TEXT,
        Usuario VARCHAR(255)
    )`);

    await runQuery(`CREATE TABLE IF NOT EXISTS tareas_mensuales (
        id VARCHAR(255) PRIMARY KEY,
        Nombre TEXT,
        Mes VARCHAR(100),
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
        Mes VARCHAR(100),
        Semana VARCHAR(100),
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
        Semana VARCHAR(100),
        FechaRealizacion VARCHAR(100),
        Estado VARCHAR(100),
        UsuarioSistema VARCHAR(255),
        FechaCreacion VARCHAR(100),
        FechaFinalizacion VARCHAR(100),
        LogsDiarios TEXT
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
        Nombre TEXT,
        Rol VARCHAR(100),
        Password VARCHAR(255)
    )`);

    await runQuery(`CREATE TABLE IF NOT EXISTS tareas_base (
        TareaId VARCHAR(255) PRIMARY KEY,
        Nombre TEXT,
        Area VARCHAR(255),
        Periodicidad VARCHAR(100),
        Responsable VARCHAR(255)
    )`);

    await runQuery(`CREATE TABLE IF NOT EXISTS seguimiento_semanal (
        id VARCHAR(255) PRIMARY KEY,
        TareaId VARCHAR(255),
        Nombre TEXT,
        Area VARCHAR(255),
        Responsable VARCHAR(255),
        Semana VARCHAR(100),
        Mes VARCHAR(100),
        L INT DEFAULT 0,
        M INT DEFAULT 0,
        M2 INT DEFAULT 0,
        J INT DEFAULT 0,
        V INT DEFAULT 0,
        S INT DEFAULT 0,
        Estados TEXT,
        UsuarioSistema VARCHAR(255),
        Cerrada VARCHAR(20) DEFAULT 'NO'
    )`);

    // Migrar datos de Excel solo si las tablas están vacías
    const countProd = await getQuery("SELECT COUNT(*) as c FROM productos");
    const totalProd = countProd ? (countProd.c || countProd['COUNT(*)'] || 0) : 0;

    if (totalProd === 0) {
        console.log("Poblando datos iniciales en la base de datos...");
        await migrarDatosIniciales();
    } else {
        console.log(`Base de datos lista. ${totalProd} productos existentes.`);
    }
}

async function migrarDatosIniciales() {
    const excelPath = path.join(__dirname, 'Copia de inventario sistemas.xlsx');
    if (!fs.existsSync(excelPath)) {
        console.log("No se encontró archivo Excel inicial, creando usuarios por defecto...");
        await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES (?, ?, ?, ?)", ['admin', 'Administrador', 'admin', 'admin']);
        await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES (?, ?, ?, ?)", ['danny', 'Danny Rodriguez', 'admin', '1234']);
        await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES (?, ?, ?, ?)", ['yolfranlle', 'Yolfranlle Castillo', 'usuario', '1234']);
        await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES (?, ?, ?, ?)", ['ingrid', 'Ingrid', 'visualizador', '1234']);
        return;
    }

    try {
        const workbook = xlsx.readFile(excelPath);

        // 1. Usuarios
        if (workbook.SheetNames.includes('Usuarios')) {
            const rows = xlsx.utils.sheet_to_json(workbook.Sheets['Usuarios']);
            for (const r of rows) {
                if (r.Username || r.usuario || r.usuarioStr) {
                    await runQuery(
                        `INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES (?, ?, ?, ?)`,
                        [
                            String(r.Username || r.usuario || '').trim(),
                            String(r.Nombre || r.nombre || '').trim(),
                            String(r.Rol || r.rol || 'usuario').trim(),
                            String(r.Password || r.password || '1234').trim()
                        ]
                    );
                }
            }
        }

        // Si no se cargaron usuarios, crear por defecto
        const countUsers = await getQuery("SELECT COUNT(*) as c FROM usuarios");
        if (!countUsers || (countUsers.c || countUsers['COUNT(*)']) === 0) {
            await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES ('admin', 'Administrador', 'admin', 'admin')");
            await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES ('danny', 'Danny Rodriguez', 'admin', '1234')");
            await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES ('yolfranlle', 'Yolfranlle Castillo', 'usuario', '1234')");
            await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES ('ingrid', 'Ingrid', 'visualizador', '1234')");
        }

        // 2. Productos
        if (workbook.SheetNames.includes('Productos')) {
            const rows = xlsx.utils.sheet_to_json(workbook.Sheets['Productos']);
            for (const r of rows) {
                if (r.ID || r.Nombre) {
                    await runQuery(
                        `INSERT OR REPLACE INTO productos (ID, Nombre, Categoria, Descripcion, Cantidad, Unidad, FechaRegistro) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            String(r.ID || 'PROD-' + Date.now()),
                            String(r.Nombre || ''),
                            String(r.Categoria || ''),
                            String(r.Descripcion || ''),
                            Number(r.Cantidad || 0),
                            String(r.Unidad || 'Unidad'),
                            String(r.FechaRegistro || new Date().toISOString().split('T')[0])
                        ]
                    );
                }
            }
        }

        // 3. Tareas Mensuales
        if (workbook.SheetNames.includes('TareasMensuales')) {
            const rows = xlsx.utils.sheet_to_json(workbook.Sheets['TareasMensuales']);
            for (const r of rows) {
                if (r.id || r.Nombre) {
                    await runQuery(
                        `INSERT OR REPLACE INTO tareas_mensuales (id, Nombre, Mes, Estado, FechaCreacion, FechaFinalizacion, UsuarioSistema) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            String(r.id || 'TM-' + Date.now()),
                            String(r.Nombre || ''),
                            String(r.Mes || ''),
                            String(r.Estado || 'Pendiente'),
                            String(r.FechaCreacion || ''),
                            String(r.FechaFinalizacion || ''),
                            String(r.UsuarioSistema || '')
                        ]
                    );
                }
            }
        }

        // 4. Mantenimiento Preventivo
        if (workbook.SheetNames.includes('MantenimientoPreventivo')) {
            const rows = xlsx.utils.sheet_to_json(workbook.Sheets['MantenimientoPreventivo']);
            for (const r of rows) {
                if (r.id || r.UsuarioId) {
                    await runQuery(
                        `INSERT OR REPLACE INTO mantenimiento_preventivo (id, UsuarioId, Mes, Semana, FechaRealizacion, Estado, Estados, Notas, UsuarioSistema, Fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            String(r.id || 'PREV-' + Date.now()),
                            String(r.UsuarioId || ''),
                            String(r.Mes || ''),
                            String(r.Semana || ''),
                            String(r.FechaRealizacion || ''),
                            String(r.Estado || 'Pendiente'),
                            String(typeof r.Estados === 'object' ? JSON.stringify(r.Estados) : (r.Estados || '{}')),
                            String(r.Notas || ''),
                            String(r.UsuarioSistema || ''),
                            String(r.Fecha || '')
                        ]
                    );
                }
            }
        }

        // 5. Tareas Base
        const sheetBaseName = workbook.SheetNames.find(s => s.trim().toLowerCase() === 'tareasbase');
        if (sheetBaseName) {
            const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetBaseName]);
            for (const r of rows) {
                if (r.TareaId || r.Nombre) {
                    await runQuery(
                        `INSERT OR REPLACE INTO tareas_base (TareaId, Nombre, Area, Periodicidad, Responsable) VALUES (?, ?, ?, ?, ?)`,
                        [
                            String(r.TareaId || r.id || 'TB-' + Date.now()),
                            String(r.Nombre || ''),
                            String(r.Area || 'General'),
                            String(r.Periodicidad || 'Diario'),
                            String(r.Responsable || '')
                        ]
                    );
                }
            }
        }

        console.log("Migración inicial completada con éxito.");
    } catch (e) {
        console.error("Error durante la migración del Excel:", e);
    }
}

module.exports = {
    initDB,
    runQuery,
    getQuery,
    allQuery
};
