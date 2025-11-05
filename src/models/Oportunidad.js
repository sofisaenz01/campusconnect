    const mongoose = require('mongoose');

    const oportunidadSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    descripcion: { type: String, required: true },
    url: { type: String },
    imagen: { type: String },
    autor: { type: String },
    fecha: { type: Date, default: Date.now }
    });

    module.exports = mongoose.model('Oportunidad', oportunidadSchema);
