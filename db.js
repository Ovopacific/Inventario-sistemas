const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

let USE_MYSQL = !!process.env.DB_HOST;

let mysqlPool = null;
let sqliteDb = null;
let activeHost = null;

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function getDBStatus() {
    return {
        use_mysql: USE_MYSQL,
        active_host: activeHost,
        mode: (USE_MYSQL && mysqlPool) ? 'MYSQL_REAL' : 'SQLITE_LOCAL'
    };
}

// Utilidad para ejecutar querys abstractos (MySQL o SQLite)
async function runQuery(sql, params = []) {
    console.log(`[DB RUN] (${USE_MYSQL ? 'MYSQL' : 'SQLITE'}) Executing query:`, sql.substring(0, 100));
    if (USE_MYSQL && mysqlPool) {
        let mysqlSql = sql.replace(/INSERT OR REPLACE INTO/gi, 'REPLACE INTO');
        const [result] = await mysqlPool.execute(mysqlSql, params);
        return result;
    } else {
        let sqliteSql = sql;
        if (!sqliteSql.toUpperCase().includes('INSERT OR REPLACE INTO')) {
            sqliteSql = sqliteSql.replace(/\bREPLACE INTO\b/gi, 'INSERT OR REPLACE INTO');
        }
        return new Promise((resolve, reject) => {
            sqliteDb.run(sqliteSql, params, function (err) {
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
        let sqliteSql = sql;
        if (!sqliteSql.toUpperCase().includes('INSERT OR REPLACE INTO')) {
            sqliteSql = sqliteSql.replace(/\bREPLACE INTO\b/gi, 'INSERT OR REPLACE INTO');
        }
        return new Promise((resolve, reject) => {
            sqliteDb.get(sqliteSql, params, (err, row) => {
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
        let sqliteSql = sql;
        if (!sqliteSql.toUpperCase().includes('INSERT OR REPLACE INTO')) {
            sqliteSql = sqliteSql.replace(/\bREPLACE INTO\b/gi, 'INSERT OR REPLACE INTO');
        }
        return new Promise((resolve, reject) => {
            sqliteDb.all(sqliteSql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

async function initDB() {
    let rawHost = process.env.DB_HOST || '192.168.11.68';
    const port = Number(process.env.DB_PORT || 4547);
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASS || 'root_password';
    const database = process.env.DB_NAME || 'inventario_sistemas';

    // Priorizar IP del servidor 192.168.11.68 y gateways Docker
    const hostsToTry = [rawHost, '192.168.11.68', '172.17.0.1', '172.18.0.1', 'host.docker.internal', 'localhost'];
    let connectedHost = null;

    for (const h of hostsToTry) {
        try {
            console.log(`Intentando conectar a MySQL en ${h}:${port}...`);
            const tempConn = await mysql.createConnection({ host: h, port, user, password, connectTimeout: 4000 });
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
        activeHost = connectedHost;
        USE_MYSQL = true;
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
        console.log(`🚀 SERVIDOR CONECTADO A MYSQL REAL en ${connectedHost}:${port} (Base de datos: ${database})`);
    } else {
        console.error("❌ No se pudo conectar a ningún host de MySQL. Usando archivo SQLite interno.");
        USE_MYSQL = false;
        const dbPath = path.join(__dirname, 'data', 'database.sqlite');
        sqliteDb = new sqlite3.Database(dbPath);
    }

    // Crear la estructura de 13 tablas universal para SQLite / MySQL
    await crearEstructuraTablasUniversal();

    // Auto-poblar datos de inventario si las tablas están vacías
    try {
        await verificarYPoblarBaseDeDatos();
    } catch (e) {
        console.error("Error al auto-poblar base de datos:", e.message || e);
    }
}

async function crearEstructuraTablasUniversal() {
    await runQuery(`CREATE TABLE IF NOT EXISTS productos (ID VARCHAR(255) PRIMARY KEY, Nombre TEXT, Categoria VARCHAR(255), Descripcion TEXT, Cantidad DOUBLE DEFAULT 0, Unidad VARCHAR(100), FechaRegistro VARCHAR(100))`);
    await runQuery(`CREATE TABLE IF NOT EXISTS entradas (ID_Movimiento VARCHAR(255) PRIMARY KEY, ID_Producto VARCHAR(255), Nombre_Producto TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Observacion TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS salidas (ID_Movimiento VARCHAR(255) PRIMARY KEY, ID_Producto VARCHAR(255), Nombre_Producto TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Observacion TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS entregas (id VARCHAR(255) PRIMARY KEY, Destinatario TEXT, Articulo TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Estado VARCHAR(100), Nombre TEXT, Descripcion TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS bitacora (id VARCHAR(255) PRIMARY KEY, Titulo TEXT, Descripcion TEXT, AsociadoA VARCHAR(255), Fecha VARCHAR(100), Notas TEXT, Usuario VARCHAR(255))`);
    await runQuery(`CREATE TABLE IF NOT EXISTS tareas_mensuales (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Mes VARCHAR(100), Estado VARCHAR(100), FechaCreacion VARCHAR(100), FechaFinalizacion VARCHAR(100), UsuarioSistema VARCHAR(255))`);
    await runQuery(`CREATE TABLE IF NOT EXISTS usuarios_preventivo (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Area VARCHAR(255), UsuarioSistema VARCHAR(255))`);
    await runQuery(`CREATE TABLE IF NOT EXISTS mantenimiento_preventivo (id VARCHAR(255) PRIMARY KEY, UsuarioId VARCHAR(255), Mes VARCHAR(100), Semana VARCHAR(100), FechaRealizacion VARCHAR(100), Estado VARCHAR(100), Estados TEXT, Notas TEXT, UsuarioSistema VARCHAR(255), Fecha VARCHAR(100))`);
    await runQuery(`CREATE TABLE IF NOT EXISTS tareas_semanales (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Semana VARCHAR(100), FechaRealizacion VARCHAR(100), Estado VARCHAR(100), UsuarioSistema VARCHAR(255), FechaCreacion VARCHAR(100), FechaFinalizacion VARCHAR(100), LogsDiarios TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS bitacora_evidencias (id VARCHAR(255) PRIMARY KEY, Titulo TEXT, Descripcion TEXT, Fecha VARCHAR(100), ImagenBase64 LONGTEXT, UsuarioSistema VARCHAR(255))`);
    await runQuery(`CREATE TABLE IF NOT EXISTS usuarios (Username VARCHAR(255) PRIMARY KEY, Nombre TEXT, Rol VARCHAR(100), Password VARCHAR(255))`);
    await runQuery(`CREATE TABLE IF NOT EXISTS tareas_base (TareaId VARCHAR(255) PRIMARY KEY, Nombre TEXT, Area VARCHAR(255), Periodicidad VARCHAR(100), Responsable VARCHAR(255))`);
    await runQuery(`CREATE TABLE IF NOT EXISTS seguimiento_semanal (id VARCHAR(255) PRIMARY KEY, TareaId VARCHAR(255), Nombre TEXT, Area VARCHAR(255), Responsable VARCHAR(255), Semana VARCHAR(100), Mes VARCHAR(100), L INT DEFAULT 0, M INT DEFAULT 0, M2 INT DEFAULT 0, J INT DEFAULT 0, V INT DEFAULT 0, S INT DEFAULT 0, Estados TEXT, UsuarioSistema VARCHAR(255), Cerrada VARCHAR(20) DEFAULT 'NO')`);
}

async function verificarYPoblarBaseDeDatos() {
    let prodCount = 0;
    try {
        const res = await getQuery("SELECT COUNT(*) as c FROM productos");
        if (res) prodCount = res.c || res['COUNT(*)'] || 0;
    } catch (e) {
        prodCount = 0;
    }

    if (prodCount === 0) {
        console.log("📦 Base de datos vacía. Cargando datos de inventario y usuarios por defecto...");
        const initSqlPath = path.join(__dirname, 'database_init.sql');
        if (fs.existsSync(initSqlPath)) {
            const rawSql = fs.readFileSync(initSqlPath, 'utf8');
            const statements = rawSql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            for (const stmt of statements) {
                try {
                    if (stmt.toLowerCase().startsWith('use ')) continue;
                    await runQuery(stmt);
                } catch (err) {
                    // ignorar advertencias de sintaxis o duplicados
                }
            }
        }

        // Cargar usuarios por defecto si no se cargaron
        await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES (?, ?, ?, ?)", ['admin', 'Administrador', 'admin', 'admin']);
        await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES (?, ?, ?, ?)", ['danny', 'Danny Vazquez', 'admin', 'Ovopacific2025']);
        await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES (?, ?, ?, ?)", ['yolfranlle', 'Yolfranlle Castillo', 'usuario', 'Ovopacific2024']);
        await runQuery("INSERT OR REPLACE INTO usuarios (Username, Nombre, Rol, Password) VALUES (?, ?, ?, ?)", ['ingrid', 'Ingrid Muñoz', 'supervisor', 'Ovopacific2026']);
        
        console.log("✅ Estructura y datos iniciales listos!");
    } else {
        console.log(`✅ Base de datos verificada con ${prodCount} productos de inventario.`);
    }
}

module.exports = {
    initDB,
    runQuery,
    getQuery,
    allQuery,
    getDBStatus
};
