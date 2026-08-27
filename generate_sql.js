const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelPath = path.join(__dirname, 'Copia de inventario sistemas.xlsx');
let sql = 'USE `inventario_sistemas`;\n\n';

sql += `CREATE TABLE IF NOT EXISTS productos (ID VARCHAR(255) PRIMARY KEY, Nombre TEXT, Categoria VARCHAR(255), Descripcion TEXT, Cantidad DOUBLE DEFAULT 0, Unidad VARCHAR(100), FechaRegistro VARCHAR(100));
CREATE TABLE IF NOT EXISTS entradas (ID_Movimiento VARCHAR(255) PRIMARY KEY, ID_Producto VARCHAR(255), Nombre_Producto TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Observacion TEXT);
CREATE TABLE IF NOT EXISTS salidas (ID_Movimiento VARCHAR(255) PRIMARY KEY, ID_Producto VARCHAR(255), Nombre_Producto TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Observacion TEXT);
CREATE TABLE IF NOT EXISTS entregas (id VARCHAR(255) PRIMARY KEY, Destinatario TEXT, Articulo TEXT, Cantidad DOUBLE DEFAULT 0, Fecha VARCHAR(100), Estado VARCHAR(100), Nombre TEXT, Descripcion TEXT);
CREATE TABLE IF NOT EXISTS bitacora (id VARCHAR(255) PRIMARY KEY, Titulo TEXT, AsociadoA VARCHAR(255), Fecha VARCHAR(100), Notas TEXT, Usuario VARCHAR(255));
CREATE TABLE IF NOT EXISTS tareas_mensuales (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Mes VARCHAR(100), Estado VARCHAR(100), FechaCreacion VARCHAR(100), FechaFinalizacion VARCHAR(100), UsuarioSistema VARCHAR(255));
CREATE TABLE IF NOT EXISTS usuarios_preventivo (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Area VARCHAR(255), UsuarioSistema VARCHAR(255));
CREATE TABLE IF NOT EXISTS mantenimiento_preventivo (id VARCHAR(255) PRIMARY KEY, UsuarioId VARCHAR(255), Mes VARCHAR(100), Semana VARCHAR(100), FechaRealizacion VARCHAR(100), Estado VARCHAR(100), Estados TEXT, Notas TEXT, UsuarioSistema VARCHAR(255), Fecha VARCHAR(100));
CREATE TABLE IF NOT EXISTS tareas_semanales (id VARCHAR(255) PRIMARY KEY, Nombre TEXT, Semana VARCHAR(100), FechaRealizacion VARCHAR(100), Estado VARCHAR(100), UsuarioSistema VARCHAR(255), FechaCreacion VARCHAR(100), FechaFinalizacion VARCHAR(100), LogsDiarios TEXT);
CREATE TABLE IF NOT EXISTS bitacora_evidencias (id VARCHAR(255) PRIMARY KEY, Titulo TEXT, Descripcion TEXT, Fecha VARCHAR(100), ImagenBase64 LONGTEXT, UsuarioSistema VARCHAR(255));
CREATE TABLE IF NOT EXISTS usuarios (Username VARCHAR(255) PRIMARY KEY, Nombre TEXT, Rol VARCHAR(100), Password VARCHAR(255));
CREATE TABLE IF NOT EXISTS tareas_base (TareaId VARCHAR(255) PRIMARY KEY, Nombre TEXT, Area VARCHAR(255), Periodicidad VARCHAR(100), Responsable VARCHAR(255));
CREATE TABLE IF NOT EXISTS seguimiento_semanal (id VARCHAR(255) PRIMARY KEY, TareaId VARCHAR(255), Nombre TEXT, Area VARCHAR(255), Responsable VARCHAR(255), Semana VARCHAR(100), Mes VARCHAR(100), L INT DEFAULT 0, M INT DEFAULT 0, M2 INT DEFAULT 0, J INT DEFAULT 0, V INT DEFAULT 0, S INT DEFAULT 0, Estados TEXT, UsuarioSistema VARCHAR(255), Cerrada VARCHAR(20) DEFAULT 'NO');\n\n`;

