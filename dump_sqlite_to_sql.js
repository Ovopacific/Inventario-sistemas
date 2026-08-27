const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

let sql = 'USE `inventario_sistemas`;\n\n';

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

        const validTables = tables.map(t => t.name).filter(t => t !== 'sqlite_sequence');
        sql += `DROP TABLE IF EXISTS \`${validTables.join('`, `')}\`;\n\n`;

        let pending = validTables.length;

        validTables.forEach(table => {
            db.all(`PRAGMA table_info("${table}")`, (err, colsInfo) => {
                if (err || !colsInfo || colsInfo.length === 0) {
                    pending--;
                    return;
                }

                let colDefs = colsInfo.map(c => {
                    let name = c.name;
                    let type = 'TEXT';
                    if (c.type.toUpperCase().includes('INT')) type = 'INT DEFAULT 0';
                    else if (c.type.toUpperCase().includes('DOUBLE') || c.type.toUpperCase().includes('FLOAT')) type = 'DOUBLE DEFAULT 0';
                    else if (name === 'ImagenBase64') type = 'LONGTEXT';
                    else if (name === 'ID' || name === 'id' || name === 'Username' || name === 'TareaId' || name === 'ID_Movimiento') type = 'VARCHAR(255)';
                    
                    if (c.pk === 1) return `\`${name}\` ${type} PRIMARY KEY`;
                    return `\`${name}\` ${type}`;
                }).join(', ');

                sql += `-- Estructura para tabla: ${table}\n`;
                sql += `CREATE TABLE IF NOT EXISTS \`${table}\` (${colDefs});\n`;

                db.all(`SELECT * FROM "${table}"`, (err, rows) => {
                    if (rows && rows.length > 0) {
                        const cols = Object.keys(rows[0]);
                        sql += `-- Datos para tabla: ${table} (${rows.length} registros)\n`;
                        rows.forEach(r => {
                            const vals = cols.map(col => cleanVal(r[col])).join(', ');
                            sql += `INSERT IGNORE INTO \`${table}\` (\`${cols.join('`, `')}\`) VALUES (${vals});\n`;
                        });
                    }
                    sql += '\n';
                    pending--;

                    if (pending <= 0) {
                        // Insertar usuarios con REPLACE INTO limpio para MySQL 8
                        sql += `-- Usuarios del sistema con contraseñas oficiales Ovopacific\n`;
                        sql += `REPLACE INTO \`usuarios\` (\`Username\`, \`Nombre\`, \`Rol\`, \`Password\`) VALUES \n`;
                        sql += `('admin', 'Administrador', 'admin', 'admin'),\n`;
                        sql += `('danny', 'Danny Vazquez', 'admin', 'Ovopacific2025'),\n`;
                        sql += `('yolfranlle', 'Yolfranlle Castillo', 'usuario', 'Ovopacific2024'),\n`;
                        sql += `('ingrid', 'Ingrid Muñoz', 'supervisor', 'Ovopacific2026');\n\n`;

                        fs.writeFileSync(path.join(__dirname, 'database_init.sql'), sql);
                        console.log('database_init.sql con REPLACE INTO limpio generado con éxito!');
                    }
                });
            });
        });
    });
});
