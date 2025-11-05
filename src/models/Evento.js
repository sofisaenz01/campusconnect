    const mongoose = require('mongoose');

    const eventoSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    descripcion: { type: String, required: true },
    fecha: { type: String, required: true },
    contacto: { type: String, required: true },
    imagen: { type: String },
    autor: { type: String }
    });

    module.exports = mongoose.model('Evento', eventoSchema);