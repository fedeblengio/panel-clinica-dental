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

// --- RATE LIMITING ---
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '5', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '120000', 10); // 2 min default
const loginAttempts = new Map();

function getRateLimitInfo(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return null;
  if (now > record.blockedUntil) {
    loginAttempts.delete(ip);
    return null;
  }
  return record;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  let record = loginAttempts.get(ip);
  if (!record || now > record.blockedUntil) {
    record = { attempts: 0, blockedUntil: 0 };
  }
  record.attempts++;
  if (record.attempts >= RATE_LIMIT_MAX) {
    record.blockedUntil = now + RATE_LIMIT_WINDOW_MS;
  }
  loginAttempts.set(ip, record);
  return record;
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts) {
    if (now > record.blockedUntil) loginAttempts.delete(ip);
  }
}, 10 * 60 * 1000);

function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// --- AUTO-CREATE TABLES ---
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configuracion_clinica (
        id SERIAL PRIMARY KEY,
        nombre_clinica VARCHAR(255) DEFAULT 'Mi Clínica Dental',
        direccion TEXT DEFAULT '',
        telefono VARCHAR(50) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        nombre_bot VARCHAR(100) DEFAULT 'Sofía',
        horarios JSONB DEFAULT '{"lunes":{"abre":"08:00","cierra":"18:00","cerrado":false},"martes":{"abre":"08:00","cierra":"18:00","cerrado":false},"miercoles":{"abre":"08:00","cierra":"18:00","cerrado":false},"jueves":{"abre":"08:00","cierra":"18:00","cerrado":false},"viernes":{"abre":"08:00","cierra":"18:00","cerrado":false},"sabado":{"abre":"08:00","cierra":"12:00","cerrado":false},"domingo":{"abre":"","cierra":"","cerrado":true}}',
        servicios JSONB DEFAULT '[]',
        mensaje_bienvenida TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Insert default row if empty
    const count = await pool.query('SELECT COUNT(*) FROM configuracion_clinica');
    if (parseInt(count.rows[0].count) === 0) {
      await pool.query("INSERT INTO configuracion_clinica DEFAULT VALUES");
    }
    console.log('Tabla configuracion_clinica lista');
  } catch (err) {
    console.error('Error creando tabla configuracion_clinica:', err.message);
  }
}
initDB();

