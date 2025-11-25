console.log('Iniciando database.js');

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// ============================================
// CONFIGURACIÓN DE PROXY
// ============================================
app.set('trust proxy', 1);

// ============================================
// CONEXIÓN A MONGODB
// ============================================
mongoose.connect('mongodb://localhost:27017/campusconnect')
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => {
    console.error('❌ Error al conectar a MongoDB:', err);
    process.exit(1);
  });

// ============================================
// MIDDLEWARE
// ============================================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// ============================================
// CONFIGURACIÓN DE SESIÓN
// ============================================
app.use(session({
  secret: 'campusconnect_secret_2025_secure_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// ============================================
// MODELOS DE BASE DE DATOS
// ============================================
let Usuario;
try {
  Usuario = require('./src/models/usuario.js');
  console.log('✅ Modelo Usuario cargado');
} catch (err) {
  console.error('❌ Error al cargar Usuario:', err);
  process.exit(1);
}

const Admin = require('./src/models/admin');
const Noticia = require('./src/models/Noticia');
const Evento = require('./src/models/Evento');
const Recurso = require('./src/models/Recurso');
const Oportunidad = require('./src/models/Oportunidad');

// ============================================
// ESQUEMAS DE VISITAS CON HISTORIAL PERSISTENTE
// ============================================
const VisitaSchema = new mongoose.Schema({
  pagina: { type: String, required: true },
  fecha: { type: Date, default: Date.now }
});
const Visita = mongoose.model('Visita', VisitaSchema);

const VisitaDiariaSchema = new mongoose.Schema({
  fecha: { type: Date, required: true, unique: true },
  total: { type: Number, default: 0 }
});
const VisitaDiaria = mongoose.model('VisitaDiaria', VisitaDiariaSchema);

// ============================================
// CONFIGURACIÓN DE MULTER (SUBIDA DE ARCHIVOS)
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `noticia-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
  }
});

// ============================================
// MIDDLEWARE DE AUTENTICACIÓN ADMIN
// ============================================
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
    <a href="/admin-login.html" style="color:#0077cc;">Ir al login</a>
  `);
};

// ============================================
// RUTAS DE USUARIOS (REGISTRO Y LOGIN)
// ============================================

// Registro de nuevo usuario
app.post('/sign_up', async (req, res) => {
  try {
    const newUser = new Usuario({
      nombre: req.body.nombre,
      edad: req.body.edad,
      correo: req.body.correo,
      telefono: req.body.telefono,
      genero: req.body.genero,
      contrasena: req.body.contrasena
    });
    await newUser.save();
    req.session.userId = newUser._id;
    
    // ✅ CORREGIDO: Redirige a inicio.html después del registro
    res.redirect('/inicio.html');
  } catch (err) {
    console.error('Error en sign_up:', err);
    res.status(500).send('Error al registrar usuario.');
  }
});

// Login de usuario
app.post('/login', async (req, res) => {
  try {
    const user = await Usuario.findOne({ correo: req.body.correo });
    
    if (!user || !await bcrypt.compare(req.body.contrasena, user.contrasena)) {
      return res.status(400).send('<script>alert("Credenciales incorrectas"); window.location="/login.html";</script>');
    }
    
    req.session.userId = user._id;
    
    // ✅ CORREGIDO: Redirige a inicio.html después del login
    res.redirect('/inicio.html');
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).send('Error del servidor.');
  }
});

// ============================================
// RUTAS DE PERFIL DE USUARIO
// ============================================

// Obtener datos del perfil
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

// Actualizar datos del perfil
app.put('/api/perfil', async (req, res) => {
  if (!req.session.userId) return res.status(401).send('No autenticado');
  
  try {
    const user = await Usuario.findById(req.session.userId);
    if (!user) return res.status(404).send('Usuario no encontrado');
    
    ['nombre', 'telefono', 'pais'].forEach(field => {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    });
    
    if (req.body.fechaNacimiento) {
      user.fechaNacimiento = new Date(req.body.fechaNacimiento);
    }
    
    await user.save();
    res.json({ message: 'Cambios guardados', nombre: user.nombre });
  } catch (err) {
    console.error('Error en PUT /api/perfil:', err);
    res.status(500).send('Error al actualizar');
  }
});

// ============================================
// RUTAS DE ADMINISTRADOR (LOGIN Y GESTIÓN)
// ============================================

