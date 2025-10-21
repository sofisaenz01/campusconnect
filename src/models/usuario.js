const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  edad: { type: Number, required: true },
  correo: { type: String, required: true, unique: true },
  telefono: { type: String, required: true },
  genero: { type: String, required: true },
  contrasena: { type: String, required: true }
});

module.exports = mongoose.model('Usuario', usuarioSchema);