console.log('Iniciando database.js');

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// === CONEXIÓN A MONGODB ===
mongoose.connect('mongodb://localhost:27017/campusconnect')
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error al conectar a MongoDB:', err));

// === MIDDLEWARE ===
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(session({
  secret: 'campusconnect_secret_2025_secure_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// === MODELOS ===
let Usuario;
try {
  Usuario = require('./src/models/usuario.js');
  console.log('Modelo Usuario cargado correctamente');
} catch (err) {
  console.error('Error al cargar el modelo Usuario:', err);
  process.exit(1);
}

const Admin = require('./src/models/admin');
const Noticia = require('./src/models/Noticia');
const Evento = require('./src/models/Evento');
const Recurso = require('./src/models/Recurso');
const Oportunidad = require('./src/models/Oportunidad');

// === MODELO VISITA (DEFINIDO ANTES DE USARLO) ===
const VisitaSchema = new mongoose.Schema({
  pagina: { type: String, required: true },
  fecha: { type: Date, default: Date.now }
});
const Visita = mongoose.model('Visita', VisitaSchema);

// === MULTER CONFIG ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `noticia-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Solo imágenes (jpeg, jpg, png, gif, webp)'));
  }
});

// === MIDDLEWARE ADMIN ===
const requireAdmin = (req, res, next) => {
  if (req.session?.isAdmin) return next();

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: requiere sesión de administrador'
    });
  }

  res.status(403).send(`
    <h1>Acceso Denegado</h1>
    <p>Debes iniciar sesión como administrador.</p>
    <a href="admin-login.html" style="color:#0077cc;">Ir al login</a>
  `);
};

// === RUTAS USUARIO ===
app.post('/sign_up', async (req, res) => {
  try {
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
    res.status(500).send('Error al registrar usuario.');
  }
});

app.post('/login', async (req, res) => {
  try {
    const user = await Usuario.findOne({ correo: req.body.correo });
    if (!user || !await bcrypt.compare(req.body.contrasena, user.contrasena)) {
      return res.status(400).send('Credenciales incorrectas.');
    }
    req.session.userId = user._id;
    res.redirect('/noticias.html');
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).send('Error del servidor.');
  }
});

app.get('/api/perfil', async (req, res) => {
  if (!req.session.userId) return res.status(401).send('No autenticado');
  try {
    const user = await Usuario.findById(req.session.userId);
    if (!user) return res.status(404).send('Usuario no encontrado');
    res.json({
      nombre: user.nombre,
      correo: user.correo,
      telefono: user.telefono || '',
      fechaNacimiento: user.fechaNacimiento ? user.fechaNacimiento.toISOString().split('T')[0] : '',
      pais: user.pais || ''
    });
  } catch (err) {
    res.status(500).send('Error al cargar perfil');
  }
});

app.put('/api/perfil', async (req, res) => {
  if (!req.session.userId) return res.status(401).send('No autenticado');
  try {
    const user = await Usuario.findById(req.session.userId);
    if (!user) return res.status(404).send('Usuario no encontrado');
    ['nombre', 'telefono', 'pais'].forEach(field => {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    });
    if (req.body.fechaNacimiento) user.fechaNacimiento = new Date(req.body.fechaNacimiento);
    await user.save();
    res.json({ message: 'Cambios guardados', nombre: user.nombre });
  } catch (err) {
    console.error('Error en PUT /api/perfil:', err);
    res.status(500).send('Error al actualizar');
  }
});

