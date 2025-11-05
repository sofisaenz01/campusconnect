    const mongoose = require('mongoose');

    const noticiaSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    descripcion: { type: String, required: true },
    url: { type: String },
    imagen: { type: String }, // ruta del archivo
    fecha: { type: Date, default: Date.now },
    autor: { type: String } // nombre del admin
    });

    module.exports = mongoose.model('Noticia', noticiaSchema);