// --- AUTH ---
app.get('/api/session', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

app.post('/api/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const blocked = getRateLimitInfo(ip);
  if (blocked) {
    const remaining = Math.ceil((blocked.blockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      error: `Demasiados intentos. Esperá ${remaining} segundos para intentar de nuevo.`,
      blockedFor: remaining
    });
  }

  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    clearAttempts(ip);
    req.session.authenticated = true;
    return res.json({ ok: true });
  }

  const record = recordFailedAttempt(ip);
  const attemptsLeft = RATE_LIMIT_MAX - record.attempts;
  if (attemptsLeft <= 0) {
    const remaining = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    return res.status(429).json({
      error: `Demasiados intentos. Esperá ${remaining} segundos para intentar de nuevo.`,
      blockedFor: remaining
    });
  }
  res.status(401).json({
    error: `Credenciales incorrectas. Te quedan ${attemptsLeft} intentos.`
  });
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

// --- DASHBOARD METRICS ---
app.get('/api/metricas', requireAuth, async (req, res) => {
  try {
    // Citas por mes (last 6 months)
    const citasPorMes = await pool.query(`
      SELECT
        TO_CHAR(fecha_cita, 'YYYY-MM') as mes,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'Completada') as completadas,
        COUNT(*) FILTER (WHERE estado = 'Cancelada') as canceladas,
        COUNT(*) FILTER (WHERE estado = 'Pendiente' AND fecha_cita < CURRENT_DATE) as no_show
      FROM citas
      WHERE fecha_cita >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(fecha_cita, 'YYYY-MM')
      ORDER BY mes
    `);

    // Pacientes nuevos por mes
    const pacientesNuevos = await pool.query(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') as mes,
        COUNT(*) as total
      FROM pacientes
      WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY mes
    `);

    // Resumen general
    const resumen = await pool.query(`
      SELECT
        COUNT(*) as total_citas,
        COUNT(*) FILTER (WHERE estado = 'Completada') as completadas,
        COUNT(*) FILTER (WHERE estado = 'Cancelada') as canceladas,
        COUNT(*) FILTER (WHERE estado = 'Pendiente' AND fecha_cita < CURRENT_DATE) as no_show
      FROM citas
      WHERE fecha_cita >= CURRENT_DATE - INTERVAL '30 days'
    `);

    // Recordatorios enviados (last 30 days)
    const recordatorios = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE recordatorio_24h = true) as enviados_24h,
        COUNT(*) FILTER (WHERE recordatorio_1h = true) as enviados_1h
      FROM citas
      WHERE fecha_cita >= CURRENT_DATE - INTERVAL '30 days'
    `);

    // Citas esta semana por dia
    const citasSemana = await pool.query(`
      SELECT
        TO_CHAR(fecha_cita, 'Dy') as dia,
        fecha_cita::text as fecha,
        COUNT(*) as total
      FROM citas
      WHERE fecha_cita >= date_trunc('week', CURRENT_DATE)
        AND fecha_cita < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
      GROUP BY fecha_cita, TO_CHAR(fecha_cita, 'Dy')
      ORDER BY fecha_cita
    `);

    res.json({
      citasPorMes: citasPorMes.rows,
      pacientesNuevos: pacientesNuevos.rows,
      resumen: resumen.rows[0] || { total_citas: 0, completadas: 0, canceladas: 0, no_show: 0 },
      recordatorios: recordatorios.rows[0] || { enviados_24h: 0, enviados_1h: 0 },
      citasSemana: citasSemana.rows,
    });
  } catch (err) {
    console.error('Metricas error:', err);
    res.json({
      citasPorMes: [], pacientesNuevos: [], citasSemana: [],
      resumen: { total_citas: 0, completadas: 0, canceladas: 0, no_show: 0 },
      recordatorios: { enviados_24h: 0, enviados_1h: 0 },
    });
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
    const { fecha, estado, desde, hasta } = req.query;
    let query = "SELECT c.*, p.nombre as paciente FROM citas c JOIN pacientes p ON c.paciente_telefono = p.telefono WHERE 1=1";
    let params = [];
    let i = 1;
    if (fecha) { query += ` AND c.fecha_cita = $${i++}`; params.push(fecha); }
    if (estado) { query += ` AND c.estado = $${i++}`; params.push(estado); }
    if (desde) { query += ` AND c.fecha_cita >= $${i++}`; params.push(desde); }
    if (hasta) { query += ` AND c.fecha_cita <= $${i++}`; params.push(hasta); }
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

// --- CONFIGURACION ---
app.get('/api/configuracion', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM configuracion_clinica LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('Config error:', err);
    res.json({});
  }
});

app.put('/api/configuracion', requireAuth, async (req, res) => {
  try {
    const { nombre_clinica, direccion, telefono, email, nombre_bot, horarios, servicios, mensaje_bienvenida } = req.body;
    await pool.query(`
      UPDATE configuracion_clinica SET
        nombre_clinica = $1,
        direccion = $2,
        telefono = $3,
        email = $4,
        nombre_bot = $5,
        horarios = $6,
        servicios = $7,
        mensaje_bienvenida = $8,
        updated_at = NOW()
      WHERE id = (SELECT id FROM configuracion_clinica LIMIT 1)
    `, [
      nombre_clinica || '',
      direccion || '',
      telefono || '',
      email || '',
      nombre_bot || 'Sofía',
      JSON.stringify(horarios || {}),
      JSON.stringify(servicios || []),
      mensaje_bienvenida || ''
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Config update error:', err);
    res.status(400).json({ error: 'Error al guardar configuración.' });
  }
});

// --- CONVERSACIONES (chat history) ---
app.get('/api/conversaciones', requireAuth, async (req, res) => {
  try {
    // Get distinct sessions with last message
    const result = await pool.query(`
      SELECT
        "sessionId" as session_id,
        MAX("id") as last_id,
        COUNT(*) as total_mensajes,
        MAX(CASE WHEN "id" = (SELECT MAX("id") FROM n8n_chat_histories h2 WHERE h2."sessionId" = n8n_chat_histories."sessionId") THEN "message" END) as ultimo_mensaje
      FROM n8n_chat_histories
      GROUP BY "sessionId"
      ORDER BY MAX("id") DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Conversaciones error:', err);
    res.json([]);
  }
});

app.get('/api/conversaciones/:sessionId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM n8n_chat_histories WHERE "sessionId" = $1 ORDER BY "id" ASC',
      [req.params.sessionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Chat detail error:', err);
    res.json([]);
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
