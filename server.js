const express = require('express');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- EVOLUTION API CONFIG ---
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://72.61.62.51';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
if (!EVOLUTION_API_KEY) {
  console.warn('WARNING: EVOLUTION_API_KEY not set. Evolution API features will not work.');
}

async function evolutionFetch(path, options = {}) {
  const url = `${EVOLUTION_API_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      // Skip SSL verification for self-signed certs
      ...(url.startsWith('https') ? { dispatcher: undefined } : {}),
    });
    return await res.json();
  } catch (err) {
    console.error('Evolution API error:', err.message);
    return null;
  }
}

// Allow self-signed certificates for Evolution API
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

// --- RATE LIMITING ---
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '5', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '120000', 10);
const loginAttempts = new Map();

function getRateLimitInfo(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return null;
  if (record.blockedUntil > 0) {
    if (now > record.blockedUntil) {
      loginAttempts.delete(ip);
      return null;
    }
    return record;
  }
  return null;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  let record = loginAttempts.get(ip);
  if (!record || (record.blockedUntil > 0 && now > record.blockedUntil)) {
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

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts) {
    if (now > record.blockedUntil) loginAttempts.delete(ip);
  }
}, 10 * 60 * 1000);

// --- MIDDLEWARE ---
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'No autorizado' });
}

function getClinicaId(req) {
  if (req.session.rol === 'superadmin') {
    const headerId = req.headers['x-clinica-id'];
    if (headerId) return parseInt(headerId);
    return req.session.clinicaActiva || null;
  }
  return req.session.clinicaId;
}

function requireClinica(req, res, next) {
  const clinicaId = getClinicaId(req);
  if (!clinicaId) {
    return res.status(400).json({ error: 'No hay clínica seleccionada' });
  }
  req.clinicaId = clinicaId;
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.session.rol !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

// --- AUTO-CREATE TABLES ---
async function initDB() {
  try {
    // Clinicas table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clinicas (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        instance_name VARCHAR(100) UNIQUE NOT NULL,
        activa BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Tabla clinicas lista');

    // Usuarios table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        rol VARCHAR(20) NOT NULL DEFAULT 'admin',
        clinica_id INTEGER REFERENCES clinicas(id),
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Tabla usuarios lista');

    // Configuracion clinica (keep existing creation)
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
        prompt_sistema TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Soporte tecnico table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS soporte_tecnico (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        rol VARCHAR(100) DEFAULT 'Soporte Técnico',
        email VARCHAR(255),
        whatsapp VARCHAR(50),
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Tabla soporte_tecnico lista');

    // Add clinica_id columns to existing tables
    await pool.query(`ALTER TABLE configuracion_clinica ADD COLUMN IF NOT EXISTS clinica_id INTEGER REFERENCES clinicas(id)`).catch(() => {});
    await pool.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS clinica_id INTEGER REFERENCES clinicas(id)`).catch(() => {});
    await pool.query(`ALTER TABLE citas ADD COLUMN IF NOT EXISTS clinica_id INTEGER REFERENCES clinicas(id)`).catch(() => {});
    await pool.query(`ALTER TABLE n8n_chat_histories ADD COLUMN IF NOT EXISTS clinica_id INTEGER REFERENCES clinicas(id)`).catch(() => {});
    await pool.query(`ALTER TABLE configuracion_clinica ADD COLUMN IF NOT EXISTS prompt_sistema TEXT DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE citas ADD COLUMN IF NOT EXISTS recordatorio_24h BOOLEAN DEFAULT false`).catch(() => {});
    await pool.query(`ALTER TABLE citas ADD COLUMN IF NOT EXISTS recordatorio_1h BOOLEAN DEFAULT false`).catch(() => {});

    // DB trigger: auto-assign clinica_id to new chat messages based on patient's clinica
    await pool.query(`
      CREATE OR REPLACE FUNCTION auto_set_chat_clinica()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.clinica_id IS NULL THEN
          SELECT p.clinica_id INTO NEW.clinica_id
          FROM pacientes p
          WHERE p.telefono = NEW.session_id
          LIMIT 1;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `).catch(() => {});
    await pool.query(`
      DROP TRIGGER IF EXISTS trg_chat_clinica ON n8n_chat_histories;
      CREATE TRIGGER trg_chat_clinica
        BEFORE INSERT ON n8n_chat_histories
        FOR EACH ROW
        EXECUTE FUNCTION auto_set_chat_clinica();
    `).catch(() => {});
    console.log('Columnas clinica_id y trigger agregados');

    // Create default clinic if none exists
    const clinicCount = await pool.query('SELECT COUNT(*) FROM clinicas');
    if (parseInt(clinicCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO clinicas (nombre, slug, instance_name)
        VALUES ('Mi Clínica Dental', 'default', 'bot-clinica')
      `);
      console.log('Clínica por defecto creada');
    }

    // Get default clinic id
    const defaultClinic = await pool.query('SELECT id FROM clinicas ORDER BY id LIMIT 1');
    const defaultClinicId = defaultClinic.rows[0]?.id;

    if (defaultClinicId) {
      // Assign existing data to default clinic
      await pool.query('UPDATE configuracion_clinica SET clinica_id = $1 WHERE clinica_id IS NULL', [defaultClinicId]);
      await pool.query('UPDATE pacientes SET clinica_id = $1 WHERE clinica_id IS NULL', [defaultClinicId]);
      await pool.query('UPDATE citas SET clinica_id = $1 WHERE clinica_id IS NULL', [defaultClinicId]);
      await pool.query('UPDATE n8n_chat_histories SET clinica_id = $1 WHERE clinica_id IS NULL', [defaultClinicId]);

      // Insert default config if empty for this clinic
      const configCount = await pool.query('SELECT COUNT(*) FROM configuracion_clinica WHERE clinica_id = $1', [defaultClinicId]);
      if (parseInt(configCount.rows[0].count) === 0) {
        await pool.query("INSERT INTO configuracion_clinica (clinica_id) VALUES ($1)", [defaultClinicId]);
      }
    }

    // Create super admin user if no users exist
    const userCount = await pool.query('SELECT COUNT(*) FROM usuarios');
    if (parseInt(userCount.rows[0].count) === 0) {
      const adminUser = process.env.ADMIN_USER || 'admin';
      const adminPass = process.env.ADMIN_PASS || 'clinica123';
      const hash = bcrypt.hashSync(adminPass, 10);
      await pool.query(
        `INSERT INTO usuarios (username, password_hash, nombre, rol, clinica_id)
         VALUES ($1, $2, 'Super Administrador', 'superadmin', NULL)`,
        [adminUser, hash]
      );
      console.log(`Super admin creado: ${adminUser}`);
    }

    console.log('Base de datos inicializada correctamente');
  } catch (err) {
    console.error('Error inicializando DB:', err.message);
  }
}
initDB();

// --- AUTH ---
app.get('/api/session', (req, res) => {
  if (req.session.authenticated) {
    return res.json({
      authenticated: true,
      userId: req.session.userId,
      username: req.session.username,
      nombre: req.session.nombre,
      rol: req.session.rol,
      clinicaId: req.session.clinicaId,
      clinicaNombre: req.session.clinicaNombre || null,
      clinicaActiva: req.session.clinicaActiva,
    });
  }
  res.json({ authenticated: false });
});

app.post('/api/login', async (req, res) => {
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
  try {
    const result = await pool.query(
      'SELECT u.id, u.username, u.password_hash, u.nombre, u.rol, u.clinica_id, c.nombre as clinica_nombre FROM usuarios u LEFT JOIN clinicas c ON u.clinica_id = c.id WHERE u.username = $1 AND u.activo = true',
      [username]
    );
    const user = result.rows[0];

    if (user && bcrypt.compareSync(password, user.password_hash)) {
      clearAttempts(ip);
      req.session.authenticated = true;
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.nombre = user.nombre;
      req.session.rol = user.rol;
      req.session.clinicaId = user.clinica_id;
      req.session.clinicaNombre = user.clinica_nombre || null;
      // If superadmin, auto-select first clinic
      if (user.rol === 'superadmin' && !user.clinica_id) {
        const firstClinic = await pool.query('SELECT id FROM clinicas WHERE activa = true ORDER BY id LIMIT 1');
        if (firstClinic.rows[0]) {
          req.session.clinicaActiva = firstClinic.rows[0].id;
        }
      }
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
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// --- CHANGE PASSWORD ---
app.post('/api/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Faltan campos' });
  if (newPassword.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  try {
    const result = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [req.session.userId]);
    if (!result.rows[0] || !bcrypt.compareSync(currentPassword, result.rows[0].password_hash)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, req.session.userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// --- SUPER ADMIN: SWITCH CLINICA ---
app.post('/api/admin/switch-clinica', requireAuth, requireSuperAdmin, (req, res) => {
  const { clinicaId } = req.body;
  req.session.clinicaActiva = clinicaId;
  res.json({ ok: true });
});

// --- DASHBOARD ---
app.get('/api/dashboard', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const totalPacientes = await pool.query(
      'SELECT COUNT(*) FROM pacientes WHERE clinica_id = $1', [cid]
    );
    const citasHoy = await pool.query(
      "SELECT c.*, p.nombre as paciente FROM citas c JOIN pacientes p ON c.paciente_telefono = p.telefono AND p.clinica_id = $1 WHERE c.fecha_cita = CURRENT_DATE AND c.clinica_id = $1 ORDER BY c.hora_cita",
      [cid]
    );
    const proximasCitas = await pool.query(
      "SELECT c.*, p.nombre as paciente FROM citas c JOIN pacientes p ON c.paciente_telefono = p.telefono AND p.clinica_id = $1 WHERE c.fecha_cita >= CURRENT_DATE AND c.estado != 'Cancelada' AND c.clinica_id = $1 ORDER BY c.fecha_cita, c.hora_cita LIMIT 10",
      [cid]
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
app.get('/api/metricas', requireAuth, requireClinica, async (req, res) => {
  const cid = req.clinicaId;
  const defaults = {
    citasPorMes: [], pacientesNuevos: [], citasSemana: [],
    resumen: { total_citas: 0, completadas: 0, canceladas: 0, no_show: 0 },
    recordatorios: { enviados_24h: 0, enviados_1h: 0 },
  };

  const result = { ...defaults };

  try {
    const citasPorMes = await pool.query(`
      SELECT TO_CHAR(fecha_cita, 'YYYY-MM') as mes, COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'Completada') as completadas,
        COUNT(*) FILTER (WHERE estado = 'Cancelada') as canceladas,
        COUNT(*) FILTER (WHERE estado = 'No Asistio') as no_show
      FROM citas WHERE fecha_cita >= CURRENT_DATE - INTERVAL '6 months' AND clinica_id = $1
      GROUP BY TO_CHAR(fecha_cita, 'YYYY-MM') ORDER BY mes
    `, [cid]);
    result.citasPorMes = citasPorMes.rows;
  } catch (err) { console.error('Metricas citasPorMes error:', err.message); }

  try {
    const pacientesNuevos = await pool.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') as mes, COUNT(*) as total
      FROM pacientes WHERE created_at >= CURRENT_DATE - INTERVAL '6 months' AND clinica_id = $1
      GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY mes
    `, [cid]);
    result.pacientesNuevos = pacientesNuevos.rows;
  } catch (err) { console.error('Metricas pacientesNuevos error:', err.message); }

  try {
    const resumen = await pool.query(`
      SELECT COUNT(*) as total_citas,
        COUNT(*) FILTER (WHERE estado = 'Completada') as completadas,
        COUNT(*) FILTER (WHERE estado = 'Cancelada') as canceladas,
        COUNT(*) FILTER (WHERE estado = 'No Asistio') as no_show
      FROM citas WHERE fecha_cita >= CURRENT_DATE - INTERVAL '30 days' AND clinica_id = $1
    `, [cid]);
    result.resumen = resumen.rows[0] || defaults.resumen;
  } catch (err) { console.error('Metricas resumen error:', err.message); }

  try {
    const recordatorios = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE recordatorio_24h = true) as enviados_24h,
        COUNT(*) FILTER (WHERE recordatorio_1h = true) as enviados_1h
      FROM citas WHERE fecha_cita >= CURRENT_DATE - INTERVAL '30 days' AND clinica_id = $1
    `, [cid]);
    result.recordatorios = recordatorios.rows[0] || defaults.recordatorios;
  } catch (err) { console.error('Metricas recordatorios error:', err.message); }

  try {
    const citasSemana = await pool.query(`
      SELECT TO_CHAR(fecha_cita, 'Dy') as dia, fecha_cita::text as fecha, COUNT(*) as total
      FROM citas WHERE fecha_cita >= date_trunc('week', CURRENT_DATE)
        AND fecha_cita < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
        AND clinica_id = $1
      GROUP BY fecha_cita, TO_CHAR(fecha_cita, 'Dy') ORDER BY fecha_cita
    `, [cid]);
    result.citasSemana = citasSemana.rows;
  } catch (err) { console.error('Metricas citasSemana error:', err.message); }

  res.json(result);
});

// --- NOTIFICACIONES (recent events) ---
app.get('/api/notificaciones', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const items = [];

    // New patients in last 7 days
    const newPatients = await pool.query(
      `SELECT nombre, telefono, created_at FROM pacientes
       WHERE clinica_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY created_at DESC LIMIT 10`, [cid]
    );
    newPatients.rows.forEach(p => {
      items.push({ tipo: 'paciente', mensaje: `Nuevo paciente: ${p.nombre}`, fecha: p.created_at });
    });

    // New appointments in last 7 days
    const newCitas = await pool.query(
      `SELECT paciente_nombre, fecha_cita, hora_cita, created_at FROM citas
       WHERE clinica_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY created_at DESC LIMIT 10`, [cid]
    );
    newCitas.rows.forEach(c => {
      items.push({ tipo: 'cita', mensaje: `Nueva cita: ${c.paciente_nombre} - ${String(c.fecha_cita).split('T')[0]}`, fecha: c.created_at });
    });

    // Cancelled appointments in last 7 days
    const cancelled = await pool.query(
      `SELECT paciente_nombre, fecha_cita FROM citas
       WHERE clinica_id = $1 AND estado = 'Cancelada' AND fecha_cita >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY fecha_cita DESC LIMIT 5`, [cid]
    );
    cancelled.rows.forEach(c => {
      items.push({ tipo: 'cancelacion', mensaje: `Cita cancelada: ${c.paciente_nombre}`, fecha: c.fecha_cita });
    });

    // Sort by date descending
    items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    res.json(items.slice(0, 20));
  } catch (err) {
    console.error('Notificaciones error:', err);
    res.json([]);
  }
});

// --- WHATSAPP STATUS (for regular admins) ---
app.get('/api/whatsapp-status', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const clinica = await pool.query('SELECT instance_name, nombre FROM clinicas WHERE id = $1', [cid]);
    if (!clinica.rows[0]) return res.json({ status: 'not_found' });

    const instanceName = clinica.rows[0].instance_name;
    if (!EVOLUTION_API_KEY) {
      return res.json({ status: 'no_api_key', instance_name: instanceName });
    }

    let instances = null;
    try {
      instances = await evolutionFetch('/instance/fetchInstances');
    } catch (e) {
      return res.json({ status: 'api_error', instance_name: instanceName });
    }

    const instance = Array.isArray(instances) ? instances.find(i => i.name === instanceName) : null;
    if (!instance) {
      return res.json({ status: 'not_found', instance_name: instanceName });
    }

    res.json({
      status: instance.connectionStatus || 'unknown',
      instance_name: instanceName,
      whatsapp_number: instance.ownerJid?.replace('@s.whatsapp.net', '') || null,
      profile_name: instance.profileName || null,
    });
  } catch (err) {
    console.error('WhatsApp status error:', err);
    res.json({ status: 'error' });
  }
});

// --- AUTO MARCAR NO ASISTIO ---
app.post('/api/citas/auto-no-asistio', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE citas SET estado = 'No Asistio'
      WHERE estado IN ('Pendiente', 'Confirmada')
        AND fecha_cita < CURRENT_DATE
        AND clinica_id IS NOT NULL
      RETURNING id, paciente_nombre, fecha_cita, estado
    `);
    console.log(`Auto No Asistio: ${result.rowCount} citas actualizadas`);
    res.json({ actualizadas: result.rowCount, citas: result.rows });
  } catch (err) {
    console.error('Auto no-asistio error:', err);
    res.status(500).json({ error: 'Error al actualizar citas' });
  }
});

