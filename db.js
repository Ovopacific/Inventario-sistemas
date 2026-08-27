const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

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
    if (USE_MYSQL) {
        let rawHost = process.env.DB_HOST || '172.17.0.1';
        const port = Number(process.env.DB_PORT || 4547);
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASS || 'root_password';
        const database = process.env.DB_NAME || 'inventario_sistemas';

        const hostsToTry = [rawHost, '172.17.0.1', '192.168.11.68', 'host.docker.internal', 'localhost'];
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
            console.log(`🚀 SERVIDOR CONECTADO A MYSQL REAL (Base de datos: ${database})`);
        } else {
            console.error("❌ No se pudo conectar a ningún host de MySQL. Usando archivo SQLite interno.");
            USE_MYSQL = false;
            const dbPath = path.join(__dirname, 'data', 'database.sqlite');
            sqliteDb = new sqlite3.Database(dbPath);
        }
    } else {
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
    await runQuery(`CREATE TABLE IF NOT EXISTS productos (ID TEXT PRIMARY KEY, Nombre TEXT, Categoria TEXT, Descripcion TEXT, Cantidad REAL DEFAULT 0, Unidad TEXT, FechaRegistro TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS entradas (ID_Movimiento TEXT PRIMARY KEY, ID_Producto TEXT, Nombre_Producto TEXT, Cantidad REAL DEFAULT 0, Fecha TEXT, Observacion TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS salidas (ID_Movimiento TEXT PRIMARY KEY, ID_Producto TEXT, Nombre_Producto TEXT, Cantidad REAL DEFAULT 0, Fecha TEXT, Observacion TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS entregas (id TEXT PRIMARY KEY, Destinatario TEXT, Articulo TEXT, Cantidad REAL DEFAULT 0, Fecha TEXT, Estado TEXT, Nombre TEXT, Descripcion TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS bitacora (id TEXT PRIMARY KEY, Titulo TEXT, Descripcion TEXT, AsociadoA TEXT, Fecha TEXT, Notas TEXT, Usuario TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS tareas_mensuales (id TEXT PRIMARY KEY, Nombre TEXT, Mes TEXT, Estado TEXT, FechaCreacion TEXT, FechaFinalizacion TEXT, UsuarioSistema TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS usuarios_preventivo (id TEXT PRIMARY KEY, Nombre TEXT, Area TEXT, UsuarioSistema TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS mantenimiento_preventivo (id TEXT PRIMARY KEY, UsuarioId TEXT, Mes TEXT, Semana TEXT, FechaRealizacion TEXT, Estado TEXT, Estados TEXT, Notas TEXT, UsuarioSistema TEXT, Fecha TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS tareas_semanales (id TEXT PRIMARY KEY, Nombre TEXT, Semana TEXT, FechaRealizacion TEXT, Estado TEXT, UsuarioSistema TEXT, FechaCreacion TEXT, FechaFinalizacion TEXT, LogsDiarios TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS bitacora_evidencias (id TEXT PRIMARY KEY, Titulo TEXT, Descripcion TEXT, Fecha TEXT, ImagenBase64 TEXT, UsuarioSistema TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS usuarios (Username TEXT PRIMARY KEY, Nombre TEXT, Rol TEXT, Password TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS tareas_base (TareaId TEXT PRIMARY KEY, Nombre TEXT, Area TEXT, Periodicidad TEXT, Responsable TEXT)`);
    await runQuery(`CREATE TABLE IF NOT EXISTS seguimiento_semanal (id TEXT PRIMARY KEY, TareaId TEXT, Nombre TEXT, Area TEXT, Responsable TEXT, Semana TEXT, Mes TEXT, L INTEGER DEFAULT 0, M INTEGER DEFAULT 0, M2 INTEGER DEFAULT 0, J INTEGER DEFAULT 0, V INTEGER DEFAULT 0, S INTEGER DEFAULT 0, Estados TEXT, UsuarioSistema TEXT, Cerrada TEXT DEFAULT 'NO')`);
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
    allQuery
};