sql += `INSERT IGNORE INTO usuarios (Username, Nombre, Rol, Password) VALUES 
('admin', 'Administrador', 'admin', 'admin'),
('danny', 'Danny Rodriguez', 'admin', '1234'),
('yolfranlle', 'Yolfranlle Castillo', 'usuario', '1234'),
('ingrid', 'Ingrid', 'visualizador', '1234');\n\n`;

function clean(v) {
    if (v === undefined || v === null) return 'NULL';
    return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";
}

if (fs.existsSync(excelPath)) {
    const workbook = xlsx.readFile(excelPath);

    if (workbook.SheetNames.includes('Usuarios')) {
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets['Usuarios']);
        for (const r of rows) {
            const u = r.Username || r.usuario;
            if (u) {
                sql += `INSERT IGNORE INTO usuarios (Username, Nombre, Rol, Password) VALUES (${clean(u)}, ${clean(r.Nombre || r.nombre)}, ${clean(r.Rol || r.rol || 'usuario')}, ${clean(r.Password || r.password || '1234')});\n`;
            }
        }
    }

    if (workbook.SheetNames.includes('Productos')) {
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets['Productos']);
        for (const r of rows) {
            if (r.ID || r.Nombre) {
                sql += `INSERT IGNORE INTO productos (ID, Nombre, Categoria, Descripcion, Cantidad, Unidad, FechaRegistro) VALUES (${clean(r.ID)}, ${clean(r.Nombre)}, ${clean(r.Categoria)}, ${clean(r.Descripcion)}, ${Number(r.Cantidad || 0)}, ${clean(r.Unidad)}, ${clean(r.FechaRegistro)});\n`;
            }
        }
    }

    if (workbook.SheetNames.includes('TareasMensuales')) {
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets['TareasMensuales']);
        for (const r of rows) {
            if (r.id || r.Nombre) {
                sql += `INSERT IGNORE INTO tareas_mensuales (id, Nombre, Mes, Estado, FechaCreacion, FechaFinalizacion, UsuarioSistema) VALUES (${clean(r.id)}, ${clean(r.Nombre)}, ${clean(r.Mes)}, ${clean(r.Estado)}, ${clean(r.FechaCreacion)}, ${clean(r.FechaFinalizacion)}, ${clean(r.UsuarioSistema)});\n`;
            }
        }
    }

    if (workbook.SheetNames.includes('MantenimientoPreventivo')) {
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets['MantenimientoPreventivo']);
        for (const r of rows) {
            if (r.id || r.UsuarioId) {
                sql += `INSERT IGNORE INTO mantenimiento_preventivo (id, UsuarioId, Mes, Semana, FechaRealizacion, Estado, Estados, Notas, UsuarioSistema, Fecha) VALUES (${clean(r.id)}, ${clean(r.UsuarioId)}, ${clean(r.Mes)}, ${clean(r.Semana)}, ${clean(r.FechaRealizacion)}, ${clean(r.Estado)}, ${clean(typeof r.Estados === 'object' ? JSON.stringify(r.Estados) : r.Estados)}, ${clean(r.Notas)}, ${clean(r.UsuarioSistema)}, ${clean(r.Fecha)});\n`;
            }
        }
    }

    const sheetBaseName = workbook.SheetNames.find(s => s.trim().toLowerCase() === 'tareasbase');
    if (sheetBaseName) {
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetBaseName]);
        for (const r of rows) {
            if (r.TareaId || r.Nombre) {
                sql += `INSERT IGNORE INTO tareas_base (TareaId, Nombre, Area, Periodicidad, Responsable) VALUES (${clean(r.TareaId || r.id)}, ${clean(r.Nombre)}, ${clean(r.Area)}, ${clean(r.Periodicidad)}, ${clean(r.Responsable)});\n`;
            }
        }
    }
}

fs.writeFileSync(path.join(__dirname, 'database_init.sql'), sql);
console.log("Generado database_init.sql con éxito!");
