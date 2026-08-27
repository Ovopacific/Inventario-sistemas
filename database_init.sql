USE `inventario_sistemas`;

CREATE TABLE IF NOT EXISTS productos (ID VARCHAR(255) PRIMARY KEY, Nombre TEXT, Categoria VARCHAR(255), Descripcion TEXT, Cantidad DOUBLE DEFAULT 0, Unidad VARCHAR(100), FechaRegistro VARCHAR(100));
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
CREATE TABLE IF NOT EXISTS seguimiento_semanal (id VARCHAR(255) PRIMARY KEY, TareaId VARCHAR(255), Nombre TEXT, Area VARCHAR(255), Responsable VARCHAR(255), Semana VARCHAR(100), Mes VARCHAR(100), L INT DEFAULT 0, M INT DEFAULT 0, M2 INT DEFAULT 0, J INT DEFAULT 0, V INT DEFAULT 0, S INT DEFAULT 0, Estados TEXT, UsuarioSistema VARCHAR(255), Cerrada VARCHAR(20) DEFAULT 'NO');

INSERT IGNORE INTO usuarios (Username, Nombre, Rol, Password) VALUES 
('admin', 'Administrador', 'admin', 'admin'),
('danny', 'Danny Rodriguez', 'admin', '1234'),
('yolfranlle', 'Yolfranlle Castillo', 'usuario', '1234'),
('ingrid', 'Ingrid', 'visualizador', '1234');

