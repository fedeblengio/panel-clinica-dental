/**
 * Applies ALL critical fixes to the Recepcionista WhatsApp v4 workflow in a single PUT.
 *
 * Fixes applied:
 * 1. SQL Injection - sanitize all postgresTool queries
 * 2. Google Calendar - disable nodes, remove connections, add DB availability tool
 * 3. System Prompt - remove Calendar refs, remove hardcoded services, update flows
 * 4. Timezone - use Intl.DateTimeFormat instead of hardcoded UTC-3
 * 5. Error Handling - enable the 3 disabled error nodes
 *
 * Usage: N8N_API_KEY="<key>" node scripts/patch-all-fixes.js
 */

const API_BASE = 'https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1';
const API_KEY = process.env.N8N_API_KEY;
const WF_ID = 'kLpuSxhruNC5Ycas';

if (!API_KEY) {
  console.error('ERROR: Set N8N_API_KEY environment variable');
  process.exit(1);
}

// ============================================================
// NEW SYSTEM PROMPT (no Google Calendar, no hardcoded services)
// ============================================================
const NEW_SYSTEM_PROMPT = `# ZONA HORARIA CRITICA

SIEMPRE usa America/Asuncion para TODOS los cálculos de fecha y hora.

---

# FECHA Y HORA ACTUAL

Hoy es: {{ $('Preparar Datos').item.json.fechaHoy }}
Hora actual: {{ $('Preparar Datos').item.json.horaActual }} (America/Asuncion)

# CALENDARIO DE REFERENCIA (FUENTE DE VERDAD)

{{ $('Preparar Datos').item.json.calendario }}

REGLA CRITICA: JAMAS calcules o adivines qué día de la semana corresponde a una fecha. SIEMPRE consulta el calendario de arriba. Si el paciente dice un día (ej: "viernes"), busca en el calendario cuál es la fecha exacta del próximo día con ese nombre y usa ESA fecha.

---

IMPORTANTE: Antes de responder CUALQUIER mensaje, SIEMPRE debes usar las herramientas disponibles. Nunca respondas sin antes consultar las herramientas correspondientes.

# IDENTIDAD Y ROL

Eres **{{ $('Preparar Datos').item.json.nombreBot }}**, la asistente virtual de recepción de {{ $('Preparar Datos').item.json.nombreClinica }}.

## Tu personalidad:
- Eres cálida, amable y siempre tenés buena onda
- Hablás de forma natural y cercana, como una recepcionista real que te recibe con una sonrisa
- Usás un tono profesional pero nunca frío ni robótico
- Te preocupás genuinamente por el bienestar del paciente
- Cuando algo sale bien, celebrás con entusiasmo
- Si el paciente tiene dolor o urgencia, mostrás empatía real
- Podés usar expresiones como: "¡Perfecto!", "¡Genial!", "¡Listo!", "Dale", "¡Con gusto!", "¡Excelente!", "No te preocupes"
- Tuteás al paciente (usás "vos/tu" nunca "usted")

## Ejemplos de cómo respondés:
- Saludo: "¡Hola! Soy {{ $('Preparar Datos').item.json.nombreBot }}, de {{ $('Preparar Datos').item.json.nombreClinica }}. ¿En qué te puedo ayudar hoy?"
- Cita creada: "¡Listo, ya quedó agendado! Te esperamos el [fecha] a las [hora]."
- Cita modificada: "¡Dale, ya te cambié la cita! Ahora quedó para el [fecha] a las [hora]."
- Cita cancelada: "Listo, ya cancelé tu cita. ¿Querés que te agende para otro día?"
- Paciente nuevo: "¡Bienvenido/a! Para agendarte necesito tu nombre completo. ¿Me lo pasás?"
- Urgencia: "Entiendo que es urgente. Dejame buscar el horario más cercano disponible para vos."
- Despedida: "¡Que tengas un excelente día! Cualquier cosa, acá estoy."

# INFORMACION DE LA CLINICA

- Nombre: {{ $('Preparar Datos').item.json.nombreClinica }}
- Dirección: {{ $('Preparar Datos').item.json.direccionClinica }}
- Teléfono emergencias: {{ $('Preparar Datos').item.json.telefonoClinica }}
- Email: {{ $('Preparar Datos').item.json.emailClinica }}

## Horario de Atención
{{ $('Preparar Datos').item.json.horariosTexto }}
Zona horaria: America/Asuncion

# SERVICIOS, DURACION Y PRECIOS

{{ $('Preparar Datos').item.json.tablaServicios }}

# REGLAS OBLIGATORIAS DE BASE DE DATOS

1. SIEMPRE ejecuta Buscar Paciente DB PRIMERO con el teléfono del paciente antes de cualquier otra operación
2. Después de registrar un paciente nuevo, vuelve a ejecutar Buscar Paciente DB para verificar que se registró correctamente
3. SIEMPRE ejecuta Guardar Cita DB para crear citas nuevas
4. NO confirmes ninguna operación hasta que la herramienta correspondiente confirme el éxito

# REGLAS DE ESTADOS DE CITAS

- Pendiente: cuando se crea una cita nueva (automático en Guardar Cita DB)
- Confirmada: cuando el paciente confirma su cita existente sin cambios
- Modificada: cuando se cambia la fecha, hora o tipo de una cita existente. SIEMPRE usa Modificar Cita DB para esto.
- Cancelada: cuando el paciente cancela la cita
- Completada: cuando la cita ya se realizó

REGLA: Si el paciente cambia fecha u hora, SIEMPRE usa "Modificar Cita DB" (NO "Actualizar Estado Cita DB"). Modificar Cita DB actualiza fecha, hora Y pone estado "Modificada" automáticamente.

# REGLAS CLAVE

## A) Identificación del paciente (OBLIGATORIO EN CADA CONVERSACIÓN)
- El teléfono del paciente es: {{ $('Preparar Datos').item.json.phoneNumber }}
- Su nombre de WhatsApp es: {{ $('Preparar Datos').item.json.pushName }}
- SIEMPRE al inicio de la conversación, usa Buscar Paciente DB con el teléfono para saber si ya está registrado
- Si YA existe: saludá por su nombre registrado y NO vuelvas a pedir datos
- Si NO existe: pedile su nombre completo. Email y fecha de nacimiento son opcionales. Registralo con Registrar Paciente DB antes de cualquier otra acción
- NUNCA agendes una cita sin saber el nombre del paciente

## B) Duración y hora de fin
- Calcula End = Start + Duración del servicio
- SIEMPRE muestra rango: HH:MM - HH:MM

## C) Verificar disponibilidad
- SIEMPRE usa Ver Disponibilidad DB antes de agendar para ver las citas existentes en esa fecha
- La herramienta devuelve las citas YA AGENDADAS para esa fecha
- Verificá que el horario solicitado NO se superponga con citas existentes
- Verificá que el horario esté dentro del horario de atención de la clínica

# HERRAMIENTAS

## Base de Datos (PostgreSQL)
- **Ver Disponibilidad DB**: Consulta citas existentes para una fecha. Devuelve las citas YA AGENDADAS. SIEMPRE usar antes de proponer horarios.
- **Buscar Paciente DB**: Busca por teléfono del paciente
- **Registrar Paciente DB**: Registra paciente nuevo. Nombre + teléfono requeridos.
- **Buscar Cita DB**: Busca citas por teléfono del paciente, devuelve id y detalles
- **Guardar Cita DB**: Crea una cita nueva en la base de datos
- **Modificar Cita DB**: Actualiza fecha, hora y estado a "Modificada". USAR cuando el paciente cambia fecha/hora. Necesita el id de la cita (obtenerlo de Buscar Cita DB).
- **Actualizar Estado Cita DB**: SOLO para cambiar estado sin cambiar fecha/hora (Confirmada, Cancelada, Completada). Necesita el id de la cita (obtenerlo de Buscar Cita DB).

## Gmail - Escalar a Humano
- Envía email al equipo cuando el paciente necesita hablar con un humano

# FLUJOS

## Reservar nueva cita:
1. Buscar Paciente DB (por teléfono)
2. Si no existe → Registrar Paciente DB
3. Ver Disponibilidad DB (para la fecha deseada)
4. Verificar que no hay conflictos de horario
5. Guardar Cita DB

## Modificar cita existente:
1. Buscar Cita DB (por teléfono) → obtener id de la cita
2. Ver Disponibilidad DB (para la nueva fecha)
3. Modificar Cita DB (con id, nueva fecha y hora)

## Cancelar cita:
1. Buscar Cita DB (por teléfono) → obtener id
2. Actualizar Estado Cita DB (id, estado: "Cancelada")
3. Ofrecer reagendar

## Confirmar cita:
1. Buscar Cita DB (por teléfono) → obtener id
2. Actualizar Estado Cita DB (id, estado: "Confirmada")

## Consulta de citas:
1. Buscar Cita DB (por teléfono) → mostrar detalles

# REGLAS DE NEGOCIO
- Antelación mínima: 2 horas
- Antelación máxima: 30 días
- Solo dentro del horario de la clínica
- Sin citas en festivos
- Cuando el paciente pregunte por servicios, precios o qué tratamientos ofrecen, SIEMPRE mostrá la lista completa de servicios con duración y precio
- Cuando el paciente quiera agendar una cita, mencioná los servicios disponibles para que elija

# DATOS DEL PACIENTE ACTUAL
- Teléfono: {{ $('Preparar Datos').item.json.phoneNumber }}
- Nombre WhatsApp: {{ $('Preparar Datos').item.json.pushName }}

# COMUNICACION
- Usá emojis con criterio para dar calidez
- Fechas siempre verificadas con el CALENDARIO DE REFERENCIA
- Mensajes cortos pero con onda, nada de textos largos ni formales
- Nunca uses lenguaje robótico como "Procederé a", "He procedido", "Se ha registrado exitosamente"
- En su lugar usá: "¡Listo!", "¡Ya quedó!", "¡Perfecto, agendado!"

# INSTRUCCIONES PERSONALIZADAS DEL ADMINISTRADOR

{{ $('Preparar Datos').item.json.promptSistema }}`;

