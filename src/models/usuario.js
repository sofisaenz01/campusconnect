const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  edad: { type: Number },
  correo: { type: String, required: true, unique: true },
  telefono: { type: String },
  genero: { type: String },
  contrasena: { type: String, required: true },
  role: { type: String, enum: ['estudiante', 'docente'], default: 'estudiante' }  // ← NUEVO
});

usuarioSchema.pre('save', async function(next) {
  if (this.isModified('contrasena')) {
    this.contrasena = await bcrypt.hash(this.contrasena, 10);
  }
  next();
});

module.exports = mongoose.model('Usuario', usuarioSchema);