const express = require('express');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const PgSession = require('connect-pg-simple')(session);
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// --- EVOLUTION API CONFIG ---
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://72.61.62.51';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
if (!EVOLUTION_API_KEY) {
  console.warn('WARNING: EVOLUTION_API_KEY not set. Evolution API features will not work.');
}

// Evolution API usa certificado autofirmado, bypass TLS SOLO durante sus llamadas
async function evolutionFetch(evoPath, options = {}) {
  const url = `${EVOLUTION_API_URL}${evoPath}`;
  // Temporalmente desactivar verificación TLS solo para esta llamada
  const originalTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  try {
    if (url.startsWith('https')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    const res = await fetch(url, {
      ...options,
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return await res.json();
  } catch (err) {
    console.error('Evolution API error:', err.message);
    return null;
  } finally {
    // Restaurar verificación TLS
    if (originalTLS === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTLS;
    }
  }
}

// BOT API KEY para autenticar endpoints que usa n8n
const BOT_API_KEY = process.env.BOT_API_KEY || '';

if (!process.env.DATABASE_URL) {
  console.error('ERROR FATAL: DATABASE_URL no está configurada. El servidor no puede arrancar sin base de datos.');
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(express.json({ limit: '100kb' }));

// Trust proxy para obtener IP real y que secure cookies funcionen detrás de reverse proxy
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  store: new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // limpiar sesiones expiradas cada 15 min
  }),
  secret: process.env.SESSION_SECRET || 'tmp-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000,
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
  }
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

// --- RATE LIMITING GENÉRICO POR IP (para endpoints públicos) ---
const rateLimitStores = {};
function createRateLimit(name, maxRequests, windowMs) {
  rateLimitStores[name] = new Map();
  // Limpiar entradas expiradas periódicamente
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStores[name]) {
      if (now > record.windowStart + windowMs) rateLimitStores[name].delete(key);
    }
  }, windowMs);

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const store = rateLimitStores[name];
    let record = store.get(ip);
    if (!record || now > record.windowStart + windowMs) {
      record = { count: 0, windowStart: now };
    }
    record.count++;
    store.set(ip, record);
    if (record.count > maxRequests) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' });
    }
    next();
  };
}

// Rate limiters específicos
const rateLimitForgotPassword = createRateLimit('forgot-password', 5, 60 * 1000); // 5 req/min
const rateLimitBotConfig = createRateLimit('bot-config', 60, 60 * 1000); // 60 req/min (el bot lo usa frecuentemente)
const rateLimitBotEndpoints = createRateLimit('bot-endpoints', 30, 60 * 1000); // 30 req/min

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