// === RUTAS ADMIN ===
app.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin || !await bcrypt.compare(password, admin.password)) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }
    req.session.isAdmin = true;
    req.session.adminUsername = username;
    res.json({ success: true });
  } catch (err) {
    console.error('Error en admin-login:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.get('/api/admin/perfil', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'No autenticado' });
  try {
    const admin = await Admin.findOne({ username: req.session.adminUsername });
    if (!admin) return res.status(404).json({ error: 'Admin no encontrado' });
    res.json({
      nombre: admin.nombre,
      correo: admin.correo,
      telefono: admin.telefono || '',
      fechaNacimiento: admin.fechaNacimiento ? admin.fechaNacimiento.toISOString().split('T')[0] : '',
      pais: admin.pais || ''
    });
  } catch (err) {
    console.error('Error en /api/admin/perfil:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.put('/api/admin/perfil', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'No autenticado' });
  try {
    const update = {};
    ['nombre', 'telefono', 'pais'].forEach(field => {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    });
    if (req.body.fechaNacimiento) update.fechaNacimiento = new Date(req.body.fechaNacimiento);
    const admin = await Admin.findOneAndUpdate(
      { username: req.session.adminUsername },
      update,
      { new: true }
    );
    res.json({ message: 'Perfil actualizado', nombre: admin.nombre });
  } catch (err) {
    console.error('Error en PUT /api/admin/perfil:', err);
    res.status(500).json({ error: 'Error al guardar' });
  }
});

// === ESTADÍSTICAS DE USUARIOS ===
app.get('/api/usuarios/estadisticas', requireAdmin, async (req, res) => {
  try {
    const totalUsuarios = await Usuario.countDocuments();
    const totalAdmins = await Admin.countDocuments();
    res.json({
      success: true,
      data: { usuarios: totalUsuarios, administradores: totalAdmins, total: totalUsuarios + totalAdmins }
    });
  } catch (err) {
    console.error('Error en /api/usuarios/estadisticas:', err);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
});

// === RUTAS NOTICIAS ===
app.post('/api/noticias', requireAdmin, upload.single('imagen'), async (req, res) => {
  try {
    const { titulo, descripcion, url } = req.body;
    const imagen = req.file ? req.file.filename : null;
    const nuevaNoticia = new Noticia({ titulo, descripcion, url, imagen, autor: req.session.adminUsername });
    await nuevaNoticia.save();
    res.json({ success: true, message: 'Noticia publicada' });
  } catch (err) {
    console.error('Error al subir noticia:', err);
    res.status(500).json({ success: false, message: 'Error al publicar' });
  }
});

app.get('/api/noticias', async (req, res) => {
  try {
    const noticias = await Noticia.find().sort({ fecha: -1 });
    res.json(noticias);
  } catch (err) {
    console.error('Error al obtener noticias:', err);
    res.status(500).json({ error: 'Error al cargar noticias' });
  }
});

app.delete('/api/noticias/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Noticia.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Noticia no encontrada' });
    if (result.imagen) {
      fs.unlink(path.join(__dirname, 'public', result.imagen), () => {});
    }
    res.json({ success: true, message: 'Noticia eliminada' });
  } catch (err) {
    console.error('Error al eliminar noticia:', err);
    res.status(500).json({ success: false, message: 'Error al eliminar' });
  }
});

// === RUTAS EVENTOS ===
app.post('/api/eventos', requireAdmin, upload.single('imagen'), async (req, res) => {
  try {
    const { titulo, descripcion, fecha, contacto } = req.body;
    const imagen = req.file ? '/uploads/' + req.file.filename : null;
    const nuevoEvento = new Evento({ titulo, descripcion, fecha, contacto, imagen, autor: req.session.adminUsername });
    await nuevoEvento.save();
    res.json({ success: true, message: 'Evento publicado' });
  } catch (err) {
    console.error('Error al publicar evento:', err);
    res.status(500).json({ success: false, message: 'Error al publicar' });
  }
});

app.get('/api/eventos', async (req, res) => {
  try {
    const eventos = await Evento.find().sort({ fecha: 1 });
    res.json(eventos);
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar eventos' });
  }
});

