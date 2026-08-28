// test_conexion.js - Probar conexión MySQL directamente desde la máquina
// Ejecutar con: node test_conexion.js
const mysql = require('mysql2/promise');

const configs = [
    { host: '192.168.11.68', port: 4547, label: 'IP LAN + Puerto 4547' },
    { host: '192.168.11.68', port: 3306, label: 'IP LAN + Puerto 3306 (default MySQL)' },
    { host: '127.0.0.1',     port: 4547, label: 'Localhost + Puerto 4547' },
    { host: '127.0.0.1',     port: 3306, label: 'Localhost + Puerto 3306' },
    { host: 'localhost',     port: 4547, label: 'localhost + Puerto 4547' },
];

const user     = process.env.DB_USER || 'root';
const password = process.env.DB_PASS || '';
const database = 'inventario_sistemas';

async function probar() {
    console.log(`\n🔍 Probando conexiones MySQL...`);
    console.log(`   Usuario: ${user}`);
    console.log(`   Contraseña: ${password ? '(definida)' : '(VACÍA - definir DB_PASS)'}\n`);

    for (const cfg of configs) {
        try {
            const conn = await mysql.createConnection({
                host: cfg.host,
                port: cfg.port,
                user,
                password,
                connectTimeout: 3000
            });
            const [rows] = await conn.query('SHOW DATABASES');
            const dbs = rows.map(r => Object.values(r)[0]);
            await conn.end();
            console.log(`✅ ÉXITO: ${cfg.label}`);
            console.log(`   Bases de datos disponibles: ${dbs.join(', ')}`);
            console.log(`\n👉 Usar en DB_HOST=${cfg.host} DB_PORT=${cfg.port}\n`);
            return; // Parar en el primero que funcione
        } catch (err) {
            console.log(`❌ FALLO: ${cfg.label}`);
            console.log(`   Error: ${err.message}\n`);
        }
    }
    console.log('❌ No se pudo conectar a ningún host/puerto de MySQL.');
    console.log('   Verifica que MySQL esté corriendo y acepte conexiones remotas.');
}

probar();
