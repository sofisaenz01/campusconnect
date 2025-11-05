    const mongoose = require('mongoose');
    const bcrypt = require('bcryptjs');

    const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' },

    // NUEVOS CAMPOS PARA EL PERFIL
    nombre: { type: String, required: true },
    correo: { type: String, required: true, unique: true },
    telefono: { type: String },
    fechaNacimiento: { type: Date },
    pais: { type: String }
    });

    // Hashear contraseña antes de guardar
    adminSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
    });

    module.exports = mongoose.model('Admin', adminSchema);