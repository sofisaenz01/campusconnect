console.log('Iniciando database.js');

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session'); // Nueva dependencia

const app = express();

// Conexión a MongoDB
mongoose.connect('mongodb://localhost:27017/campusconnect')
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error al conectar a MongoDB', err));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Agrega soporte para JSON
app.use(express.static('public'));

// Configuración de sesiones
app.use(session({
  secret: 'tu_secreto_aqui', // Cambia esto por una clave secreta fuerte
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Cambia a true si usas HTTPS
}));

// Modelo de usuario - Declarado fuera para accesibilidad global
let Usuario;
try {
  Usuario = require('./src/models/usuario.js');
  console.log('Modelo Usuario cargado correctamente');
} catch (err) {
  console.error('Error al cargar el modelo Usuario:', err);
  process.exit(1);
}

// Ruta para registro
app.post('/sign_up', async (req, res) => {
  try {
    console.log('Datos recibidos en sign_up:', req.body);
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
      return res.status(400).send('Contraseña incorrecta.');
    }
    req.session.userId = user._id;
    console.log('Login exitoso para:', req.body.correo, 'ID:', user._id, 'Session ID:', req.sessionID);
    res.redirect('/noticias.html');
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).send('Error al iniciar sesión. Intenta de nuevo.');
  }
});

// Ruta para obtener el perfil del usuario logueado
app.get('/api/perfil', async (req, res) => {
  console.log('Solicitud a /api/perfil recibida');
  console.log('Session userId:', req.session.userId);
  try {
    if (!req.session.userId) {
      console.log('No autenticado - Sin userId en la sesión');
      return res.status(401).send('No autenticado');
    }
    const user = await Usuario.findById(req.session.userId);
    if (!user) {
      console.log('Usuario no encontrado para ID:', req.session.userId);
      return res.status(404).send('Usuario no encontrado');
    }
    console.log('Usuario encontrado:', user);
    res.json({
      nombre: user.nombre,
      correo: user.correo,
      telefono: user.telefono,
      fechaNacimiento: user.fechaNacimiento || '',
      pais: user.pais || ''
    });
  } catch (err) {
    console.error('Error en /api/perfil:', err);
    res.status(500).send('Error al cargar el perfil');
  }
});

// Ruta para actualizar el perfil
app.put('/api/perfil', async (req, res) => {
  console.log('Solicitud PUT a /api/perfil recibida:', req.body);
  try {
    if (!req.session.userId) {
      console.log('No autenticado - Sin userId en la sesión');
      return res.status(401).send('No autenticado');
    }
    const user = await Usuario.findById(req.session.userId);
    if (!user) {
      console.log('Usuario no encontrado para ID:', req.session.userId);
      return res.status(404).send('Usuario no encontrado');
    }
    // Actualizar solo los campos enviados
    if (req.body.nombre) user.nombre = req.body.nombre;
    if (req.body.telefono) user.telefono = req.body.telefono;
    if (req.body.fechaNacimiento) user.fechaNacimiento = new Date(req.body.fechaNacimiento);
    if (req.body.pais) user.pais = req.body.pais;
    await user.save();
    console.log('Perfil actualizado para:', req.session.userId);
    res.json({ message: 'Cambios guardados con éxito', nombre: user.nombre, telefono: user.telefono, fechaNacimiento: user.fechaNacimiento, pais: user.pais });
  } catch (err) {
    console.error('Error en PUT /api/perfil:', err);
    res.status(500).send('Error al actualizar el perfil');
  }
});

// Inicia el servidor
app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});

module.exports = app;