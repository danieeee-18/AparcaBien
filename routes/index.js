import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../public/data/users.json');

// Si no existe, crear la BD de mentira vacía
if (!fs.existsSync(dbPath)) {
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  fs.writeFileSync(dbPath, JSON.stringify({}));
}

function getDB() {
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Vista principal
router.get('/', (req, res) => {
  res.render('index', { title: 'AparcaBien' });
});

// Autenticación básica
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username && password === '1234') {
    req.session.user = { username };
    res.json({ success: true, username });
  } else {
    res.json({ success: false, error: 'Credenciales inválidas (usa "1234")' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Sincronización remoto (Backup)
router.post('/api/sync', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  const user = req.session.user.username;
  const clientData = req.body; // { parkingActual, historial }
  
  const db = getDB();
  db[user] = clientData; // guardamos en "base de datos"
  saveDB(db);
  
  res.json({ success: true, message: 'Datos sincronizados en remoto' });
});

router.get('/api/sync', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  const user = req.session.user.username;
  const db = getDB();
  const data = db[user] || { parkingActual: null, historial: [] };
  
  res.json(data);
});

export default router;
