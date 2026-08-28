const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// ─── ESTADO DE CONEXIÓN ─────────────────────────────────────
let mysqlPool = null;
let sqliteDb = null;
let activeHost = null;
let dbReady = false;
let connectionErrors = []; // Para diagnóstico

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function isMySQL() {
    return mysqlPool !== null;
}

function getDBStatus() {
    return {
        use_mysql: isMySQL(),
        active_host: activeHost,
        mode: isMySQL() ? 'MYSQL_REAL' : 'SQLITE_LOCAL',
        db_ready: dbReady,
        env_DB_HOST: process.env.DB_HOST || '(no definida)',
        env_DB_PORT: process.env.DB_PORT || '(no definida)',
        env_DB_PASS: process.env.DB_PASS ? '(definida)' : '(VACÍA - configurar en Dokploy)',
        connection_errors: connectionErrors.slice(-20) // últimos 20 errores
    };
}

// ─── HELPERS INTERNOS ─────────────────────────────────────
function toMysqlSql(sql) {
    return sql.replace(/INSERT OR REPLACE INTO/gi, 'REPLACE INTO');
}

function toSqliteSql(sql) {
    if (!sql.toUpperCase().includes('INSERT OR REPLACE INTO')) {
        return sql.replace(/\bREPLACE INTO\b/gi, 'INSERT OR REPLACE INTO');
    }
    return sql;
}

