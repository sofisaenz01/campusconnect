const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');

const app = express();

// Conexión a MongoDB
mongoose.connect('mongodb://localhost:27017/campusconnect')
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error al conectar a MongoDB', err));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Modelo de usuario - Declarado fuera para accesibilidad global
let Usuario; // Declaración inicial
try {
  Usuario = require('./src/models/Usuario.js');
  console.log('Modelo Usuario cargado correctamente');
} catch (err) {
  console.error('Error al cargar el modelo Usuario:', err);
  process.exit(1); // Sale si falla la carga
}

// Ruta para registro
app.post('/sign_up', async (req, res) => {
  try {
    console.log('Datos recibidos en sign_up:', req.body); // Log para depurar
    const hashedPassword = await bcrypt.hash(req.body.contrasena, 10);
    const newUser = new Usuario({
      nombre: req.body.nombre,
      edad: req.body.edad,
      correo: req.body.correo,
      telefono: req.body.telefono,
      genero: req.body.genero,
      contrasena: hashedPassword
    });
    await newUser.save();
    res.redirect('/noticias.html');
  } catch (err) {
    console.error('Error en sign_up:', err);
    res.status(500).send('Error al registrar usuario. Intenta de nuevo.');
  }
});

// Ruta para login
app.post('/login', async (req, res) => {
  try {
    console.log('Datos recibidos en login:', req.body);
    const user = await Usuario.findOne({ correo: req.body.correo });
    if (!user) {
      console.log('Usuario no encontrado para correo:', req.body.correo);
      return res.status(400).send('Usuario no encontrado. Regístrate primero.');
    }
    const isMatch = await bcrypt.compare(req.body.contrasena, user.contrasena);
    if (!isMatch) {
      console.log('Contraseña incorrecta para correo:', req.body.correo);
      return res.status(400).send('Contraseña incorrecta.');
    }
    console.log('Login exitoso para:', req.body.correo);
    res.redirect('/noticias.html');
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).send('Error al iniciar sesión. Intenta de nuevo.');
  }
});

// Inicia el servidor
app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});

module.exports = app;