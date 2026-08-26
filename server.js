const express = require('express');
const path = require('path');
const { initDB } = require('./db');
const apiRouter = require('./apiRouter');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para montado de la API REST local
app.use('/api', apiRouter);

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(path.join(__dirname)));

// Ruta principal (Fallback SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicializar la Base de Datos y arrancar el servidor
initDB()
    .then(() => {
        console.log('Base de datos inicializada y migrada correctamente.');
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Servidor iniciado y escuchando en http://0.0.0.0:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Error al inicializar la base de datos:', err);
    });