// --- PACIENTES ---
app.get('/api/pacientes', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const buscar = req.query.buscar || '';
    let query = 'SELECT * FROM pacientes WHERE clinica_id = $1';
    let params = [cid];
    if (buscar) {
      query += ' AND (nombre ILIKE $2 OR telefono ILIKE $2 OR email ILIKE $2)';
      params.push(`%${buscar}%`);
    }
    query += ' ORDER BY nombre';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

app.post('/api/pacientes', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const { telefono, nombre, email, fecha_nacimiento, notas } = req.body;
    const result = await pool.query(
      'INSERT INTO pacientes (telefono, nombre, email, fecha_nacimiento, notas, clinica_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [telefono, nombre, email || '', fecha_nacimiento || '', notas || '', cid]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al crear paciente. Verificá que el teléfono no esté duplicado.' });
  }
});

app.put('/api/pacientes/:id', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const { telefono, nombre, email, fecha_nacimiento, notas } = req.body;
    await pool.query(
      'UPDATE pacientes SET telefono=$1, nombre=$2, email=$3, fecha_nacimiento=$4, notas=$5 WHERE id=$6 AND clinica_id=$7',
      [telefono, nombre, email || '', fecha_nacimiento || '', notas || '', req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al actualizar paciente.' });
  }
});

