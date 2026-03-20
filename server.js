const express = require('express');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://humberto:@humberto_proyect_postgres_sql:5432/clinica'
});

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'clinica-dental-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'clinica123';

function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// --- AUTH ---
app.get('/api/session', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Credenciales incorrectas' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// --- DASHBOARD ---
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const totalPacientes = await pool.query('SELECT COUNT(*) FROM pacientes');
    const citasHoy = await pool.query(
      "SELECT c.*, p.nombre as paciente FROM citas c JOIN pacientes p ON c.paciente_telefono = p.telefono WHERE c.fecha_cita = CURRENT_DATE ORDER BY c.hora_cita"
    );
    const proximasCitas = await pool.query(
      "SELECT c.*, p.nombre as paciente FROM citas c JOIN pacientes p ON c.paciente_telefono = p.telefono WHERE c.fecha_cita >= CURRENT_DATE AND c.estado != 'Cancelada' ORDER BY c.fecha_cita, c.hora_cita LIMIT 10"
    );
    res.json({
      totalPacientes: totalPacientes.rows[0].count,
      citasHoy: citasHoy.rows,
      proximasCitas: proximasCitas.rows,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.json({ totalPacientes: 0, citasHoy: [], proximasCitas: [] });
  }
});

// --- PACIENTES ---
app.get('/api/pacientes', requireAuth, async (req, res) => {
  try {
    const buscar = req.query.buscar || '';
    let query = 'SELECT * FROM pacientes';
    let params = [];
    if (buscar) {
      query += ' WHERE nombre ILIKE $1 OR telefono ILIKE $1 OR email ILIKE $1';
      params = [`%${buscar}%`];
    }
    query += ' ORDER BY nombre';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

app.post('/api/pacientes', requireAuth, async (req, res) => {
  try {
    const { telefono, nombre, email, fecha_nacimiento, notas } = req.body;
    const result = await pool.query(
      'INSERT INTO pacientes (telefono, nombre, email, fecha_nacimiento, notas) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [telefono, nombre, email || '', fecha_nacimiento || '', notas || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al crear paciente. Verificá que el teléfono no esté duplicado.' });
  }
});

app.put('/api/pacientes/:id', requireAuth, async (req, res) => {
  try {
    const { telefono, nombre, email, fecha_nacimiento, notas } = req.body;
    await pool.query(
      'UPDATE pacientes SET telefono=$1, nombre=$2, email=$3, fecha_nacimiento=$4, notas=$5 WHERE id=$6',
      [telefono, nombre, email || '', fecha_nacimiento || '', notas || '', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al actualizar paciente.' });
  }
});

app.delete('/api/pacientes/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM citas WHERE paciente_telefono = (SELECT telefono FROM pacientes WHERE id = $1)', [req.params.id]);
    await pool.query('DELETE FROM pacientes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al eliminar paciente.' });
  }
});

// --- CITAS ---
app.get('/api/citas', requireAuth, async (req, res) => {
  try {
    const { fecha, estado } = req.query;
    let query = "SELECT c.*, p.nombre as paciente FROM citas c JOIN pacientes p ON c.paciente_telefono = p.telefono WHERE 1=1";
    let params = [];
    let i = 1;
    if (fecha) { query += ` AND c.fecha_cita = $${i++}`; params.push(fecha); }
    if (estado) { query += ` AND c.estado = $${i++}`; params.push(estado); }
    query += ' ORDER BY c.fecha_cita DESC, c.hora_cita';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

app.post('/api/citas', requireAuth, async (req, res) => {
  try {
    const { paciente_telefono, fecha_cita, hora_cita, tipo_cita, estado, notas } = req.body;
    const paciente = await pool.query('SELECT nombre FROM pacientes WHERE telefono = $1', [paciente_telefono]);
    const paciente_nombre = paciente.rows[0]?.nombre || '';
    const result = await pool.query(
      'INSERT INTO citas (paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado || 'Pendiente', notas || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al crear cita.' });
  }
});

app.put('/api/citas/:id', requireAuth, async (req, res) => {
  try {
    const { paciente_telefono, fecha_cita, hora_cita, tipo_cita, estado, notas } = req.body;
    const paciente = await pool.query('SELECT nombre FROM pacientes WHERE telefono = $1', [paciente_telefono]);
    const paciente_nombre = paciente.rows[0]?.nombre || '';
    await pool.query(
      'UPDATE citas SET paciente_telefono=$1, paciente_nombre=$2, fecha_cita=$3, hora_cita=$4, tipo_cita=$5, estado=$6, notas=$7 WHERE id=$8',
      [paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas || '', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al actualizar cita.' });
  }
});

app.delete('/api/citas/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM citas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al eliminar cita.' });
  }
});

// --- SERVE REACT BUILD ---
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Panel Clínica Dental corriendo en puerto ${PORT}`);
});