function requireBotApiKey(req, res, next) {
  if (!BOT_API_KEY) {
    // Si no hay BOT_API_KEY configurada, permitir acceso (compatibilidad)
    console.warn('WARNING: BOT_API_KEY no configurada. Endpoints del bot accesibles sin autenticación.');
    return next();
  }
  const key = req.headers['x-bot-api-key'];
  if (key !== BOT_API_KEY) {
    return res.status(401).json({ error: 'API key del bot inválida o no proporcionada' });
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
    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(50)`).catch(() => {});
    await pool.query(`ALTER TABLE citas ADD COLUMN IF NOT EXISTS recordatorio_24h BOOLEAN DEFAULT false`).catch(() => {});
    await pool.query(`ALTER TABLE citas ADD COLUMN IF NOT EXISTS recordatorio_1h BOOLEAN DEFAULT false`).catch(() => {});
    await pool.query(`ALTER TABLE citas ADD COLUMN IF NOT EXISTS precio INTEGER DEFAULT NULL`).catch(() => {});

    // Presupuestos PDF
    await pool.query(`
      CREATE TABLE IF NOT EXISTS presupuestos (
        id SERIAL PRIMARY KEY,
        token VARCHAR(64) UNIQUE NOT NULL,
        clinica_id INTEGER REFERENCES clinicas(id),
        paciente_telefono VARCHAR(50) NOT NULL,
        paciente_nombre VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'cotizacion',
        items JSONB NOT NULL,
        total INTEGER NOT NULL,
        clinica_datos JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});
    await pool.query('CREATE INDEX IF NOT EXISTS idx_presupuestos_token ON presupuestos(token)').catch(() => {});
    console.log('Tabla presupuestos lista');

    // Escalación a humano
    await pool.query(`
      CREATE TABLE IF NOT EXISTS escalaciones (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        clinica_id INTEGER REFERENCES clinicas(id),
        activa BOOLEAN DEFAULT true,
        resumen TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        cerrada_at TIMESTAMP
      )
    `).catch(() => {});
    await pool.query('CREATE INDEX IF NOT EXISTS idx_escalaciones_session ON escalaciones(session_id, activa)').catch(() => {});
    await pool.query(`ALTER TABLE configuracion_clinica ADD COLUMN IF NOT EXISTS telefono_notificaciones VARCHAR(50) DEFAULT ''`).catch(() => {});
    console.log('Tabla escalaciones lista');

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

    // Índices para performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pacientes_clinica ON pacientes(clinica_id)').catch(() => {});
    await pool.query('CREATE INDEX IF NOT EXISTS idx_citas_clinica_fecha ON citas(clinica_id, fecha_cita)').catch(() => {});
    await pool.query('CREATE INDEX IF NOT EXISTS idx_citas_paciente_tel ON citas(paciente_telefono)').catch(() => {});
    await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_session ON n8n_chat_histories(session_id)').catch(() => {});
    await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_clinica ON n8n_chat_histories(clinica_id)').catch(() => {});
    await pool.query('CREATE INDEX IF NOT EXISTS idx_config_clinica ON configuracion_clinica(clinica_id)').catch(() => {});
    console.log('Índices de performance creados');

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
      const adminPass = process.env.ADMIN_PASS || 'AdminTemp1';  // Cambiar en producción via ADMIN_PASS env var
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

// --- HEALTH CHECK ---
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected', uptime: Math.floor(process.uptime()) });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'disconnected' });
  }
});

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
  if (newPassword.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  if (!/[A-Z]/.test(newPassword)) return res.status(400).json({ error: 'La contraseña debe tener al menos una mayúscula' });
  if (!/[0-9]/.test(newPassword)) return res.status(400).json({ error: 'La contraseña debe tener al menos un número' });
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

// --- FORGOT PASSWORD (WhatsApp code) ---
const resetCodes = new Map(); // key: username, value: { code, expires, attempts }

app.post('/api/forgot-password/send-code', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Ingresá tu usuario' });
  try {
    const result = await pool.query(
      `SELECT u.id, u.telefono, u.clinica_id, c.instance_name
       FROM usuarios u LEFT JOIN clinicas c ON u.clinica_id = c.id
       WHERE u.username = $1 AND u.activo = true`, [username]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    const user = result.rows[0];
    if (!user.telefono) return res.status(400).json({ error: 'Este usuario no tiene teléfono registrado. Contactá al administrador.' });

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetCodes.set(username, {
      code,
      expires: Date.now() + 600000, // 10 minutes
      verifyAttempts: 0,
    });

    // Find instance to send from (user's clinic or first available)
    let instanceName = user.instance_name;
    if (!instanceName) {
      const fallback = await pool.query('SELECT instance_name FROM clinicas WHERE activa = true LIMIT 1');
      instanceName = fallback.rows[0]?.instance_name;
    }
    if (!instanceName || !EVOLUTION_API_KEY) {
      return res.status(500).json({ error: 'No se puede enviar el mensaje. Contactá al administrador.' });
    }

    // Send WhatsApp message via Evolution API
    const phone = user.telefono.replace(/[^0-9]/g, '');
    await evolutionFetch(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({
        number: phone,
        text: `🔐 Tu código de verificación es: *${code}*\n\nVálido por 10 minutos.\n\nSi no solicitaste esto, ignorá este mensaje.`,
      }),
    });

    // Mask phone for response
    const masked = phone.slice(0, 4) + '****' + phone.slice(-2);
    res.json({ ok: true, phone: masked });
  } catch (err) {
    console.error('Send reset code error:', err);
    res.status(500).json({ error: 'Error al enviar el código' });
  }
});