app.delete('/api/pacientes/:id', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    await pool.query(
      'DELETE FROM citas WHERE paciente_telefono = (SELECT telefono FROM pacientes WHERE id = $1 AND clinica_id = $2) AND clinica_id = $2',
      [req.params.id, cid]
    );
    await pool.query('DELETE FROM pacientes WHERE id = $1 AND clinica_id = $2', [req.params.id, cid]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al eliminar paciente.' });
  }
});

// --- CITAS ---
app.get('/api/citas', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const { fecha, estado, desde, hasta } = req.query;
    let query = "SELECT c.*, p.nombre as paciente FROM citas c JOIN pacientes p ON c.paciente_telefono = p.telefono AND p.clinica_id = $1 WHERE c.clinica_id = $1";
    let params = [cid];
    let i = 2;
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

app.post('/api/citas', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const { paciente_telefono, fecha_cita, hora_cita, tipo_cita, estado, notas } = req.body;
    const paciente = await pool.query(
      'SELECT nombre FROM pacientes WHERE telefono = $1 AND clinica_id = $2', [paciente_telefono, cid]
    );
    const paciente_nombre = paciente.rows[0]?.nombre || '';
    const result = await pool.query(
      'INSERT INTO citas (paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas, clinica_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado || 'Pendiente', notas || '', cid]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al crear cita.' });
  }
});

