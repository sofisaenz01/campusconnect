const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  edad: { type: Number, required: true },
  correo: { type: String, required: true, unique: true },
  telefono: { type: String },
  genero: { type: String },
  contrasena: { type: String, required: true },
  fechaNacimiento: { type: Date }, // Nuevo campo
  pais: { type: String } // Nuevo campo
});

module.exports = mongoose.model('Usuario', usuarioSchema);