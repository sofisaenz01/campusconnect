const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();

// Sirve archivos estáticos desde la carpeta 'public'
app.use(express.static('public'));

// Middleware para parsear datos del formulario
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Conexión a MongoDB
mongoose.connect("mongodb://localhost:27017/campusconnect")
    .then(() => console.log("Connected to Database"))
    .catch(err => console.log("MongoDB connection error:", err));

// Ruta por defecto (redirecciona a index-connection.html o registro.html)
app.get('/', (req, res) => {
    const filePath = 'C:/Users/Sebastian/campusconnect/public/index-connection.html';
    console.log('Attempting to serve file at:', filePath);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error serving file:', err.message);
            if (err.code === 'ENOENT') {
                res.status(404).send('File not found: ' + filePath);
            } else if (err.code === 'EPERM') {
                res.status(403).send('Permission denied for: ' + filePath);
            } else {
                res.status(500).send('Server error: ' + err.message);
            }
        }
    });
});

// Ruta para el formulario de registro (ajústala según necesites)
app.post('/sign_up', (req, res) => {
    const data = {
        "name": req.body.name,
        "age": req.body.age,
        "email": req.body.email,
        "phone": req.body.phno,
        "gender": req.body.gender,
        "password": req.body.password
    };
    const db = mongoose.connection.db;
    db.collection('users').insertOne(data, (err, result) => {
        if (err) throw err;
        console.log("Record Inserted Successfully");
        res.redirect('/signup_success.html');
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
}).on('error', (err) => {
    console.log(`Error starting server: ${err.message}`);
});

module.exports = app; // Exporta app si lo usas en otro archivo