app.put('/api/citas/:id', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const { paciente_telefono, fecha_cita, hora_cita, tipo_cita, estado, notas } = req.body;
    const paciente = await pool.query(
      'SELECT nombre FROM pacientes WHERE telefono = $1 AND clinica_id = $2', [paciente_telefono, cid]
    );
    const paciente_nombre = paciente.rows[0]?.nombre || '';
    await pool.query(
      'UPDATE citas SET paciente_telefono=$1, paciente_nombre=$2, fecha_cita=$3, hora_cita=$4, tipo_cita=$5, estado=$6, notas=$7 WHERE id=$8 AND clinica_id=$9',
      [paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas || '', req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al actualizar cita.' });
  }
});

app.delete('/api/citas/:id', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    await pool.query('DELETE FROM citas WHERE id = $1 AND clinica_id = $2', [req.params.id, cid]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al eliminar cita.' });
  }
});

// --- CONFIGURACION PUBLICA (para n8n bot) ---
app.get('/api/configuracion/bot', async (req, res) => {
  try {
    const instanceName = req.query.instance;
    if (!instanceName) {
      return res.status(400).json({ error: 'instance parameter required' });
    }
    const clinica = await pool.query(
      'SELECT id, nombre, instance_name FROM clinicas WHERE instance_name = $1', [instanceName]
    );
    const clinicaId = clinica.rows[0]?.id;
    if (!clinicaId) {
      return res.status(404).json({ error: 'Clinica no encontrada para esa instancia' });
    }
    const result = await pool.query(
      'SELECT nombre_clinica, direccion, telefono, email, nombre_bot, horarios, servicios, mensaje_bienvenida, prompt_sistema FROM configuracion_clinica WHERE clinica_id = $1 LIMIT 1',
      [clinicaId]
    );
    res.json({
      ...result.rows[0] || {},
      clinica_id: clinicaId,
      instance_name: instanceName,
    });
  } catch (err) {
    console.error('Config bot error:', err);
    res.json({});
  }
});