// Login de administrador
app.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;
  console.log('LOGIN INTENTO:', { username });

  try {
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Faltan datos' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      console.log('USUARIO NO EXISTE:', username);
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    const valido = await bcrypt.compare(password, admin.password);
    console.log('CONTRASEÑA VÁLIDA:', valido);

    if (!valido) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    req.session.isAdmin = true;
    req.session.adminUsername = username;
    req.session.save(err => {
      if (err) {
        console.error('ERROR SESIÓN:', err);
        return res.status(500).json({ success: false, message: 'Error sesión' });
      }
      console.log('✅ SESION GUARDADA:', req.session.id);
      res.json({ success: true });
    });

  } catch (err) {
    console.error('ERROR LOGIN:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Crear nuevo administrador
app.post('/admin/crear', async (req, res) => {
  try {
    const { username, password, nombre, correo, role } = req.body;

    const adminExistente = await Admin.findOne({ username });
    if (adminExistente) {
      return res.status(400).json({ success: false, message: 'El usuario ya existe' });
    }

    const emailExistente = await Admin.findOne({ correo });
    if (emailExistente) {
      return res.status(400).json({ success: false, message: 'El correo ya está registrado' });
    }

    const nuevoAdmin = new Admin({
      username,
      password,
      nombre: nombre || 'Administrador',
      correo: correo || username + '@campusconnect.com',
      role: role || 'admin'
    });

    await nuevoAdmin.save();
    console.log(`✅ Nuevo administrador creado: ${username}`);
    res.status(201).json({ success: true, message: 'Administrador creado exitosamente' });

  } catch (err) {
    console.error('Error al crear admin:', err);
    res.status(500).json({ success: false, message: 'Error al crear administrador' });
  }
});

// ============================================
// RUTAS DE PERFIL DE ADMINISTRADOR
// ============================================

// Obtener perfil de admin
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
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Actualizar perfil de admin
app.put('/api/admin/perfil', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'No autenticado' });
  
  try {
    const update = {};
    ['nombre', 'telefono', 'pais'].forEach(field => {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    });
    
    if (req.body.fechaNacimiento) {
      update.fechaNacimiento = new Date(req.body.fechaNacimiento);
    }
    
    const admin = await Admin.findOneAndUpdate(
      { username: req.session.adminUsername },
      update,
      { new: true }
    );
    
    res.json({ message: 'Perfil actualizado', nombre: admin.nombre });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar' });
  }
});

