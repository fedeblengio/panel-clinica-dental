const express = require('express');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://humberto:@humberto_proyect_postgres_sql:5432/clinica'
});

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'clinica-dental-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 horas
}));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.redirect('/login');
}

// Auth config
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'clinica123';

// --- AUTH ROUTES ---
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.authenticated = true;
    return res.redirect('/');
  }
  res.render('login', { error: 'Usuario o contraseña incorrectos' });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// --- DASHBOARD ---
app.get('/', requireAuth, async (req, res) => {
  try {
    const totalPacientes = await pool.query('SELECT COUNT(*) FROM pacientes');
    const citasHoy = await pool.query(
      "SELECT c.*, p.nombre as paciente FROM citas c JOIN pacientes p ON c.paciente_telefono = p.telefono WHERE c.fecha_cita = CURRENT_DATE ORDER BY c.hora_cita"
    );
    const proximasCitas = await pool.query(
      "SELECT c.*, p.nombre as paciente FROM citas c JOIN pacientes p ON c.paciente_telefono = p.telefono WHERE c.fecha_cita >= CURRENT_DATE AND c.estado != 'Cancelada' ORDER BY c.fecha_cita, c.hora_cita LIMIT 10"
    );
    res.render('dashboard', {
      totalPacientes: totalPacientes.rows[0].count,
      citasHoy: citasHoy.rows,
      proximasCitas: proximasCitas.rows
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('dashboard', { totalPacientes: 0, citasHoy: [], proximasCitas: [] });
  }
});

// --- PACIENTES ROUTES ---
app.get('/pacientes', requireAuth, async (req, res) => {
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
    res.render('pacientes', { pacientes: result.rows, buscar });
  } catch (err) {
    console.error('Pacientes error:', err);
    res.render('pacientes', { pacientes: [], buscar: '' });
  }
});

app.get('/pacientes/nuevo', requireAuth, (req, res) => {
  res.render('paciente-form', { paciente: null, error: null });
});

app.post('/pacientes/nuevo', requireAuth, async (req, res) => {
  try {
    const { telefono, nombre, email, fecha_nacimiento, notas } = req.body;
    await pool.query(
      'INSERT INTO pacientes (telefono, nombre, email, fecha_nacimiento, notas) VALUES ($1, $2, $3, $4, $5)',
      [telefono, nombre, email || '', fecha_nacimiento || '', notas || '']
    );
    res.redirect('/pacientes');
  } catch (err) {
    console.error('Create paciente error:', err);
    res.render('paciente-form', { paciente: req.body, error: 'Error al crear paciente. Verificá que el teléfono no esté duplicado.' });
  }
});

app.get('/pacientes/editar/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pacientes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.redirect('/pacientes');
    res.render('paciente-form', { paciente: result.rows[0], error: null });
  } catch (err) {
    res.redirect('/pacientes');
  }
});

app.post('/pacientes/editar/:id', requireAuth, async (req, res) => {
  try {
    const { telefono, nombre, email, fecha_nacimiento, notas } = req.body;
    await pool.query(
      'UPDATE pacientes SET telefono=$1, nombre=$2, email=$3, fecha_nacimiento=$4, notas=$5 WHERE id=$6',
      [telefono, nombre, email || '', fecha_nacimiento || '', notas || '', req.params.id]
    );
    res.redirect('/pacientes');
  } catch (err) {
    console.error('Update paciente error:', err);
    const result = await pool.query('SELECT * FROM pacientes WHERE id = $1', [req.params.id]);
    res.render('paciente-form', { paciente: result.rows[0], error: 'Error al actualizar paciente.' });
  }
});

app.post('/pacientes/eliminar/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM citas WHERE paciente_telefono = (SELECT telefono FROM pacientes WHERE id = $1)', [req.params.id]);
    await pool.query('DELETE FROM pacientes WHERE id = $1', [req.params.id]);
    res.redirect('/pacientes');
  } catch (err) {
    console.error('Delete paciente error:', err);
    res.redirect('/pacientes');
  }
});

// --- CITAS ROUTES ---
app.get('/citas', requireAuth, async (req, res) => {
  try {
    const { fecha, estado } = req.query;
    let query = "SELECT c.*, p.nombre as paciente FROM citas c JOIN pacientes p ON c.paciente_telefono = p.telefono WHERE 1=1";
    let params = [];
    let i = 1;
    if (fecha) {
      query += ` AND c.fecha_cita = $${i++}`;
      params.push(fecha);
    }
    if (estado) {
      query += ` AND c.estado = $${i++}`;
      params.push(estado);
    }
    query += ' ORDER BY c.fecha_cita DESC, c.hora_cita';
    const result = await pool.query(query, params);
    res.render('citas', { citas: result.rows, fecha: fecha || '', estado: estado || '' });
  } catch (err) {
    console.error('Citas error:', err);
    res.render('citas', { citas: [], fecha: '', estado: '' });
  }
});

app.get('/citas/nueva', requireAuth, async (req, res) => {
  try {
    const pacientes = await pool.query('SELECT telefono, nombre FROM pacientes ORDER BY nombre');
    res.render('cita-form', { cita: null, pacientes: pacientes.rows, error: null });
  } catch (err) {
    res.render('cita-form', { cita: null, pacientes: [], error: 'Error al cargar pacientes' });
  }
});

app.post('/citas/nueva', requireAuth, async (req, res) => {
  try {
    const { paciente_telefono, fecha_cita, hora_cita, tipo_cita, estado, notas } = req.body;
    const paciente = await pool.query('SELECT nombre FROM pacientes WHERE telefono = $1', [paciente_telefono]);
    const paciente_nombre = paciente.rows[0]?.nombre || '';
    await pool.query(
      'INSERT INTO citas (paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado || 'Pendiente', notas || '']
    );
    res.redirect('/citas');
  } catch (err) {
    console.error('Create cita error:', err);
    const pacientes = await pool.query('SELECT telefono, nombre FROM pacientes ORDER BY nombre');
    res.render('cita-form', { cita: req.body, pacientes: pacientes.rows, error: 'Error al crear cita.' });
  }
});

app.get('/citas/editar/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM citas WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.redirect('/citas');
    const pacientes = await pool.query('SELECT telefono, nombre FROM pacientes ORDER BY nombre');
    res.render('cita-form', { cita: result.rows[0], pacientes: pacientes.rows, error: null });
  } catch (err) {
    res.redirect('/citas');
  }
});

app.post('/citas/editar/:id', requireAuth, async (req, res) => {
  try {
    const { paciente_telefono, fecha_cita, hora_cita, tipo_cita, estado, notas } = req.body;
    const paciente = await pool.query('SELECT nombre FROM pacientes WHERE telefono = $1', [paciente_telefono]);
    const paciente_nombre = paciente.rows[0]?.nombre || '';
    await pool.query(
      'UPDATE citas SET paciente_telefono=$1, paciente_nombre=$2, fecha_cita=$3, hora_cita=$4, tipo_cita=$5, estado=$6, notas=$7 WHERE id=$8',
      [paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas || '', req.params.id]
    );
    res.redirect('/citas');
  } catch (err) {
    console.error('Update cita error:', err);
    res.redirect('/citas');
  }
});

app.post('/citas/eliminar/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM citas WHERE id = $1', [req.params.id]);
    res.redirect('/citas');
  } catch (err) {
    console.error('Delete cita error:', err);
    res.redirect('/citas');
  }
});

// Start
app.listen(PORT, () => {
  console.log(`Panel Clínica Dental corriendo en puerto ${PORT}`);
});
