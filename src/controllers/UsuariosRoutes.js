const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/UsuariosController');

// Ruta para obtener estadísticas de usuarios
router.get('/estadisticas', usuariosController.obtenerEstadisticasUsuarios);

// Ruta para listar usuarios (opcional)
router.get('/lista', usuariosController.listarUsuarios);

// Ruta para listar administradores (opcional)
router.get('/administradores', usuariosController.listarAdministradores);

module.exports = router;