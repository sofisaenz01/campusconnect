    const mongoose = require('mongoose');

    const recursoSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    descripcion: { type: String, required: true },
    enlace: { type: String, required: true },
    icono: { type: String, required: true },
    tipo: { type: String, enum: ['pdf', 'video'], required: true }
    });

    module.exports = mongoose.model('Recurso', recursoSchema);