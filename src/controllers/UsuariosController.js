const Usuario = require('../models/usuario');
const Admin = require('../models/admin');

// Obtener estadísticas de usuarios
exports.obtenerEstadisticasUsuarios = async (req, res) => {
    try {
        // Contar usuarios (estudiantes/docentes)
        const totalUsuarios = await Usuario.countDocuments();
        
        // Contar administradores
        const totalAdmins = await Admin.countDocuments();
        
        res.json({
            success: true,
            data: {
                usuarios: totalUsuarios,
                administradores: totalAdmins,
                total: totalUsuarios + totalAdmins
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las estadísticas de usuarios',
            error: error.message
        });
    }
};

// Obtener lista de usuarios con paginación (opcional)
exports.listarUsuarios = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        
        const usuarios = await Usuario.find()
            .select('nombre correo edad genero')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ _id: -1 });
        
        const total = await Usuario.countDocuments();
        
        res.json({
            success: true,
            data: usuarios,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total: total
        });
    } catch (error) {
        console.error('Error al listar usuarios:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener la lista de usuarios',
            error: error.message
        });
    }
};

// Obtener lista de administradores con paginación (opcional)
exports.listarAdministradores = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        
        const admins = await Admin.find()
            .select('nombre correo')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ _id: -1 });
        
        const total = await Admin.countDocuments();
        
        res.json({
            success: true,
            data: admins,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total: total
        });
    } catch (error) {
        console.error('Error al listar administradores:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener la lista de administradores',
            error: error.message
        });
    }
};