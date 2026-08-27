const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

let sql = 'USE `inventario_sistemas`;\n\n';

sql += `DROP TABLE IF EXISTS \`productos\`, \`entradas\`, \`salidas\`, \`entregas\`, \`bitacora\`, \`tareas_mensuales\`, \`usuarios_preventivo\`, \`mantenimiento_preventivo\`, \`tareas_semanales\`, \`bitacora_evidencias\`, \`usuarios\`, \`tareas_base\`, \`seguimiento_semanal\`;\n\n`;

sql += `CREATE TABLE IF NOT EXISTS productos (ID VARCHAR(255) PRIMARY KEY, Nombre TEXT, Categoria VARCHAR(255), Descripcion TEXT, Cantidad DOUBLE DEFAULT 0, Unidad VARCHAR(100), FechaRegistro VARCHAR(100));
CREATE TABLE IF NOT EXISTS entradas (ID_Movimiento VARCHAR(255) PRIMARY KEY, ID_Producto VARCHAR(255), Nombre_Producto TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Observacion TEXT);
CREATE TABLE IF NOT EXISTS salidas (ID_Movimiento VARCHAR(255) PRIMARY KEY, ID_Producto VARCHAR(255), Nombre_Producto TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Observacion TEXT);
CREATE TABLE IF NOT EXISTS entregas (id VARCHAR(255) PRIMARY KEY, Destinatario TEXT, Articulo TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Estado VARCHAR(100), Nombre TEXT, Descripcion TEXT);
CREATE TABLE IF NOT EXISTS bitacora (id VARCHAR(255) PRIMARY KEY, Titulo TEXT, Descripcion TEXT, AsociadoA VARCHAR(255), Fecha VARCHAR(100), Notas TEXT, Usuario VARCHAR(255));
CREATE TABLE IF NOT EXISTS tareas_mensuales (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Mes VARCHAR(100), Estado VARCHAR(100), FechaCreacion VARCHAR(100), FechaFinalizacion VARCHAR(100), UsuarioSistema VARCHAR(255));
CREATE TABLE IF NOT EXISTS usuarios_preventivo (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Area VARCHAR(255), UsuarioSistema VARCHAR(255));
CREATE TABLE IF NOT EXISTS mantenimiento_preventivo (id VARCHAR(255) PRIMARY KEY, UsuarioId VARCHAR(255), Mes VARCHAR(100), Semana VARCHAR(100), FechaRealizacion VARCHAR(100), Estado VARCHAR(100), Estados TEXT, Notas TEXT, UsuarioSistema VARCHAR(255), Fecha VARCHAR(100));
CREATE TABLE IF NOT EXISTS tareas_semanales (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Semana VARCHAR(100), FechaRealizacion VARCHAR(100), Estado VARCHAR(100), UsuarioSistema VARCHAR(255), FechaCreacion VARCHAR(100), FechaFinalizacion VARCHAR(100), LogsDiarios TEXT);
CREATE TABLE IF NOT EXISTS bitacora_evidencias (id VARCHAR(255) PRIMARY KEY, Titulo TEXT, Descripcion TEXT, Fecha VARCHAR(100), ImagenBase64 LONGTEXT, UsuarioSistema VARCHAR(255));
CREATE TABLE IF NOT EXISTS usuarios (Username VARCHAR(255) PRIMARY KEY, Nombre TEXT, Rol VARCHAR(100), Password VARCHAR(255));
CREATE TABLE IF NOT EXISTS tareas_base (TareaId VARCHAR(255) PRIMARY KEY, Nombre TEXT, Area VARCHAR(255), Periodicidad VARCHAR(100), Responsable VARCHAR(255));
CREATE TABLE IF NOT EXISTS seguimiento_semanal (id VARCHAR(255) PRIMARY KEY, TareaId VARCHAR(255), Nombre TEXT, Area VARCHAR(255), Responsable VARCHAR(255), Semana VARCHAR(100), Mes VARCHAR(100), L INT DEFAULT 0, M INT DEFAULT 0, M2 INT DEFAULT 0, J INT DEFAULT 0, V INT DEFAULT 0, S INT DEFAULT 0, Estados TEXT, UsuarioSistema VARCHAR(255), Cerrada VARCHAR(20) DEFAULT 'NO');\n\n`;

function cleanVal(v) {
    if (v === undefined || v === null) return 'NULL';
    if (typeof v === 'number') return String(v);
    return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";
}

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error("Error reading tables:", err);
            return;
        }

        let pending = tables.length;
        tables.forEach(t => {
            const table = t.name;
            if (table === 'sqlite_sequence') {
                pending--;
                return;
            }

            db.all(`SELECT * FROM "${table}"`, (err, rows) => {
                if (rows && rows.length > 0) {
                    const cols = Object.keys(rows[0]);
                    sql += `-- Tabla: ${table} (${rows.length} registros)\n`;
                    rows.forEach(r => {
                        const vals = cols.map(c => cleanVal(r[c])).join(', ');
                        sql += `INSERT IGNORE INTO \`${table}\` (\`${cols.join('`, `')}\`) VALUES (${vals});\n`;
                    });
                    sql += '\n';
                }
                pending--;
                if (pending <= 0) {
                    fs.writeFileSync(path.join(__dirname, 'database_init.sql'), sql);
                    console.log('database_init.sql Dump completado con exito!');
                }
            });
        });
    });
});