app.delete('/api/eventos/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Evento.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false });
    if (result.imagen) fs.unlink(path.join(__dirname, 'public', result.imagen), () => {});
    res.json({ success: true, message: 'Evento eliminado' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// === RUTAS RECURSOS ===
app.post('/api/recursos', requireAdmin, async (req, res) => {
  try {
    const nuevo = new Recurso(req.body);
    await nuevo.save();
    res.json({ success: true, message: 'Recurso añadido' });
  } catch (err) {
    console.error('Error al guardar recurso:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/recursos', async (req, res) => {
  try {
    const recursos = await Recurso.find();
    res.json(recursos);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// === RUTAS OPORTUNIDADES ===
app.post('/api/oportunidades', requireAdmin, upload.single('imagen'), async (req, res) => {
  try {
    const { titulo, descripcion, url } = req.body;
    const imagen = req.file ? '/uploads/' + req.file.filename : null;
    const nuevaOportunidad = new Oportunidad({ titulo, descripcion, url, imagen, autor: req.session.adminUsername });
    await nuevaOportunidad.save();
    res.json({ success: true, message: 'Oportunidad publicada' });
  } catch (err) {
    console.error('Error al publicar oportunidad:', err);
    res.status(500).json({ success: false, message: 'Error al publicar' });
  }
});

app.get('/api/oportunidades', async (req, res) => {
  try {
    const oportunidades = await Oportunidad.find().sort({ fecha: -1 });
    res.json(oportunidades);
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar oportunidades' });
  }
});

app.delete('/api/oportunidades/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Oportunidad.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Oportunidad no encontrada' });
    if (result.imagen) fs.unlink(path.join(__dirname, 'public', result.imagen), () => {});
    res.json({ success: true, message: 'Oportunidad eliminada' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// === CONTEO DE USUARIOS ===
app.get('/api/usuarios/count', async (req, res) => {
  try {
    const totalUsuarios = await Usuario.countDocuments();
    const totalAdmins = await Admin.countDocuments();
    res.json({ estudiantes: totalUsuarios, administrativos: totalAdmins });
  } catch (err) {
    console.error('Error al contar usuarios:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// === REGISTRAR VISITA ===
app.post('/api/visitas', async (req, res) => {
  try {
    const { pagina } = req.body;
    if (!pagina) return res.status(400).json({ success: false, message: 'Falta página' });

    await new Visita({ pagina }).save();
    console.log(`Visita registrada: ${pagina} - ${new Date().toLocaleString()}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al registrar visita:', err);
    res.status(500).json({ success: false });
  }
});

// === ESTADÍSTICAS (ÚNICA Y CORREGIDA) ===
app.get('/api/estadisticas', requireAdmin, async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const hace7dias = new Date(hoy);
    hace7dias.setDate(hace7dias.getDate() - 6);

    const mañana = new Date(hoy);
    mañana.setDate(mañana.getDate() + 1);

    // Contadores dinámicos
    const eventosDinamicos = await Evento.countDocuments({ fecha: { $gte: hoy } });
    const recursosDinamicos = await Recurso.countDocuments();
    const oportunidadesDinamicas = await Oportunidad.countDocuments();
    const publicacionesHoy = await Promise.all([
      Noticia.countDocuments({ fecha: { $gte: hoy, $lt: mañana } }),
      Oportunidad.countDocuments({ fecha: { $gte: hoy, $lt: mañana } })
    ]);

    // Contadores estáticos
    const eventosEstaticos = 4;
    const recursosEstaticos = 5;
    const oportunidadesEstaticas = 0;

    // Visitas
    const visitas = await Visita.find({ fecha: { $gte: hace7dias } });
    console.log(`Visitas encontradas (7 días): ${visitas.length}`);

    const visitasPorDia = Array(7).fill(0);
    visitas.forEach(v => {
      const dia = v.fecha.getDay(); // 0=Domingo
      const indice = (dia + 6) % 7; // 0=Lunes
      visitasPorDia[indice]++;
    });

    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    res.json({
      success: true,
      data: {
        publicacionesHoy: publicacionesHoy[0] + publicacionesHoy[1],
        eventosProximos: eventosEstaticos + eventosDinamicos,
        recursosDisponibles: recursosEstaticos + recursosDinamicos,
        oportunidadesDisponibles: oportunidadesEstaticas + oportunidadesDinamicas,
        visitasPorDia,
        diasSemana
      }
    });
  } catch (err) {
    console.error('Error en /api/estadisticas:', err);
    res.status(500).json({ success: false });
  }
});

// === RUTAS PÁGINAS ADMIN ===
app.get('/estadisticas_admin.html', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'estadisticas_admin.html')));
app.get('/perfiladmin.html', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'perfiladmin.html')));
app.get('/noticias_admin.html', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'noticias_admin.html')));
app.get('/añadir_noticia.html', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'añadir_noticia.html')));
app.get('/usuarios_admin.html', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'usuarios_admin.html')));

// === RUTA RAÍZ ===
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// === LOGOUT ===
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

// === INICIAR SERVIDOR ===
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;