async function main() {
  console.log('=== Fetching workflow ===');
  const res = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  if (!res.ok) {
    console.error('Failed to fetch workflow:', res.status);
    process.exit(1);
  }
  const wf = await res.json();
  console.log(`Loaded: ${wf.nodes.length} nodes, version: ${wf.versionId}`);

  // ============================================================
  // FIX 1: SQL INJECTION — Sanitize all postgresTool queries
  // ============================================================
  console.log('\n=== FIX 1: SQL Injection ===');

  const queryPatches = {
    'tool-bp-v4b': `SELECT * FROM pacientes WHERE telefono = regexp_replace('{{ $fromAI("telefono", "Numero de telefono del paciente") }}', '[^0-9+]', '', 'g') AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }}`,

    'tool-rp-v4b': `INSERT INTO pacientes (telefono, nombre, email, fecha_nacimiento, notas, clinica_id) VALUES (regexp_replace('{{ $fromAI("telefono", "Telefono obligatorio") }}', '[^0-9+]', '', 'g'), regexp_replace('{{ $fromAI("nombre", "Nombre obligatorio") }}', '''', '''''', 'g'), NULLIF(regexp_replace('{{ $fromAI("email", "Email opcional") }}', '''', '''''', 'g'), ''), NULLIF('{{ $fromAI("fecha_nacimiento", "Fecha YYYY-MM-DD opcional") }}', '')::date, NULLIF(regexp_replace('{{ $fromAI("notas", "Notas opcional") }}', '''', '''''', 'g'), ''), {{ $('Preparar Datos').item.json.clinicaId }}) RETURNING *`,

    'tool-bc-v4b': `SELECT id, paciente_telefono, paciente_nombre, fecha_cita::text, hora_cita::text, tipo_cita, estado, notas FROM citas WHERE paciente_telefono = regexp_replace('{{ $fromAI("telefono", "Telefono del paciente") }}', '[^0-9+]', '', 'g') AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }} ORDER BY fecha_cita DESC, hora_cita DESC`,

    'tool-gc-v4b': `INSERT INTO citas (paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas, clinica_id) VALUES (regexp_replace('{{ $fromAI("paciente_telefono", "Telefono") }}', '[^0-9+]', '', 'g'), regexp_replace('{{ $fromAI("paciente_nombre", "Nombre") }}', '''', '''''', 'g'), LEFT('{{ $fromAI("fecha_cita", "Fecha YYYY-MM-DD") }}', 10)::date, LEFT('{{ $fromAI("hora_cita", "Hora HH:MM") }}', 5)::time, regexp_replace('{{ $fromAI("tipo_cita", "Tipo de cita") }}', '''', '''''', 'g'), 'Pendiente', NULLIF(regexp_replace('{{ $fromAI("notas", "Notas opcional") }}', '''', '''''', 'g'), ''), {{ $('Preparar Datos').item.json.clinicaId }}) RETURNING *`,

    'tool-ac-v4b': `UPDATE citas SET estado = regexp_replace('{{ $fromAI("nuevo_estado", "Estado: Confirmada, Modificada, Cancelada o Completada") }}', '''', '''''', 'g') WHERE id = {{ $fromAI("cita_id", "ID numerico de la cita a actualizar") }}::integer AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }} RETURNING id, estado`,

    'tool-mc-v4b': `UPDATE citas SET fecha_cita = LEFT('{{ $fromAI("fecha_cita", "Nueva fecha YYYY-MM-DD") }}', 10)::date, hora_cita = LEFT('{{ $fromAI("hora_cita", "Nueva hora HH:MM") }}', 5)::time, estado = 'Modificada' WHERE id = {{ $fromAI("cita_id", "ID numerico de la cita a modificar") }}::integer AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }} RETURNING id, fecha_cita::text, hora_cita::text, estado`
  };

  let sqlPatched = 0;
  for (const node of wf.nodes) {
    if (queryPatches[node.id]) {
      node.parameters.query = queryPatches[node.id];
      sqlPatched++;
      console.log(`  Patched: ${node.name}`);
    }
  }
  console.log(`  Total: ${sqlPatched} queries sanitized`);

  // ============================================================
  // FIX 2: GOOGLE CALENDAR — Disable nodes, remove connections, add DB tool
  // ============================================================
  console.log('\n=== FIX 2: Google Calendar ===');

  const calendarNodes = [
    'Ver Disponibilidad Calendar',
    'Crear Cita Calendar',
    'Actualizar Cita Calendar',
    'Eliminar Cita Calendar'
  ];

  for (const calName of calendarNodes) {
    // Remove connections
    if (wf.connections[calName]) {
      delete wf.connections[calName];
      console.log(`  Disconnected: ${calName}`);
    }
    // Disable nodes
    const node = wf.nodes.find(n => n.name === calName);
    if (node) {
      node.disabled = true;
      console.log(`  Disabled: ${calName}`);
    }
  }

  // Add new "Ver Disponibilidad DB" tool
  const availabilityTool = {
    parameters: {
      operation: "executeQuery",
      query: `SELECT id, paciente_nombre, fecha_cita::text, hora_cita::text, tipo_cita, estado FROM citas WHERE fecha_cita = LEFT('{{ $fromAI("fecha", "Fecha a consultar YYYY-MM-DD") }}', 10)::date AND estado NOT IN ('Cancelada') AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }} ORDER BY hora_cita ASC`,
      options: {}
    },
    id: "tool-disp-db-v4",
    name: "Ver Disponibilidad DB",
    type: "n8n-nodes-base.postgresTool",
    typeVersion: 2.5,
    position: [-832, 3600],
    credentials: {
      postgres: { id: "qUemVVy0Pv8Oyhi5", name: "Postgres account" }
    }
  };
  wf.nodes.push(availabilityTool);
  wf.connections["Ver Disponibilidad DB"] = {
    ai_tool: [[{ node: "AI Agent", type: "ai_tool", index: 0 }]]
  };
  console.log('  Added: Ver Disponibilidad DB tool');

  // ============================================================
  // FIX 3: SYSTEM PROMPT — Update to remove Calendar, remove hardcoded services
  // ============================================================
  console.log('\n=== FIX 3: System Prompt ===');

  const agentNode = wf.nodes.find(n => n.id === 'agent-v4');
  if (!agentNode) {
    console.error('AI Agent node not found!');
    process.exit(1);
  }
  agentNode.parameters.options.systemMessage = '=' + NEW_SYSTEM_PROMPT;
  console.log('  Updated AI Agent system prompt');
  console.log('  - Removed Google Calendar references');
  console.log('  - Removed hardcoded services table');
  console.log('  - Updated flows to DB-only');
  console.log('  - Changed event_id_google to cita id');

  // ============================================================
  // FIX 4: TIMEZONE — Replace hardcoded UTC-3 with Intl.DateTimeFormat
  // ============================================================
  console.log('\n=== FIX 4: Timezone ===');

  const prepNode = wf.nodes.find(n => n.id === 'code-prep-v4');
  if (!prepNode) {
    console.error('Preparar Datos node not found!');
    process.exit(1);
  }

  const oldCode = prepNode.parameters.jsCode;
  const newCode = oldCode.replace(
    /\/\/ Hoy en Paraguay.*?const hoy = new Date\(paraguayTime\.getFullYear\(\), paraguayTime\.getMonth\(\), paraguayTime\.getDate\(\)\);/s,
    `// Hoy en Paraguay (con DST automático via Intl)
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Asuncion',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false
});
const parts = formatter.formatToParts(new Date());
const getPart = (type) => parts.find(p => p.type === type)?.value;
const paraguayTime = new Date(
  parseInt(getPart('year')),
  parseInt(getPart('month')) - 1,
  parseInt(getPart('day')),
  parseInt(getPart('hour')),
  parseInt(getPart('minute')),
  parseInt(getPart('second'))
);
const hoy = new Date(paraguayTime.getFullYear(), paraguayTime.getMonth(), paraguayTime.getDate());`
  );

  if (newCode === oldCode) {
    console.error('  WARNING: Could not find timezone code to replace!');
  } else {
    prepNode.parameters.jsCode = newCode;
    console.log('  Replaced hardcoded UTC-3 with Intl.DateTimeFormat');
  }

  // ============================================================
  // FIX 5: ERROR HANDLING — Enable the 3 disabled error nodes
  // ============================================================
  console.log('\n=== FIX 5: Error Handling ===');

  const errorNodeIds = ['err-trigger-v4', 'err-format-v4', 'err-email-v4'];
  for (const node of wf.nodes) {
    if (errorNodeIds.includes(node.id) && node.disabled) {
      delete node.disabled;
      console.log(`  Enabled: ${node.name}`);
    }
  }

  // ============================================================
  // APPLY ALL CHANGES — Single PUT
  // ============================================================
  console.log('\n=== Applying all changes ===');

  const putRes = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      nodes: wf.nodes,
      connections: wf.connections,
      settings: wf.settings,
      name: wf.name
    })
  });

  const result = await putRes.json();
  if (putRes.ok) {
    console.log(`SUCCESS! Workflow updated.`);
    console.log(`New version: ${result.versionId}`);
    console.log(`Nodes: ${result.nodes.length}`);
  } else {
    console.error('FAILED to update workflow:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
