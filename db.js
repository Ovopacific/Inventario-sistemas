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
        let rawHost = process.env.DB_HOST || '172.17.0.1';
        const port = Number(process.env.DB_PORT || 4547);
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASS || 'root_password';
        const database = process.env.DB_NAME || 'inventario_sistemas';

        // Probar hosts posibles en orden para encontrar el servidor MySQL
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
            console.log(`🚀 SERVIDOR ESCUCHANDO Y CONECTADO A MYSQL REAL (Base de datos: ${database})`);
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
}

module.exports = {
    initDB,
    runQuery,
    getQuery,
    allQuery
};