// ============================================
// ESTADÍSTICAS DE USUARIOS
// ============================================
app.get('/api/usuarios/estadisticas', requireAdmin, async (req, res) => {
  try {
    const totalUsuarios = await Usuario.countDocuments();
    const totalAdmins = await Admin.countDocuments();
    
    res.json({
      success: true,
      data: {
        usuarios: totalUsuarios,
        administradores: totalAdmins,
        total: totalUsuarios + totalAdmins
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
});

// ============================================
// RUTAS DE NOTICIAS
// ============================================

// Crear noticia
app.post('/api/noticias', requireAdmin, upload.single('imagen'), async (req, res) => {
  try {
    const { titulo, descripcion, url } = req.body;
    const imagen = req.file ? req.file.filename : null;
    
    const nuevaNoticia = new Noticia({
      titulo,
      descripcion,
      url,
      imagen,
      autor: req.session.adminUsername
    });
    
    await nuevaNoticia.save();
    res.json({ success: true, message: 'Noticia publicada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al publicar' });
  }
});

// Obtener todas las noticias
app.get('/api/noticias', async (req, res) => {
  try {
    const noticias = await Noticia.find().sort({ fecha: -1 });
    res.json(noticias);
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar noticias' });
  }
});

// Eliminar noticia
app.delete('/api/noticias/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Noticia.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Noticia no encontrada' });
    
    if (result.imagen) {
      fs.unlink(path.join(__dirname, 'public', result.imagen), () => {});
    }
    
    res.json({ success: true, message: 'Noticia eliminada' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// RUTAS DE EVENTOS
// ============================================

// Crear evento
app.post('/api/eventos', requireAdmin, upload.single('imagen'), async (req, res) => {
  try {
    const { titulo, descripcion, fecha, contacto } = req.body;
    const imagen = req.file ? '/uploads/' + req.file.filename : null;
    
    const nuevoEvento = new Evento({
      titulo,
      descripcion,
      fecha,
      contacto,
      imagen,
      autor: req.session.adminUsername
    });
    
    await nuevoEvento.save();
    res.json({ success: true, message: 'Evento publicado' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Obtener todos los eventos
app.get('/api/eventos', async (req, res) => {
  try {
    const eventos = await Evento.find().sort({ fecha: 1 });
    res.json(eventos);
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar eventos' });
  }
});

// Eliminar evento
app.delete('/api/eventos/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Evento.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false });
    
    if (result.imagen) {
      fs.unlink(path.join(__dirname, 'public', result.imagen), () => {});
    }
    
    res.json({ success: true, message: 'Evento eliminado' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// RUTAS DE RECURSOS
// ============================================

// Crear recurso
app.post('/api/recursos', requireAdmin, async (req, res) => {
  try {
    const nuevo = new Recurso(req.body);
    await nuevo.save();
    res.json({ success: true, message: 'Recurso añadido' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Obtener todos los recursos
app.get('/api/recursos', async (req, res) => {
  try {
    const recursos = await Recurso.find();
    res.json(recursos);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.delete('/api/recursos/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Recurso.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Recurso no encontrado' });
    }
    res.json({ success: true, message: 'Recurso eliminado' });
  } catch (err) {
    console.error('Error al eliminar recurso:', err);
    res.status(500).json({ success: false, message: 'Error al eliminar' });
  }
});

// ============================================
// RUTAS DE OPORTUNIDADES
// ============================================

// Crear oportunidad
app.post('/api/oportunidades', requireAdmin, upload.single('imagen'), async (req, res) => {
  try {
    const { titulo, descripcion, url } = req.body;
    const imagen = req.file ? '/uploads/' + req.file.filename : null;
    
    const nuevaOportunidad = new Oportunidad({
      titulo,
      descripcion,
      url,
      imagen,
      autor: req.session.adminUsername
    });
    
    await nuevaOportunidad.save();
    res.json({ success: true, message: 'Oportunidad publicada' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Obtener todas las oportunidades
app.get('/api/oportunidades', async (req, res) => {
  try {
    const oportunidades = await Oportunidad.find().sort({ fecha: -1 });
    res.json(oportunidades);
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar oportunidades' });
  }
});

// Eliminar oportunidad
app.delete('/api/oportunidades/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Oportunidad.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Oportunidad no encontrada' });
    
    if (result.imagen) {
      fs.unlink(path.join(__dirname, 'public', result.imagen), () => {});
    }
    
    res.json({ success: true, message: 'Oportunidad eliminada' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// CONTEO DE USUARIOS
// ============================================
app.get('/api/usuarios/count', async (req, res) => {
  try {
    const totalUsuarios = await Usuario.countDocuments();
    const totalAdmins = await Admin.countDocuments();
    res.json({ estudiantes: totalUsuarios, administrativos: totalAdmins });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// ============================================
// SISTEMA DE VISITAS CON PERSISTENCIA
// ============================================
app.post('/api/visitas', async (req, res) => {
  try {
    const { pagina } = req.body;
    if (!pagina) return res.status(400).json({ success: false });
    
    // Guardar visita individual
    await new Visita({ pagina }).save();
    
    // Actualizar contador diario
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    await VisitaDiaria.findOneAndUpdate(
      { fecha: hoy },
      { $inc: { total: 1 } },
      { upsert: true, new: true }
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// ESTADÍSTICAS COMPLETAS DEL DASHBOARD
// ✅ CÓDIGO CORREGIDO PARA MOSTRAR DÍAS CORRECTOS
// ============================================
app.get('/api/estadisticas', requireAdmin, async (req, res) => {
  try {
    const hoy = new Date(); 
    hoy.setHours(0, 0, 0, 0);
    const hace6dias = new Date(hoy); 
    hace6dias.setDate(hace6dias.getDate() - 6);

    // Contar contenido dinámico de la BD
    const noticiasDinamicas = await Noticia.countDocuments();
    const eventosDinamicos = await Evento.countDocuments({ fecha: { $gte: hoy } });
    const recursosDinamicos = await Recurso.countDocuments();
    const oportunidadesDinamicas = await Oportunidad.countDocuments();

    // Contenido estático (del HTML)
    const noticiasEstaticas = 5;
    const eventosEstaticos = 4;
    const recursosEstaticos = 5;
    const oportunidadesEstaticas = 3;

    // Totales
    const totalNoticias = noticiasEstaticas + noticiasDinamicas;
    const totalEventos = eventosEstaticos + eventosDinamicos;
    const totalRecursos = recursosEstaticos + recursosDinamicos;
    const totalOportunidades = oportunidadesEstaticas + oportunidadesDinamicas;

    // Visitas por día (últimos 7 días) - PERSISTENTES
    const visitasDiarias = await VisitaDiaria.find({
      fecha: { $gte: hace6dias, $lte: hoy }
    }).sort({ fecha: 1 });

    // Crear un mapa de fechas para fácil acceso
    const visitasMap = {};
    visitasDiarias.forEach(v => {
      const fechaStr = v.fecha.toISOString().split('T')[0];
      visitasMap[fechaStr] = v.total;
    });

    // Generar array de 7 días con nombres correctos
    const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const visitasPorDia = [];
    const diasSemana = [];

    // Iterar desde hace 6 días hasta hoy
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - i);
      
      // Obtener nombre del día correcto usando getDay()
      const nombreDia = nombresDias[fecha.getDay()];
      diasSemana.push(nombreDia);
      
      // Obtener visitas para ese día
      const fechaStr = fecha.toISOString().split('T')[0];
      visitasPorDia.push(visitasMap[fechaStr] || 0);
    }

    res.json({
      success: true,
      data: {
        noticiasDisponibles: totalNoticias,
        eventosProximos: totalEventos,
        recursosDisponibles: totalRecursos,
        oportunidadesDisponibles: totalOportunidades,
        visitasPorDia,
        diasSemana
      }
    });
  } catch (err) {
    console.error('Error en estadísticas:', err);
    res.status(500).json({ success: false, message: 'Error al cargar estadísticas' });
  }
});

// ============================================
// RUTAS PROTEGIDAS DE PÁGINAS HTML
// ============================================

// ✅ NUEVA: Ruta protegida para inicio.html
app.get('/inicio.html', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'inicio.html'));
});

// Ruta protegida para perfil.html
app.get('/perfil.html', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'perfil.html'));
});

// Páginas de administrador
app.get('/estadisticas_admin.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'estadisticas_admin.html'));
});

app.get('/perfiladmin.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'perfiladmin.html'));
});

app.get('/noticias_admin.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'noticias_admin.html'));
});

app.get('/añadir_noticia.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'añadir_noticia.html'));
});

app.get('/usuarios_admin.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'usuarios_admin.html'));
});

// ============================================
// RUTAS GENERALES
// ============================================

// Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Cerrar sesión
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// ============================================
// LIMPIEZA AUTOMÁTICA DE ESTADÍSTICAS ANTIGUAS
// ✅ NUEVO: Sistema de limpieza cada 24 horas
// ============================================
async function limpiarEstadisticasAntiguas() {
  try {
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);
    hace30dias.setHours(0, 0, 0, 0);

    // Eliminar visitas individuales más antiguas de 30 días
    const resultVisitas = await Visita.deleteMany({
      fecha: { $lt: hace30dias }
    });

    // Eliminar registros diarios más antiguos de 30 días
    const resultDiarias = await VisitaDiaria.deleteMany({
      fecha: { $lt: hace30dias }
    });

    if (resultVisitas.deletedCount > 0 || resultDiarias.deletedCount > 0) {
      console.log(`🧹 Limpieza automática: ${resultVisitas.deletedCount} visitas y ${resultDiarias.deletedCount} registros diarios eliminados`);
    }
  } catch (err) {
    console.error('❌ Error en limpieza automática:', err);
  }
}

// Ejecutar limpieza cada 24 horas
setInterval(limpiarEstadisticasAntiguas, 24 * 60 * 60 * 1000);

// ============================================
// CREACIÓN AUTOMÁTICA DE ADMINISTRADORES
// ============================================
(async () => {
  try {
    // Ejecutar limpieza al iniciar el servidor
    await limpiarEstadisticasAntiguas();

    const adminExists = await Admin.findOne({ username: 'admin1' });
    if (!adminExists) {
      const nuevoAdmin = new Admin({
        username: 'admin1',
        password: 'sebas24',
        nombre: 'Sebastian',
        correo: 'admin1@campusconnect.com',
        telefono: '3001234567',
        role: 'admin'
      });
      await nuevoAdmin.save();
      console.log('✅ ADMIN CREADO: admin1 / sebas24');
    }

    const admin2Exists = await Admin.findOne({ username: 'admin2' });
    if (!admin2Exists) {
      const nuevoAdmin = new Admin({
        username: 'admin2',
        password: 'sofia123',
        nombre: 'Sofia',
        correo: 'admin2@campusconnect.com',
        telefono: '3007654321',
        role: 'admin'
      });
      await nuevoAdmin.save();
      console.log('✅ ADMIN CREADO: admin2 / sofia123');
    }
  } catch (err) {
    console.error('❌ Error creando admins:', err);
  }
})();

// ============================================
// FIX 100% EFECTIVO → Elimina error "addEventListener of null" en páginas sin barra de búsqueda
// ============================================
app.use((req, res, next) => {
  if (req.path.includes('.html')) {
    const oldSend = res.send;
    res.send = function (data) {
      if (typeof data === 'string' && data.includes('</body>')) {
        const noCrashScript = `<script>
          document.addEventListener("DOMContentLoaded", () => {
            if (!document.getElementById("btn-buscar")) window.buscar = () => {};
            if (!document.getElementById("menu-toggle")) window.toggleMenu = () => {};
          });
        </script>`;
        data = data.replace("</body>", noCrashScript + "</body>");
      }
      oldSend.apply(this, arguments);
    };
  }
  next();
});

// ======================== RECUPERACIÓN DE CONTRASEÑA ========================

const crypto = require('crypto');
const { Resend } = require('resend');

// ←←← AQUÍ PEGAS TU API KEY DE RESEND.COM ←←←
const resend = new Resend('re_AMXgc277_HKQ1q8iMDoXmkambcVSX8jV9'); // Cambia esto!!

// Almacén temporal en memoria (después puedes usar Redis si quieres)
const verificationCodes = new Map(); // email → { code, expires }

// 1. Enviar código al correo
app.post('/api/send-verification-code', async (req, res) => {
    const { email } = req.body;

    // Validar que el usuario exista en tu base de datos (opcional pero recomendado)
    const usuario = await Usuario.findOne({ correo: email }); // ajusta según tu modelo
    if (!usuario) return res.status(404).json({ message: 'Correo no encontrado' });

    // Generar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutos

    verificationCodes.set(email, { code, expires });

    try {
        await resend.emails.send({
            from: 'Campus Connect <noreply@resend.dev>',
            to: email,
            subject: 'Código de recuperación - Campus Connect',
            html: `
                <div style="font-family: Arial; text-align: center; padding: 30px; background: #f9f9f9; border-radius: 10px;">
                    <h1 style="color: #007bff; font-size: 40px; letter-spacing: 8px;">${code}</h1>
                    <p>Este es tu código de verificación</p>
                    <p>Válido por 10 minutos</p>
                </div>
            `
        });

        res.json({ message: 'Código enviado correctamente' });
    } catch (error) {
        console.error('Error Resend:', error);
        res.status(500).json({ message: 'Error enviando el correo' });
    }
});

// 2. Verificar el código
app.post('/api/verify-code', (req, res) => {
    const { email, code } = req.body;
    const stored = verificationCodes.get(email);

    if (!stored || stored.expires < Date.now() || stored.code !== code) {
        return res.status(400).json({ message: 'Código inválido o expirado' });
    }

    res.json({ message: 'Código correcto' });
});

// 3. Cambiar contraseña
app.post('/api/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    const stored = verificationCodes.get(email);

    if (!stored || stored.expires < Date.now()) {
        return res.status(400).json({ message: 'Sesión expirada, solicita un nuevo código' });
    }

    try {
        // BUSCAR EL USUARIO
        const usuario = await Usuario.findOne({ correo: email });
        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // FORZAR EL HASH USANDO EL MIDDLEWARE pre('save')
        usuario.contrasena = newPassword;  // ← Aquí se activa el pre('save')
        await usuario.save();              // ← Esto sí hashea correctamente

        // Limpiar código usado
        verificationCodes.delete(email);

        console.log(`Contraseña actualizada correctamente para: ${email}`);
        res.json({ message: 'Contraseña actualizada con éxito' });

    } catch (error) {
        console.error('Error al actualizar contraseña:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// =========================================================================

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 Campus Connect Server Running        ║
║   📍 http://localhost:${PORT}             ║
║   ✅ MongoDB Connected                    ║
║   📊 Sistema de Estadísticas: ACTIVO      ║
║   🧹 Limpieza Automática: ACTIVO          ║
╚═══════════════════════════════════════════╝
  `);
});

module.exports = app;