// ─── QUERIES PÚBLICAS ─────────────────────────────────────
async function runQuery(sql, params = []) {
    if (isMySQL()) {
        const [result] = await mysqlPool.execute(toMysqlSql(sql), params);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.run(toSqliteSql(sql), params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }
}

async function getQuery(sql, params = []) {
    if (isMySQL()) {
        const [rows] = await mysqlPool.execute(toMysqlSql(sql), params);
        return rows[0] || null;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.get(toSqliteSql(sql), params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

async function allQuery(sql, params = []) {
    if (isMySQL()) {
        const [rows] = await mysqlPool.execute(toMysqlSql(sql), params);
        return rows;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.all(toSqliteSql(sql), params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

// ─── INIT DB ─────────────────────────────────────────────
async function initDB() {
    // Leer variables de entorno (si Dokploy las pasa) o usar defaults directos
    const envHost = process.env.DB_HOST;
    const envPort = Number(process.env.DB_PORT || 4547);
    const user    = process.env.DB_USER || 'root';
    const password = process.env.DB_PASS || 'vooez4cuefqateg8'; // contraseña MySQL puerto 4547
    const database = process.env.DB_NAME || 'inventario_sistemas';

    // Siempre intentar MySQL. Lista de hosts en orden de prioridad:
    // Primero nombres internos de Docker/Dokploy, luego IPs de red
    const mysqlServiceName = process.env.DB_SERVICE || '';
    const hostsToTry = [
        envHost,                        // variable de entorno de Dokploy (DB_HOST)
        mysqlServiceName,               // DB_SERVICE si se define en Dokploy
        'mysql',                        // nombre de servicio Docker común
        'database',                     // nombre de servicio Docker común
        'mariadb',                      // nombre alternativo
        'host.docker.internal',         // resuelve al host desde Docker
        '172.17.0.1',                   // gateway Docker red 0
        '172.18.0.1',                   // gateway Docker red 1
        '172.19.0.1',                   // gateway Docker red 2
        '172.20.0.1',                   // gateway Docker red 3
        '192.168.11.68',                // IP física del servidor LAN
    ].filter(Boolean);

    // Intentar todos los puertos posibles
    const portsToTry = Array.from(new Set([envPort, 4547, 3306])).filter(Boolean);

    let connected = false;

    outer:
    for (const h of hostsToTry) {
        for (const p of portsToTry) {
            try {
                console.log(`[DB] Intentando MySQL en ${h}:${p}...`);
                const tempConn = await mysql.createConnection({
                    host: h, port: p, user, password,
                    connectTimeout: 4000
                });
                await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
                await tempConn.query(`USE \`${database}\`;`);
                await tempConn.end();

                // Crear pool definitivo
                mysqlPool = mysql.createPool({
                    host: h, port: p, user, password, database,
                    waitForConnections: true,
                    connectionLimit: 10,
                    queueLimit: 0
                });
                activeHost = `${h}:${p}`;
                connected = true;
                console.log(`✅ [DB] MySQL conectado en ${h}:${p} (base: ${database})`);
                break outer;
            } catch (err) {
                const msg = `${h}:${p} → ${err.message}`;
                connectionErrors.push(msg);
                console.warn(`[DB] Fallo en ${msg}`);
            }
        }
    }

    if (!connected) {
        // Fallback a SQLite local
        console.error('[DB] ❌ No se pudo conectar a MySQL. Usando SQLite local como respaldo.');
        const dbPath = path.join(__dirname, 'data', 'database.sqlite');
        sqliteDb = new sqlite3.Database(dbPath);
    }

    // Crear tablas y cargar datos
    await crearEstructuraTablasUniversal();
    await verificarYPoblarBaseDeDatos();

    dbReady = true;
    console.log(`[DB] ✅ Base de datos lista. Modo: ${isMySQL() ? 'MYSQL_REAL' : 'SQLITE_LOCAL'}`);
}

// ─── CREAR TABLAS ──────────────────────────────────────────
async function crearEstructuraTablasUniversal() {
    const CREATE = isMySQL()
        ? (sql) => runQuery(sql)
        : (sql) => runQuery(sql); // mismo helper, detecta motor automáticamente

    await CREATE(`CREATE TABLE IF NOT EXISTS productos (ID VARCHAR(255) PRIMARY KEY, Nombre TEXT, Categoria VARCHAR(255), Descripcion TEXT, Cantidad DOUBLE DEFAULT 0, Unidad VARCHAR(100), FechaRegistro VARCHAR(100))`);
    await CREATE(`CREATE TABLE IF NOT EXISTS entradas (ID_Movimiento VARCHAR(255) PRIMARY KEY, ID_Producto VARCHAR(255), Nombre_Producto TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Observacion TEXT)`);
    await CREATE(`CREATE TABLE IF NOT EXISTS salidas (ID_Movimiento VARCHAR(255) PRIMARY KEY, ID_Producto VARCHAR(255), Nombre_Producto TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Observacion TEXT)`);
    await CREATE(`CREATE TABLE IF NOT EXISTS entregas (id VARCHAR(255) PRIMARY KEY, Destinatario TEXT, Articulo TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Estado VARCHAR(100), Nombre TEXT, Descripcion TEXT)`);
    await CREATE(`CREATE TABLE IF NOT EXISTS bitacora (id VARCHAR(255) PRIMARY KEY, Titulo TEXT, Descripcion TEXT, AsociadoA VARCHAR(255), Fecha VARCHAR(100), Notas TEXT, Usuario VARCHAR(255))`);
    await CREATE(`CREATE TABLE IF NOT EXISTS tareas_mensuales (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Mes VARCHAR(100), Estado VARCHAR(100), FechaCreacion VARCHAR(100), FechaFinalizacion VARCHAR(100), UsuarioSistema VARCHAR(255))`);
    await CREATE(`CREATE TABLE IF NOT EXISTS usuarios_preventivo (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Area VARCHAR(255), UsuarioSistema VARCHAR(255))`);
    await CREATE(`CREATE TABLE IF NOT EXISTS mantenimiento_preventivo (id VARCHAR(255) PRIMARY KEY, UsuarioId VARCHAR(255), Mes VARCHAR(100), Semana VARCHAR(100), FechaRealizacion VARCHAR(100), Estado VARCHAR(100), Estados TEXT, Notas TEXT, UsuarioSistema VARCHAR(255), Fecha VARCHAR(100))`);
    await CREATE(`CREATE TABLE IF NOT EXISTS tareas_semanales (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Semana VARCHAR(100), FechaRealizacion VARCHAR(100), Estado VARCHAR(100), UsuarioSistema VARCHAR(255), FechaCreacion VARCHAR(100), FechaFinalizacion VARCHAR(100), LogsDiarios TEXT)`);
    await CREATE(`CREATE TABLE IF NOT EXISTS bitacora_evidencias (id VARCHAR(255) PRIMARY KEY, Titulo TEXT, Descripcion TEXT, Fecha VARCHAR(100), ImagenBase64 LONGTEXT, UsuarioSistema VARCHAR(255))`);
    await CREATE(`CREATE TABLE IF NOT EXISTS usuarios (Username VARCHAR(255) PRIMARY KEY, Nombre TEXT, Rol VARCHAR(100), Password VARCHAR(255))`);
    await CREATE(`CREATE TABLE IF NOT EXISTS tareas_base (TareaId VARCHAR(255) PRIMARY KEY, Nombre TEXT, Area VARCHAR(255), Periodicidad VARCHAR(100), Responsable VARCHAR(255))`);
    await CREATE(`CREATE TABLE IF NOT EXISTS seguimiento_semanal (id VARCHAR(255) PRIMARY KEY, TareaId VARCHAR(255), Nombre TEXT, Area VARCHAR(255), Responsable VARCHAR(255), Semana VARCHAR(100), Mes VARCHAR(100), L INT DEFAULT 0, M INT DEFAULT 0, M2 INT DEFAULT 0, J INT DEFAULT 0, V INT DEFAULT 0, S INT DEFAULT 0, Estados TEXT, UsuarioSistema VARCHAR(255), Cerrada VARCHAR(20) DEFAULT 'NO')`);

    console.log('[DB] ✅ Estructura de 13 tablas verificada/creada.');
}

// ─── POBLAR DATOS INICIALES ────────────────────────────────
async function verificarYPoblarBaseDeDatos() {
    let prodCount = 0;
    try {
        const res = await getQuery("SELECT COUNT(*) as c FROM productos");
        if (res) prodCount = Number(res.c || res['COUNT(*)'] || 0);
    } catch (e) {
        prodCount = 0;
    }

    console.log(`[DB] Productos en base de datos: ${prodCount}`);

    if (prodCount === 0) {
        console.log('[DB] Base de datos vacía. Cargando datos iniciales del SQL...');
        const initSqlPath = path.join(__dirname, 'database_init.sql');
        if (fs.existsSync(initSqlPath)) {
            const rawSql = fs.readFileSync(initSqlPath, 'utf8');
            const statements = rawSql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 5 && !s.startsWith('--'));

            for (const stmt of statements) {
                try {
                    if (/^use\s/i.test(stmt)) continue;
                    await runQuery(stmt);
                } catch (err) {
                    // Ignorar duplicados y errores de sintaxis menores
                }
            }
        }

        console.log('[DB] ✅ Datos iniciales cargados.');
    } else {
        console.log(`[DB] ✅ Base de datos lista con ${prodCount} productos.`);
    }
}

module.exports = {
    initDB,
    runQuery,
    getQuery,
    allQuery,
    getDBStatus
};