// --- n8n: registrar sesion de chat con clinica ---
app.post('/api/bot/register-session', async (req, res) => {
  try {
    const { instance, session_id } = req.body;
    if (!instance || !session_id) {
      return res.status(400).json({ error: 'instance y session_id requeridos' });
    }
    const clinica = await pool.query(
      'SELECT id FROM clinicas WHERE instance_name = $1', [instance]
    );
    const clinicaId = clinica.rows[0]?.id;
    if (!clinicaId) {
      return res.status(404).json({ error: 'Clínica no encontrada para esa instancia' });
    }
    // Update chat histories for this session to belong to this clinica
    await pool.query(
      'UPDATE n8n_chat_histories SET clinica_id = $1 WHERE session_id = $2 AND clinica_id IS NULL',
      [clinicaId, session_id]
    );
    // Also ensure patient belongs to this clinica if exists
    await pool.query(
      'UPDATE pacientes SET clinica_id = $1 WHERE telefono = $2 AND clinica_id IS NULL',
      [clinicaId, session_id]
    );
    res.json({ ok: true, clinica_id: clinicaId });
  } catch (err) {
    console.error('Register session error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// --- n8n: asignar clinica_id a chat histories periodicamente ---
app.post('/api/bot/sync-chat-clinicas', async (req, res) => {
  try {
    // Assign clinica_id to chat histories based on matching patient phone numbers
    const updated = await pool.query(`
      UPDATE n8n_chat_histories h
      SET clinica_id = p.clinica_id
      FROM pacientes p
      WHERE h.session_id = p.telefono
        AND h.clinica_id IS NULL
        AND p.clinica_id IS NOT NULL
    `);
    res.json({ ok: true, updated: updated.rowCount });
  } catch (err) {
    console.error('Sync chat clinicas error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// --- CONFIGURACION ---
app.get('/api/configuracion', requireAuth, requireClinica, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM configuracion_clinica WHERE clinica_id = $1 LIMIT 1', [req.clinicaId]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('Config error:', err);
    res.json({});
  }
});

app.put('/api/configuracion', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const { nombre_clinica, direccion, telefono, email, nombre_bot, horarios, servicios, mensaje_bienvenida, prompt_sistema } = req.body;

    const existing = await pool.query('SELECT id FROM configuracion_clinica WHERE clinica_id = $1', [cid]);
    if (existing.rows.length > 0) {
      await pool.query(`
        UPDATE configuracion_clinica SET
          nombre_clinica = $1, direccion = $2, telefono = $3, email = $4,
          nombre_bot = $5, horarios = $6, servicios = $7,
          mensaje_bienvenida = $8, prompt_sistema = $9, updated_at = NOW()
        WHERE clinica_id = $10
      `, [
        nombre_clinica || '', direccion || '', telefono || '', email || '',
        nombre_bot || 'Sofía', JSON.stringify(horarios || {}),
        JSON.stringify(servicios || []), mensaje_bienvenida || '',
        prompt_sistema || '', cid
      ]);
    } else {
      await pool.query(`
        INSERT INTO configuracion_clinica (nombre_clinica, direccion, telefono, email, nombre_bot, horarios, servicios, mensaje_bienvenida, prompt_sistema, clinica_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        nombre_clinica || '', direccion || '', telefono || '', email || '',
        nombre_bot || 'Sofía', JSON.stringify(horarios || {}),
        JSON.stringify(servicios || []), mensaje_bienvenida || '',
        prompt_sistema || '', cid
      ]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Config update error:', err);
    res.status(400).json({ error: 'Error al guardar configuración.' });
  }
});

// --- CONVERSACIONES ---
app.get('/api/conversaciones', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const result = await pool.query(`
      SELECT
        session_id,
        MAX(id) as last_id,
        COUNT(*) as total_mensajes,
        (SELECT h2.message->>'content'
         FROM n8n_chat_histories h2
         WHERE h2.session_id = n8n_chat_histories.session_id
         ORDER BY h2.id DESC LIMIT 1
        ) as ultimo_mensaje
      FROM n8n_chat_histories
      WHERE session_id IN (SELECT telefono FROM pacientes WHERE clinica_id = $1)
         OR clinica_id = $1
      GROUP BY session_id
      ORDER BY MAX(id) DESC
      LIMIT 50
    `, [cid]);
    res.json(result.rows);
  } catch (err) {
    console.error('Conversaciones error:', err);
    res.json([]);
  }
});

app.get('/api/conversaciones/:sessionId', requireAuth, requireClinica, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, session_id, message->>'type' as role, message->>'content' as message
       FROM n8n_chat_histories
       WHERE session_id = $1
         AND (clinica_id = $2 OR clinica_id IS NULL)
         AND message->>'type' IN ('human', 'ai')
         AND message->>'content' IS NOT NULL
         AND message->>'content' NOT LIKE 'Calling %'
       ORDER BY id ASC`,
      [req.params.sessionId, req.clinicaId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Chat detail error:', err);
    res.json([]);
  }
});

// --- SOPORTE TECNICO (visible para todos los admins) ---
app.get('/api/soporte', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre, rol, email, whatsapp FROM soporte_tecnico WHERE activo = true ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Soporte error:', err);
    res.json([]);
  }
});

// --- SUPER ADMIN: CLINICAS ---
app.get('/api/admin/clinicas', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM pacientes WHERE clinica_id = c.id) as total_pacientes,
        (SELECT COUNT(*) FROM citas WHERE clinica_id = c.id) as total_citas,
        (SELECT COUNT(*) FROM usuarios WHERE clinica_id = c.id) as total_usuarios
      FROM clinicas c ORDER BY c.nombre
    `);

    // Fetch real status from Evolution API (optional, don't block clinic list if it fails)
    let instances = null;
    try {
      instances = await evolutionFetch('/instance/fetchInstances');
    } catch (e) {
      console.warn('Could not fetch Evolution instances:', e.message);
    }

    const clinicas = result.rows.map(c => {
      const instance = Array.isArray(instances) ? instances.find(i => i.name === c.instance_name) : null;
      return {
        ...c,
        connection_status: instance?.connectionStatus || 'not_found',
        whatsapp_number: instance?.ownerJid?.replace('@s.whatsapp.net', '') || null,
        profile_name: instance?.profileName || null,
      };
    });

    res.json(clinicas);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

app.post('/api/admin/clinicas', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { nombre, slug, instance_name } = req.body;

    // Create instance in Evolution API
    const evoResult = await evolutionFetch('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: instance_name,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });

    if (!evoResult || evoResult.error) {
      const errorMsg = evoResult?.response?.message?.[0] || evoResult?.error || 'Error al crear instancia en Evolution API';
      return res.status(400).json({ error: errorMsg });
    }

    // Configure webhook pointing to n8n
    const webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://humberto-proyect-n8n.jxugns.easypanel.host/webhook/clinica-dental-whatsapp-v4';
    const webhookResult = await evolutionFetch(`/webhook/set/${instance_name}`, {
      method: 'POST',
      body: JSON.stringify({
        url: webhookUrl,
        enabled: true,
        events: ['MESSAGES_UPSERT'],
        webhookByEvents: false,
        webhookBase64: false
      })
    });
    const webhookConfigured = webhookResult !== null && !webhookResult.error;
    if (!webhookConfigured) {
      console.error('Warning: webhook config failed for', instance_name);
    }

    // Configure instance settings
    const settingsResult = await evolutionFetch(`/settings/set/${instance_name}`, {
      method: 'POST',
      body: JSON.stringify({
        rejectCall: true,
        groupsIgnore: true,
        alwaysOnline: true,
        readMessages: true,
        readStatus: false,
        syncFullHistory: false
      })
    });
    if (!settingsResult || settingsResult.error) {
      console.error('Warning: settings config failed for', instance_name);
    }

    // Save clinic in database
    const result = await pool.query(
      'INSERT INTO clinicas (nombre, slug, instance_name) VALUES ($1, $2, $3) RETURNING *',
      [nombre, slug, instance_name]
    );
    await pool.query(
      "INSERT INTO configuracion_clinica (nombre_clinica, clinica_id) VALUES ($1, $2)",
      [nombre, result.rows[0].id]
    );

    res.json({
      ...result.rows[0],
      qrcode: evoResult.qrcode,
      connection_status: 'connecting',
      webhook_configured: webhookConfigured,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al crear clínica. Verificá que el slug e instancia sean únicos.' });
  }
});

app.put('/api/admin/clinicas/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { nombre, slug, instance_name, activa } = req.body;
    await pool.query(
      'UPDATE clinicas SET nombre=$1, slug=$2, instance_name=$3, activa=$4 WHERE id=$5',
      [nombre, slug, instance_name, activa !== false, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al actualizar clínica.' });
  }
});

// Get QR code for connecting WhatsApp
app.get('/api/admin/clinicas/:id/qrcode', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const clinica = await pool.query('SELECT instance_name FROM clinicas WHERE id = $1', [req.params.id]);
    if (!clinica.rows[0]) return res.status(404).json({ error: 'Clínica no encontrada' });

    const instanceName = clinica.rows[0].instance_name;

    if (!EVOLUTION_API_KEY) {
      return res.status(500).json({ error: 'EVOLUTION_API_KEY no configurada en el servidor' });
    }

    const result = await evolutionFetch(`/instance/connect/${instanceName}`);
    if (!result) {
      return res.status(502).json({ error: 'No se pudo conectar con Evolution API. Verificá que la URL y API key sean correctas.' });
    }
    if (result.error || result.response?.statusCode >= 400) {
      return res.status(400).json({ error: result.response?.message || result.error || 'Error de Evolution API' });
    }
    res.json(result);
  } catch (err) {
    console.error('QR error:', err);
    res.status(500).json({ error: 'Error interno al obtener QR: ' + err.message });
  }
});

// Get connection status for a specific clinic
app.get('/api/admin/clinicas/:id/status', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const clinica = await pool.query('SELECT instance_name FROM clinicas WHERE id = $1', [req.params.id]);
    if (!clinica.rows[0]) return res.status(404).json({ error: 'Clínica no encontrada' });

    const instanceName = clinica.rows[0].instance_name;
    let instances = null;
    try {
      instances = await evolutionFetch('/instance/fetchInstances');
    } catch (e) {
      console.warn('Could not fetch instances for status:', e.message);
    }
    const instance = Array.isArray(instances) ? instances.find(i => i.name === instanceName) : null;

    res.json({
      connection_status: instance?.connectionStatus || 'not_found',
      whatsapp_number: instance?.ownerJid?.replace('@s.whatsapp.net', '') || null,
      profile_name: instance?.profileName || null,
    });
  } catch (err) {
    console.error('Status error:', err);
    res.status(400).json({ error: 'Error al obtener estado' });
  }
});

// --- SUPER ADMIN: MONITOREO ---
app.get('/api/admin/monitoreo', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    // Get all clinics
    const clinicas = await pool.query('SELECT id, nombre, instance_name FROM clinicas WHERE activa = true ORDER BY id');

    // Get Evolution API instances
    let instances = [];
    try {
      const result = await evolutionFetch('/instance/fetchInstances');
      if (Array.isArray(result)) instances = result;
    } catch (e) {
      console.warn('Monitoreo: Could not fetch Evolution instances:', e.message);
    }

    // Get bot message counts per clinic
    const botStats = await pool.query(`
      SELECT clinica_id,
        count(*) as total_bot_msgs,
        count(DISTINCT session_id) as contactos_unicos,
        count(*) FILTER (WHERE message->>'type' = 'ai') as msgs_bot,
        count(*) FILTER (WHERE message->>'type' = 'human') as msgs_humanos
      FROM n8n_chat_histories
      WHERE clinica_id IS NOT NULL
      GROUP BY clinica_id
    `);

    // Get reminder counts per clinic
    const reminderStats = await pool.query(`
      SELECT clinica_id,
        count(*) FILTER (WHERE recordatorio_24h = true) as rec_24h_enviados,
        count(*) FILTER (WHERE recordatorio_1h = true) as rec_1h_enviados,
        count(*) as total_citas
      FROM citas
      WHERE clinica_id IS NOT NULL
      GROUP BY clinica_id
    `);

    const monitoreo = clinicas.rows.map(c => {
      const evoInstance = instances.find(i => i.name === c.instance_name);
      const botStat = botStats.rows.find(s => s.clinica_id === c.id) || {};
      const remStat = reminderStats.rows.find(s => s.clinica_id === c.id) || {};

      const evoMsgs = evoInstance?._count?.Message || 0;
      const evoContacts = evoInstance?._count?.Contact || 0;
      const evoChats = evoInstance?._count?.Chat || 0;
      const createdAt = evoInstance?.createdAt || null;

      // Calculate days since instance creation
      const daysActive = createdAt ? Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)) : 1;
      const botMsgsPerDay = Math.round((parseInt(botStat.msgs_bot || 0)) / daysActive);
      const totalReminders = parseInt(remStat.rec_24h_enviados || 0) + parseInt(remStat.rec_1h_enviados || 0);

      // Risk calculation
      let riesgo = 'bajo';
      let riesgoDetalle = 'Volumen bajo, uso reactivo';
      if (botMsgsPerDay > 200 || (daysActive < 7 && parseInt(botStat.msgs_bot || 0) > 100)) {
        riesgo = 'alto';
        riesgoDetalle = botMsgsPerDay > 200
          ? `${botMsgsPerDay} msgs/día del bot supera el límite seguro`
          : 'Número nuevo con alto volumen de mensajes';
      } else if (botMsgsPerDay > 50 || totalReminders > 50) {
        riesgo = 'medio';
        riesgoDetalle = botMsgsPerDay > 50
          ? `${botMsgsPerDay} msgs/día del bot, acercándose al límite`
          : `${totalReminders} recordatorios enviados, monitorear volumen`;
      }

      return {
        clinica_id: c.id,
        clinica_nombre: c.nombre,
        instance_name: c.instance_name,
        connection_status: evoInstance?.connectionStatus || 'not_found',
        whatsapp_number: evoInstance?.ownerJid?.replace('@s.whatsapp.net', '') || null,
        profile_name: evoInstance?.profileName || null,
        // Evolution API stats
        evo_mensajes: evoMsgs,
        evo_contactos: evoContacts,
        evo_chats: evoChats,
        evo_created: createdAt,
        dias_activo: daysActive,
        // Bot stats (from DB)
        bot_msgs_total: parseInt(botStat.total_bot_msgs || 0),
        bot_msgs_ia: parseInt(botStat.msgs_bot || 0),
        bot_msgs_humanos: parseInt(botStat.msgs_humanos || 0),
        bot_contactos_unicos: parseInt(botStat.contactos_unicos || 0),
        bot_msgs_por_dia: botMsgsPerDay,
        // Reminders
        recordatorios_24h: parseInt(remStat.rec_24h_enviados || 0),
        recordatorios_1h: parseInt(remStat.rec_1h_enviados || 0),
        total_citas: parseInt(remStat.total_citas || 0),
        // Risk
        riesgo,
        riesgo_detalle: riesgoDetalle,
      };
    });

    res.json(monitoreo);
  } catch (err) {
    console.error('Monitoreo error:', err);
    res.status(500).json({ error: 'Error al obtener métricas de monitoreo' });
  }
});

// --- SUPER ADMIN: SOPORTE TECNICO ---
app.get('/api/admin/soporte', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM soporte_tecnico ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Admin soporte error:', err);
    res.json([]);
  }
});

app.post('/api/admin/soporte', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { nombre, rol, email, whatsapp } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const result = await pool.query(
      'INSERT INTO soporte_tecnico (nombre, rol, email, whatsapp) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre, rol || 'Soporte Técnico', email || null, whatsapp || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create soporte error:', err);
    res.status(500).json({ error: 'Error al crear contacto de soporte' });
  }
});

app.put('/api/admin/soporte/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { nombre, rol, email, whatsapp, activo } = req.body;
    const result = await pool.query(
      'UPDATE soporte_tecnico SET nombre = $1, rol = $2, email = $3, whatsapp = $4, activo = $5 WHERE id = $6 RETURNING *',
      [nombre, rol, email || null, whatsapp || null, activo !== false, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Contacto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update soporte error:', err);
    res.status(500).json({ error: 'Error al actualizar contacto' });
  }
});

app.delete('/api/admin/soporte/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM soporte_tecnico WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete soporte error:', err);
    res.status(500).json({ error: 'Error al eliminar contacto' });
  }
});

// --- SUPER ADMIN: USUARIOS ---
app.get('/api/admin/usuarios', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.nombre, u.rol, u.clinica_id, u.activo, u.created_at,
        c.nombre as clinica_nombre
      FROM usuarios u
      LEFT JOIN clinicas c ON u.clinica_id = c.id
      ORDER BY u.nombre
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

app.post('/api/admin/usuarios', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, nombre, rol, clinica_id } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (username, password_hash, nombre, rol, clinica_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, nombre, rol, clinica_id',
      [username, hash, nombre, rol || 'admin', clinica_id || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al crear usuario. Verificá que el username no esté duplicado.' });
  }
});

app.put('/api/admin/usuarios/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, nombre, rol, clinica_id, activo } = req.body;
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await pool.query(
        'UPDATE usuarios SET username=$1, password_hash=$2, nombre=$3, rol=$4, clinica_id=$5, activo=$6 WHERE id=$7',
        [username, hash, nombre, rol, clinica_id || null, activo !== false, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE usuarios SET username=$1, nombre=$2, rol=$3, clinica_id=$4, activo=$5 WHERE id=$6',
        [username, nombre, rol, clinica_id || null, activo !== false, req.params.id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al actualizar usuario.' });
  }
});

// --- SERVE REACT BUILD ---
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- AUTO MARCAR "No Asistio" (corre cada hora, idempotente) ---
async function autoMarcarNoAsistio() {
  try {
    const result = await pool.query(`
      UPDATE citas SET estado = 'No Asistio'
      WHERE estado IN ('Pendiente', 'Confirmada')
        AND fecha_cita < CURRENT_DATE
        AND clinica_id IS NOT NULL
    `);
    if (result.rowCount > 0) {
      console.log(`Auto No Asistio: ${result.rowCount} citas actualizadas`);
    }
  } catch (err) {
    console.error('Auto no-asistio error:', err);
  }
}
setInterval(autoMarcarNoAsistio, 60 * 60 * 1000); // cada hora
setTimeout(autoMarcarNoAsistio, 15000); // 15s después de iniciar

app.listen(PORT, () => {
  console.log(`Panel Clínica Dental corriendo en puerto ${PORT}`);
});
