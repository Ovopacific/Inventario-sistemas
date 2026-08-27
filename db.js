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

    // Auto-poblar datos de inventario si las tablas están vacías
    try {
        await verificarYPoblarBaseDeDatos();
    } catch (e) {
        console.error("Error al auto-poblar base de datos:", e.message || e);
    }
}

async function verificarYPoblarBaseDeDatos() {
    // Asegurar estructura de tablas
    const initSqlPath = path.join(__dirname, 'database_init.sql');
    if (!fs.existsSync(initSqlPath)) return;

    // Verificar si productos está vacío
    let prodCount = 0;
    try {
        const res = await getQuery("SELECT COUNT(*) as c FROM productos");
        if (res) prodCount = res.c || res['COUNT(*)'] || 0;
    } catch (e) {
        prodCount = 0;
    }

    if (prodCount === 0) {
        console.log("📦 La base de datos está vacía. Poblando 100% de datos originales del Excel...");
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
                // ignorar advertencias de duplicados
            }
        }
        console.log("✅ 100% de productos y datos de inventario cargados exitosamente!");
    } else {
        console.log(`✅ Base de datos lista con ${prodCount} productos de inventario.`);
    }
}

module.exports = {
    initDB,
    runQuery,
    getQuery,
    allQuery
};