app.post('/api/forgot-password/verify', rateLimitForgotPassword, async (req, res) => {
  const { username, code, newPassword } = req.body;
  if (!username || !code || !newPassword) return res.status(400).json({ error: 'Faltan campos' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  if (!/[A-Z]/.test(newPassword)) return res.status(400).json({ error: 'La contraseña debe tener al menos una mayúscula' });
  if (!/[0-9]/.test(newPassword)) return res.status(400).json({ error: 'La contraseña debe tener al menos un número' });

  const entry = resetCodes.get(username);
  if (!entry) return res.status(400).json({ error: 'No hay código pendiente. Solicitá uno nuevo.' });
  if (Date.now() > entry.expires) {
    resetCodes.delete(username);
    return res.status(400).json({ error: 'El código expiró. Solicitá uno nuevo.' });
  }
  // Limitar intentos de verificación (máx 5 por código)
  if (entry.verifyAttempts >= 5) {
    resetCodes.delete(username);
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Solicitá un nuevo código.' });
  }
  if (entry.code !== code) {
    entry.verifyAttempts = (entry.verifyAttempts || 0) + 1;
    const remaining = 5 - entry.verifyAttempts;
    return res.status(400).json({ error: `Código incorrecto. Te quedan ${remaining} intentos.` });
  }

  try {
    const hash = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE username = $2', [hash, username]);
    resetCodes.delete(username);
    res.json({ ok: true });
  } catch (err) {
    console.error('Verify reset code error:', err);
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

// --- AUTO MARCAR NO ASISTIO (scoped por clínica del usuario) ---
app.post('/api/citas/auto-no-asistio', requireAuth, requireClinica, async (req, res) => {
  try {
    const cid = req.clinicaId;
    const result = await pool.query(`
      UPDATE citas SET estado = 'No Asistio'
      WHERE estado IN ('Pendiente', 'Confirmada')
        AND fecha_cita < CURRENT_DATE
        AND clinica_id = $1
      RETURNING id, paciente_nombre, fecha_cita, estado
    `, [cid]);
    if (result.rowCount > 0) {
      console.log(`Auto No Asistio (clinica ${cid}): ${result.rowCount} citas actualizadas`);
    }
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
  const client = await pool.connect();
  try {
    const cid = req.clinicaId;
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM citas WHERE paciente_telefono = (SELECT telefono FROM pacientes WHERE id = $1 AND clinica_id = $2) AND clinica_id = $2',
      [req.params.id, cid]
    );
    await client.query('DELETE FROM pacientes WHERE id = $1 AND clinica_id = $2', [req.params.id, cid]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: 'Error al eliminar paciente.' });
  } finally {
    client.release();
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

    // Prevenir doble-booking: verificar que no exista cita en la misma fecha/hora/clínica
    const existing = await pool.query(
      `SELECT id FROM citas WHERE fecha_cita = $1 AND hora_cita = $2 AND clinica_id = $3 AND estado NOT IN ('Cancelada', 'No Asistio')`,
      [fecha_cita, hora_cita, cid]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cita en esa fecha y hora. Elegí otro horario.' });
    }

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
app.get('/api/configuracion/bot', rateLimitBotConfig, async (req, res) => {
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
app.post('/api/bot/register-session', rateLimitBotEndpoints, requireBotApiKey, async (req, res) => {
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
app.post('/api/bot/sync-chat-clinicas', rateLimitBotEndpoints, requireBotApiKey, async (req, res) => {
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

// --- ESCALACIÓN A HUMANO ---

// n8n consulta si una conversación está escalada
app.get('/api/bot/escalacion-activa', rateLimitBotConfig, async (req, res) => {
  try {
    const { session_id, instance } = req.query;
    if (!session_id || !instance) {
      return res.status(400).json({ error: 'session_id e instance requeridos' });
    }
    const clinica = await pool.query('SELECT id FROM clinicas WHERE instance_name = $1', [instance]);
    const clinicaId = clinica.rows[0]?.id;
    if (!clinicaId) return res.json({ escalada: false });

    const result = await pool.query(
      'SELECT id FROM escalaciones WHERE session_id = $1 AND clinica_id = $2 AND activa = true LIMIT 1',
      [session_id, clinicaId]
    );
    // Auto-desescalar después de 2 horas
    if (result.rows.length > 0) {
      const autoClose = await pool.query(
        `UPDATE escalaciones SET activa = false, cerrada_at = NOW()
         WHERE session_id = $1 AND clinica_id = $2 AND activa = true
           AND created_at < NOW() - INTERVAL '2 hours' RETURNING id`,
        [session_id, clinicaId]
      );
      if (autoClose.rowCount > 0) {
        return res.json({ escalada: false, auto_cerrada: true });
      }
    }
    res.json({ escalada: result.rows.length > 0 });
  } catch (err) {
    console.error('Escalacion check error:', err);
    res.json({ escalada: false });
  }
});

// n8n activa una escalación
app.post('/api/bot/escalar', rateLimitBotEndpoints, requireBotApiKey, async (req, res) => {
  try {
    const { session_id, instance, resumen } = req.body;
    if (!session_id || !instance) {
      return res.status(400).json({ error: 'session_id e instance requeridos' });
    }
    const clinica = await pool.query('SELECT id FROM clinicas WHERE instance_name = $1', [instance]);
    const clinicaId = clinica.rows[0]?.id;
    if (!clinicaId) return res.status(404).json({ error: 'Clínica no encontrada' });

    // Verificar si ya está escalada
    const existing = await pool.query(
      'SELECT id FROM escalaciones WHERE session_id = $1 AND clinica_id = $2 AND activa = true LIMIT 1',
      [session_id, clinicaId]
    );
    if (existing.rows.length > 0) {
      return res.json({ ok: true, ya_escalada: true });
    }

    await pool.query(
      'INSERT INTO escalaciones (session_id, clinica_id, resumen) VALUES ($1, $2, $3)',
      [session_id, clinicaId, resumen || '']
    );

    // Obtener teléfono de notificaciones
    const config = await pool.query(
      'SELECT telefono_notificaciones FROM configuracion_clinica WHERE clinica_id = $1',
      [clinicaId]
    );
    const telefonoAdmin = config.rows[0]?.telefono_notificaciones || '';

    res.json({ ok: true, telefono_notificaciones: telefonoAdmin });
  } catch (err) {
    console.error('Escalar error:', err);
    res.status(500).json({ error: 'Error al escalar' });
  }
});

// --- PRESUPUESTO PDF ---

function formatGuaranies(amount) {
  return 'Gs. ' + Number(amount || 0).toLocaleString('es-PY');
}

function generarPresupuestoPDF({ clinica, paciente, items, total, tipo, fecha }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100; // margins

    // --- ENCABEZADO ---
    doc.fontSize(20).font('Helvetica-Bold').text(clinica.nombre_clinica || 'Clínica Dental', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    if (clinica.direccion) doc.text(clinica.direccion, { align: 'center' });
    const contactLine = [clinica.telefono, clinica.email].filter(Boolean).join(' | ');
    if (contactLine) doc.text(contactLine, { align: 'center' });
    doc.moveDown(0.5);

    // Línea separadora
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke('#cccccc');
    doc.moveDown(0.8);

    // --- TÍTULO ---
    const titulo = tipo === 'citas_agendadas' ? 'PRESUPUESTO DE SERVICIOS' : 'COTIZACIÓN DE SERVICIOS';
    doc.fontSize(14).font('Helvetica-Bold').text(titulo, { align: 'center' });
    doc.moveDown(0.5);

    // --- FECHA Y PACIENTE ---
    doc.fontSize(10).font('Helvetica');
    doc.text(`Fecha: ${fecha}`, { align: 'right' });
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text('Paciente: ', { continued: true }).font('Helvetica').text(paciente.nombre || 'Sin nombre');
    doc.font('Helvetica-Bold').text('Teléfono: ', { continued: true }).font('Helvetica').text(paciente.telefono || '');
    doc.moveDown(1);

    // --- TABLA ---
    const tableTop = doc.y;
    const colWidths = tipo === 'citas_agendadas'
      ? [pageWidth * 0.35, pageWidth * 0.2, pageWidth * 0.15, pageWidth * 0.3]
      : [pageWidth * 0.7, pageWidth * 0.3];
    const headers = tipo === 'citas_agendadas'
      ? ['Servicio', 'Fecha', 'Hora', 'Precio']
      : ['Servicio', 'Precio'];

    // Header row
    doc.font('Helvetica-Bold').fontSize(10);
    let x = 50;
    const headerBgY = tableTop - 3;
    doc.rect(50, headerBgY, pageWidth, 20).fill('#2563eb');
    x = 50;
    headers.forEach((h, i) => {
      const align = i === headers.length - 1 ? 'right' : 'left';
      const textX = align === 'right' ? x : x + 5;
      const textW = align === 'right' ? colWidths[i] - 5 : colWidths[i] - 5;
      doc.fillColor('#ffffff').text(h, textX, headerBgY + 5, { width: textW, align });
      x += colWidths[i];
    });

    doc.fillColor('#000000');
    let rowY = headerBgY + 25;

    // Data rows
    doc.font('Helvetica').fontSize(10);
    items.forEach((item, idx) => {
      if (rowY > doc.page.height - 100) {
        doc.addPage();
        rowY = 50;
      }

      // Fondo alternado
      if (idx % 2 === 0) {
        doc.rect(50, rowY - 3, pageWidth, 20).fill('#f3f4f6');
        doc.fillColor('#000000');
      }

      x = 50;
      const rowData = tipo === 'citas_agendadas'
        ? [item.nombre, item.fecha || '-', item.hora || '-', formatGuaranies(item.precio)]
        : [item.nombre, formatGuaranies(item.precio)];

      rowData.forEach((val, i) => {
        const align = i === rowData.length - 1 ? 'right' : 'left';
        const textX = align === 'right' ? x : x + 5;
        const textW = align === 'right' ? colWidths[i] - 5 : colWidths[i] - 5;
        doc.text(val, textX, rowY, { width: textW, align });
        x += colWidths[i];
      });
      rowY += 22;
    });

    // Línea antes del total
    rowY += 5;
    doc.moveTo(50, rowY).lineTo(50 + pageWidth, rowY).stroke('#cccccc');
    rowY += 10;

    // TOTAL
    doc.font('Helvetica-Bold').fontSize(13);
    doc.text(`TOTAL: ${formatGuaranies(total)}`, 50, rowY, { width: pageWidth, align: 'right' });
    doc.moveDown(2);

    // --- PIE ---
    doc.font('Helvetica').fontSize(9).fillColor('#666666');
    doc.text('Este presupuesto es válido por 30 días a partir de la fecha de emisión.', 50, doc.y, { align: 'center' });
    doc.moveDown(0.5);
    doc.text(`${clinica.nombre_clinica || 'Clínica Dental'} - Generado automáticamente`, { align: 'center' });

    doc.end();
  });
}

// Helper: resolver precio de un tipo de cita desde servicios de la clínica
function resolverPrecioServicio(tipoCita, servicios) {
  if (!tipoCita || !servicios || !Array.isArray(servicios)) return 0;
  const servicio = servicios.find(s => s.nombre && s.nombre.toLowerCase().trim() === tipoCita.toLowerCase().trim());
  return servicio?.precio || 0;
}

// POST /api/bot/presupuesto/citas - Presupuesto de citas agendadas
app.post('/api/bot/presupuesto/citas', rateLimitBotEndpoints, requireBotApiKey, async (req, res) => {
  try {
    const { instance, telefono_paciente } = req.body;
    if (!instance || !telefono_paciente) {
      return res.status(400).json({ error: 'instance y telefono_paciente requeridos' });
    }

    // Resolver clínica
    const clinica = await pool.query('SELECT id, instance_name FROM clinicas WHERE instance_name = $1', [instance]);
    const clinicaId = clinica.rows[0]?.id;
    if (!clinicaId) return res.status(404).json({ error: 'Clínica no encontrada' });

    // Datos de clínica
    const configRes = await pool.query(
      'SELECT nombre_clinica, direccion, telefono, email, servicios FROM configuracion_clinica WHERE clinica_id = $1',
      [clinicaId]
    );
    const config = configRes.rows[0];
    if (!config) return res.status(404).json({ error: 'Configuración de clínica no encontrada' });

    // Paciente
    const pacienteRes = await pool.query(
      'SELECT nombre, telefono FROM pacientes WHERE telefono = $1 AND clinica_id = $2',
      [telefono_paciente, clinicaId]
    );
    const paciente = pacienteRes.rows[0] || { nombre: 'Paciente', telefono: telefono_paciente };

    // Citas pendientes/confirmadas
    const citasRes = await pool.query(
      `SELECT id, tipo_cita, fecha_cita::text, hora_cita::text, precio, estado
       FROM citas
       WHERE paciente_telefono = $1 AND clinica_id = $2 AND estado IN ('Pendiente', 'Confirmada', 'Modificada')
       ORDER BY fecha_cita, hora_cita`,
      [telefono_paciente, clinicaId]
    );

    if (citasRes.rows.length === 0) {
      return res.json({ ok: false, error: 'No hay citas agendadas para este paciente' });
    }

    const servicios = config.servicios || [];
    const items = citasRes.rows.map(c => ({
      nombre: c.tipo_cita || 'Consulta',
      fecha: c.fecha_cita ? c.fecha_cita.substring(0, 10) : '-',
      hora: c.hora_cita ? c.hora_cita.substring(0, 5) : '-',
      precio: c.precio != null ? c.precio : resolverPrecioServicio(c.tipo_cita, servicios)
    }));
    const total = items.reduce((sum, i) => sum + (i.precio || 0), 0);

    const hoy = new Date();
    const fecha = hoy.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Generar token y guardar
    const token = crypto.randomUUID();
    const clinicaDatos = { nombre_clinica: config.nombre_clinica, direccion: config.direccion, telefono: config.telefono, email: config.email };

    await pool.query(
      `INSERT INTO presupuestos (token, clinica_id, paciente_telefono, paciente_nombre, tipo, items, total, clinica_datos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [token, clinicaId, paciente.telefono, paciente.nombre, 'citas_agendadas', JSON.stringify(items), total, JSON.stringify(clinicaDatos)]
    );

    // Generar PDF
    const pdfBuffer = await generarPresupuestoPDF({
      clinica: clinicaDatos,
      paciente,
      items,
      total,
      tipo: 'citas_agendadas',
      fecha
    });

    const pdfBase64 = pdfBuffer.toString('base64');
    const publicUrl = `${req.protocol}://${req.get('host')}/presupuesto/${token}`;
    const filename = `presupuesto-${(paciente.nombre || 'paciente').replace(/\s+/g, '-')}-${hoy.toISOString().substring(0, 10)}.pdf`;

    // Enviar por WhatsApp via Evolution API
    const whatsappResult = await evolutionFetch(`/message/sendMedia/${instance}`, {
      method: 'POST',
      body: JSON.stringify({
        number: telefono_paciente + '@s.whatsapp.net',
        mediatype: 'document',
        media: `data:application/pdf;base64,${pdfBase64}`,
        fileName: filename,
        caption: `📄 Presupuesto de ${config.nombre_clinica || 'la clínica'}\n💰 Total: ${formatGuaranies(total)}\n\n🔗 También podés descargarlo desde:\n${publicUrl}`
      })
    });

    res.json({
      ok: true,
      download_url: publicUrl,
      total,
      items_count: items.length,
      whatsapp_sent: !!whatsappResult
    });
  } catch (err) {
    console.error('Presupuesto citas error:', err);
    res.status(500).json({ error: 'Error al generar presupuesto' });
  }
});

// POST /api/bot/presupuesto/cotizacion - Cotización de servicios sueltos
app.post('/api/bot/presupuesto/cotizacion', rateLimitBotEndpoints, requireBotApiKey, async (req, res) => {
  try {
    const { instance, telefono_paciente, servicios: serviciosReq } = req.body;
    if (!instance || !telefono_paciente || !Array.isArray(serviciosReq) || serviciosReq.length === 0) {
      return res.status(400).json({ error: 'instance, telefono_paciente y servicios[] requeridos' });
    }

    // Resolver clínica
    const clinica = await pool.query('SELECT id FROM clinicas WHERE instance_name = $1', [instance]);
    const clinicaId = clinica.rows[0]?.id;
    if (!clinicaId) return res.status(404).json({ error: 'Clínica no encontrada' });

    // Datos de clínica
    const configRes = await pool.query(
      'SELECT nombre_clinica, direccion, telefono, email, servicios FROM configuracion_clinica WHERE clinica_id = $1',
      [clinicaId]
    );
    const config = configRes.rows[0];
    if (!config) return res.status(404).json({ error: 'Configuración de clínica no encontrada' });

    // Paciente
    const pacienteRes = await pool.query(
      'SELECT nombre, telefono FROM pacientes WHERE telefono = $1 AND clinica_id = $2',
      [telefono_paciente, clinicaId]
    );
    const paciente = pacienteRes.rows[0] || { nombre: 'Paciente', telefono: telefono_paciente };

    // Resolver precios de servicios solicitados
    const serviciosClinica = config.servicios || [];
    const items = [];
    const noEncontrados = [];

    for (const nombre of serviciosReq) {
      const servicio = serviciosClinica.find(s =>
        s.nombre && s.nombre.toLowerCase().trim() === nombre.toLowerCase().trim()
      );
      if (servicio) {
        items.push({ nombre: servicio.nombre, precio: servicio.precio || 0 });
      } else {
        noEncontrados.push(nombre);
      }
    }

    if (items.length === 0) {
      return res.json({ ok: false, error: 'Ningún servicio encontrado', no_encontrados: noEncontrados });
    }

    const total = items.reduce((sum, i) => sum + (i.precio || 0), 0);
    const hoy = new Date();
    const fecha = hoy.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const token = crypto.randomUUID();
    const clinicaDatos = { nombre_clinica: config.nombre_clinica, direccion: config.direccion, telefono: config.telefono, email: config.email };

    await pool.query(
      `INSERT INTO presupuestos (token, clinica_id, paciente_telefono, paciente_nombre, tipo, items, total, clinica_datos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [token, clinicaId, paciente.telefono, paciente.nombre, 'cotizacion', JSON.stringify(items), total, JSON.stringify(clinicaDatos)]
    );

    // Generar PDF
    const pdfBuffer = await generarPresupuestoPDF({
      clinica: clinicaDatos,
      paciente,
      items,
      total,
      tipo: 'cotizacion',
      fecha
    });

    const pdfBase64 = pdfBuffer.toString('base64');
    const publicUrl = `${req.protocol}://${req.get('host')}/presupuesto/${token}`;
    const filename = `cotizacion-${(paciente.nombre || 'paciente').replace(/\s+/g, '-')}-${hoy.toISOString().substring(0, 10)}.pdf`;

    // Enviar por WhatsApp
    const whatsappResult = await evolutionFetch(`/message/sendMedia/${instance}`, {
      method: 'POST',
      body: JSON.stringify({
        number: telefono_paciente + '@s.whatsapp.net',
        mediatype: 'document',
        media: `data:application/pdf;base64,${pdfBase64}`,
        fileName: filename,
        caption: `📄 Cotización de ${config.nombre_clinica || 'la clínica'}\n💰 Total: ${formatGuaranies(total)}\n\n🔗 También podés descargarlo desde:\n${publicUrl}`
      })
    });

    res.json({
      ok: true,
      download_url: publicUrl,
      total,
      items_count: items.length,
      no_encontrados: noEncontrados.length > 0 ? noEncontrados : undefined,
      whatsapp_sent: !!whatsappResult
    });
  } catch (err) {
    console.error('Cotización error:', err);
    res.status(500).json({ error: 'Error al generar cotización' });
  }
});

// Panel: ver conversaciones escaladas
app.get('/api/conversaciones/escaladas', requireAuth, requireClinica, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.session_id, e.resumen, e.created_at,
              p.nombre as paciente_nombre
       FROM escalaciones e
       LEFT JOIN pacientes p ON p.telefono = e.session_id AND p.clinica_id = e.clinica_id
       WHERE e.clinica_id = $1 AND e.activa = true
       ORDER BY e.created_at DESC`,
      [req.clinicaId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Escaladas error:', err);
    res.json([]);
  }
});

// Panel: cerrar escalación (devolver al bot)
app.post('/api/conversaciones/:sessionId/cerrar-escalacion', requireAuth, requireClinica, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE escalaciones SET activa = false, cerrada_at = NOW()
       WHERE session_id = $1 AND clinica_id = $2 AND activa = true`,
      [req.params.sessionId, req.clinicaId]
    );
    res.json({ ok: true, cerradas: result.rowCount });
  } catch (err) {
    console.error('Cerrar escalacion error:', err);
    res.status(500).json({ error: 'Error al cerrar escalación' });
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
    const { nombre_clinica, direccion, telefono, email, nombre_bot, horarios, servicios, mensaje_bienvenida, prompt_sistema, telefono_notificaciones } = req.body;

    const existing = await pool.query('SELECT id FROM configuracion_clinica WHERE clinica_id = $1', [cid]);
    if (existing.rows.length > 0) {
      await pool.query(`
        UPDATE configuracion_clinica SET
          nombre_clinica = $1, direccion = $2, telefono = $3, email = $4,
          nombre_bot = $5, horarios = $6, servicios = $7,
          mensaje_bienvenida = $8, prompt_sistema = $9, telefono_notificaciones = $10, updated_at = NOW()
        WHERE clinica_id = $11
      `, [
        nombre_clinica || '', direccion || '', telefono || '', email || '',
        nombre_bot || 'Sofía', JSON.stringify(horarios || {}),
        JSON.stringify(servicios || []), mensaje_bienvenida || '',
        prompt_sistema || '', telefono_notificaciones || '', cid
      ]);
    } else {
      await pool.query(`
        INSERT INTO configuracion_clinica (nombre_clinica, direccion, telefono, email, nombre_bot, horarios, servicios, mensaje_bienvenida, prompt_sistema, telefono_notificaciones, clinica_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        nombre_clinica || '', direccion || '', telefono || '', email || '',
        nombre_bot || 'Sofía', JSON.stringify(horarios || {}),
        JSON.stringify(servicios || []), mensaje_bienvenida || '',
        prompt_sistema || '', telefono_notificaciones || '', cid
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

// Reset clinic data (superadmin only)
app.post('/api/admin/clinicas/:id/reset-data', requireAuth, requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const clinicaId = req.params.id;
    const { confirm_nombre, borrar_pacientes, borrar_citas, borrar_chat, borrar_config } = req.body;

    // Verify clinic exists
    const clinica = await client.query('SELECT id, nombre FROM clinicas WHERE id = $1', [clinicaId]);
    if (!clinica.rows[0]) return res.status(404).json({ error: 'Clínica no encontrada' });

    // Verify confirmation matches clinic name
    if (confirm_nombre !== clinica.rows[0].nombre) {
      return res.status(400).json({ error: 'El nombre de confirmación no coincide' });
    }

    const stats = { chat: 0, citas: 0, pacientes: 0, configuracion: 0 };

    await client.query('BEGIN');

    // Delete in correct order (respecting dependencies)
    if (borrar_chat) {
      const r = await client.query('DELETE FROM n8n_chat_histories WHERE clinica_id = $1', [clinicaId]);
      stats.chat = r.rowCount;
    }
    // Always delete citas if deleting pacientes (avoid orphaned records)
    if (borrar_citas || borrar_pacientes) {
      const r = await client.query('DELETE FROM citas WHERE clinica_id = $1', [clinicaId]);
      stats.citas = r.rowCount;
    }
    if (borrar_pacientes) {
      const r = await client.query('DELETE FROM pacientes WHERE clinica_id = $1', [clinicaId]);
      stats.pacientes = r.rowCount;
    }
    if (borrar_config) {
      const r = await client.query('DELETE FROM configuracion_clinica WHERE clinica_id = $1', [clinicaId]);
      stats.configuracion = r.rowCount;
    }

    await client.query('COMMIT');
    console.log(`Reset data clinica ${clinicaId} (${clinica.rows[0].nombre}):`, stats);
    res.json({ ok: true, deleted: stats });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reset clinic data error:', err);
    res.status(500).json({ error: 'Error al reiniciar datos de clínica' });
  } finally {
    client.release();
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
    res.status(500).json({ error: 'Error interno al obtener QR. Intentá de nuevo.' });
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
      SELECT u.id, u.username, u.nombre, u.rol, u.clinica_id, u.activo, u.telefono, u.created_at,
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
    const { username, password, nombre, rol, clinica_id, telefono } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    if (!/[A-Z]/.test(password)) return res.status(400).json({ error: 'La contraseña debe tener al menos una mayúscula' });
    if (!/[0-9]/.test(password)) return res.status(400).json({ error: 'La contraseña debe tener al menos un número' });
    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (username, password_hash, nombre, rol, clinica_id, telefono) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, nombre, rol, clinica_id, telefono',
      [username, hash, nombre, rol || 'admin', clinica_id || null, telefono || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al crear usuario. Verificá que el username no esté duplicado.' });
  }
});

app.put('/api/admin/usuarios/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, nombre, rol, clinica_id, activo, telefono } = req.body;
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      if (!/[A-Z]/.test(password)) return res.status(400).json({ error: 'La contraseña debe tener al menos una mayúscula' });
      if (!/[0-9]/.test(password)) return res.status(400).json({ error: 'La contraseña debe tener al menos un número' });
      const hash = bcrypt.hashSync(password, 10);
      await pool.query(
        'UPDATE usuarios SET username=$1, password_hash=$2, nombre=$3, rol=$4, clinica_id=$5, activo=$6, telefono=$7 WHERE id=$8',
        [username, hash, nombre, rol, clinica_id || null, activo !== false, telefono || null, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE usuarios SET username=$1, nombre=$2, rol=$3, clinica_id=$4, activo=$5, telefono=$6 WHERE id=$7',
        [username, nombre, rol, clinica_id || null, activo !== false, telefono || null, req.params.id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al actualizar usuario.' });
  }
});

// --- DESCARGA PÚBLICA DE PRESUPUESTO PDF ---
const rateLimitPresupuesto = createRateLimit('presupuesto', 20, 60 * 1000);
app.get('/presupuesto/:token', rateLimitPresupuesto, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM presupuestos WHERE token = $1', [req.params.token]);
    if (result.rows.length === 0) {
      return res.status(404).send('<h1>Presupuesto no encontrado</h1><p>El enlace es inválido o ha expirado.</p>');
    }

    const p = result.rows[0];
    const fecha = new Date(p.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const pdfBuffer = await generarPresupuestoPDF({
      clinica: p.clinica_datos,
      paciente: { nombre: p.paciente_nombre, telefono: p.paciente_telefono },
      items: p.items,
      total: p.total,
      tipo: p.tipo,
      fecha
    });

    const filename = `presupuesto-${(p.paciente_nombre || 'paciente').replace(/\s+/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Descarga presupuesto error:', err);
    res.status(500).send('<h1>Error al generar el PDF</h1>');
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

// Limpiar presupuestos viejos (>90 días)
async function limpiarPresupuestosViejos() {
  try {
    const result = await pool.query("DELETE FROM presupuestos WHERE created_at < NOW() - INTERVAL '90 days'");
    if (result.rowCount > 0) console.log(`Presupuestos limpiados: ${result.rowCount} eliminados`);
  } catch (err) { /* tabla puede no existir aún */ }
}
setInterval(limpiarPresupuestosViejos, 24 * 60 * 60 * 1000); // cada 24h
setTimeout(limpiarPresupuestosViejos, 30000);

const server = app.listen(PORT, () => {
  console.log(`Panel Clínica Dental corriendo en puerto ${PORT}`);
});

// --- GRACEFUL SHUTDOWN ---
function gracefulShutdown(signal) {
  console.log(`${signal} recibido. Cerrando servidor...`);
  server.close(() => {
    console.log('Servidor HTTP cerrado.');
    pool.end(() => {
      console.log('Pool de DB cerrado.');
      process.exit(0);
    });
  });
  // Forzar cierre si no termina en 10 segundos
  setTimeout(() => {
    console.error('Cierre forzado por timeout');
    process.exit(1);
  }, 10000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
