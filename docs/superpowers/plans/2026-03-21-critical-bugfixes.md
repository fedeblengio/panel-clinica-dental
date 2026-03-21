# Critical Bugfixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 critical bugs in the dental clinic bot system (n8n workflows + server.js) without breaking existing functionality.

**Architecture:** The system has two parts to modify: (1) n8n workflow `kLpuSxhruNC5Ycas` updated via PUT to the n8n REST API, and (2) `server.js` edited locally. All n8n changes are applied by fetching the current workflow JSON, modifying nodes/connections in-memory with a Node.js script, and PUTting the result back.

**Tech Stack:** n8n REST API, Node.js, PostgreSQL, Express

**n8n API Details:**
- Base: `https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1`
- Auth header: `X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDY4MTYzNy1hNGM5LTQwNmItOGRkNy00ZTJiZTliMzg2MGMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0MDQ0Mzk5fQ.AJ2ZfSKWHkeD8BOWgWMeO7WhNhUCatU-PXJDlAeOtZs`
- Workflow ID: `kLpuSxhruNC5Ycas`

---

## Task 1: Backup current workflow before any changes

**Files:**
- Create: `backups/wf-recepcionista-v4-backup-2026-03-21.json`

- [ ] **Step 1: Download and save current workflow JSON as backup**

```bash
curl -s -H "X-N8N-API-KEY: <key>" \
  "https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1/workflows/kLpuSxhruNC5Ycas" \
  > backups/wf-recepcionista-v4-backup-2026-03-21.json
```

- [ ] **Step 2: Verify backup is valid JSON**

```bash
node -e "const f=require('fs').readFileSync('backups/wf-recepcionista-v4-backup-2026-03-21.json','utf8'); const j=JSON.parse(f); console.log('OK: '+j.nodes.length+' nodes')"
```
Expected: `OK: 34 nodes`

- [ ] **Step 3: Commit backup**

```bash
git add backups/
git commit -m "backup: save recepcionista v4 workflow before critical fixes"
```

---

## Task 2: Fix SQL Injection — Sanitize all postgresTool queries

The `postgresTool` nodes use `$fromAI()` string interpolation directly in SQL. We cannot use parameterized queries ($1, $2) in postgresTool nodes because `$fromAI()` is the only input mechanism for AI Agent tools. The fix: wrap all `$fromAI()` values with PostgreSQL's `quote_literal()` or `replace()` to escape single quotes, and cast numeric values with `::integer`.

**Nodes to modify (by id):**

| Node ID | Name | Current vulnerability |
|---------|------|----------------------|
| `tool-bp-v4b` | Buscar Paciente DB | `WHERE telefono = '{{ $fromAI("telefono") }}'` |
| `tool-rp-v4b` | Registrar Paciente DB | All VALUES use `'{{ $fromAI(...) }}'` |
| `tool-bc-v4b` | Buscar Cita DB | `WHERE paciente_telefono = '{{ $fromAI(...) }}'` |
| `tool-gc-v4b` | Guardar Cita DB | All VALUES use `'{{ $fromAI(...) }}'` |
| `tool-ac-v4b` | Actualizar Estado Cita DB | `WHERE event_id_google = '{{ $fromAI(...) }}'` |
| `tool-mc-v4b` | Modificar Cita DB | `WHERE event_id_google = '{{ $fromAI(...) }}'` |

- [ ] **Step 1: Create a Node.js script to patch all SQL queries**

Create `scripts/patch-sql-injection.js`:

```javascript
// Fetches the workflow, patches all postgresTool queries to sanitize $fromAI() inputs,
// and PUTs the updated workflow back.

const API_BASE = 'https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1';
const API_KEY = process.env.N8N_API_KEY;
const WF_ID = 'kLpuSxhruNC5Ycas';

async function main() {
  // Fetch current workflow
  const res = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const wf = await res.json();

  // Define sanitized queries per node ID
  const queryPatches = {
    'tool-bp-v4b': `SELECT * FROM pacientes WHERE telefono = regexp_replace('{{ $fromAI("telefono", "Numero de telefono del paciente") }}', '[^0-9+]', '', 'g') AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }}`,

    'tool-rp-v4b': `INSERT INTO pacientes (telefono, nombre, email, fecha_nacimiento, notas, clinica_id) VALUES (regexp_replace('{{ $fromAI("telefono", "Telefono obligatorio") }}', '[^0-9+]', '', 'g'), regexp_replace('{{ $fromAI("nombre", "Nombre obligatorio") }}', '''', '''''', 'g'), NULLIF(regexp_replace('{{ $fromAI("email", "Email opcional") }}', '''', '''''', 'g'), ''), NULLIF('{{ $fromAI("fecha_nacimiento", "Fecha YYYY-MM-DD opcional") }}', '')::date, NULLIF(regexp_replace('{{ $fromAI("notas", "Notas opcional") }}', '''', '''''', 'g'), ''), {{ $('Preparar Datos').item.json.clinicaId }}) RETURNING *`,

    'tool-bc-v4b': `SELECT id, event_id_google, paciente_telefono, paciente_nombre, fecha_cita::text, hora_cita::text, tipo_cita, estado, notas FROM citas WHERE paciente_telefono = regexp_replace('{{ $fromAI("telefono", "Telefono del paciente") }}', '[^0-9+]', '', 'g') AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }} ORDER BY fecha_cita DESC, hora_cita DESC`,

    'tool-gc-v4b': `INSERT INTO citas (paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas, clinica_id) VALUES (regexp_replace('{{ $fromAI("paciente_telefono", "Telefono") }}', '[^0-9+]', '', 'g'), regexp_replace('{{ $fromAI("paciente_nombre", "Nombre") }}', '''', '''''', 'g'), LEFT('{{ $fromAI("fecha_cita", "Fecha YYYY-MM-DD") }}', 10)::date, LEFT('{{ $fromAI("hora_cita", "Hora HH:MM") }}', 5)::time, regexp_replace('{{ $fromAI("tipo_cita", "Tipo de cita") }}', '''', '''''', 'g'), 'Pendiente', NULLIF(regexp_replace('{{ $fromAI("notas", "Notas opcional") }}', '''', '''''', 'g'), ''), {{ $('Preparar Datos').item.json.clinicaId }}) RETURNING *`,

    'tool-ac-v4b': `UPDATE citas SET estado = regexp_replace('{{ $fromAI("nuevo_estado", "Estado: Confirmada, Modificada, Cancelada o Completada") }}', '''', '''''', 'g') WHERE id = {{ $fromAI("cita_id", "ID numerico de la cita") }}::integer AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }} RETURNING id, estado`,

    'tool-mc-v4b': `UPDATE citas SET fecha_cita = LEFT('{{ $fromAI("fecha_cita", "Nueva fecha YYYY-MM-DD") }}', 10)::date, hora_cita = LEFT('{{ $fromAI("hora_cita", "Nueva hora HH:MM") }}', 5)::time, estado = 'Modificada' WHERE id = {{ $fromAI("cita_id", "ID numerico de la cita") }}::integer AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }} RETURNING id, fecha_cita::text, hora_cita::text, estado`
  };

  let patched = 0;
  for (const node of wf.nodes) {
    if (queryPatches[node.id]) {
      node.parameters.query = queryPatches[node.id];
      patched++;
      console.log(`Patched: ${node.name} (${node.id})`);
    }
  }
  console.log(`\nTotal patched: ${patched} nodes`);

  // PUT updated workflow
  const putRes = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(wf)
  });
  const result = await putRes.json();
  if (putRes.ok) {
    console.log('Workflow updated successfully. Version:', result.versionId);
  } else {
    console.error('Failed to update:', result);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

**Key changes in queries:**
- Phone numbers: `regexp_replace(value, '[^0-9+]', '', 'g')` — strips everything except digits and +
- Text fields (nombre, notas, tipo_cita): `regexp_replace(value, '''', '''''', 'g')` — escapes single quotes
- Removed `event_id_google` from WHERE clauses, replaced with `id::integer` (numeric ID is safer and doesn't depend on Google Calendar)
- Removed `event_id_google` from Guardar Cita DB INSERT (no longer using Google Calendar)

- [ ] **Step 2: Run the patch script**

```bash
N8N_API_KEY="<key>" node scripts/patch-sql-injection.js
```
Expected: `Patched: 6 nodes` + `Workflow updated successfully`

- [ ] **Step 3: Verify by re-fetching and checking one query**

```bash
curl -s -H "X-N8N-API-KEY: <key>" \
  "https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1/workflows/kLpuSxhruNC5Ycas" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const w=JSON.parse(d);const n=w.nodes.find(n=>n.id==='tool-bp-v4b');console.log(n.parameters.query)})"
```
Expected: Query should contain `regexp_replace` instead of raw interpolation.

---

## Task 3: Disconnect Google Calendar tools (keep nodes, remove connections)

Disconnect the 4 Google Calendar tool nodes from the AI Agent so they're not used, but keep the nodes in the workflow for future use. Add a new PostgreSQL tool for checking appointment availability.

- [ ] **Step 1: Create script to disconnect Calendar and add availability tool**

Create `scripts/patch-calendar.js`:

```javascript
const API_BASE = 'https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1';
const API_KEY = process.env.N8N_API_KEY;
const WF_ID = 'kLpuSxhruNC5Ycas';

async function main() {
  const res = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const wf = await res.json();

  // 1. Remove Calendar tool connections from AI Agent
  const calendarNodes = [
    'Ver Disponibilidad Calendar',
    'Crear Cita Calendar',
    'Actualizar Cita Calendar',
    'Eliminar Cita Calendar'
  ];

  for (const calName of calendarNodes) {
    if (wf.connections[calName]) {
      console.log(`Disconnecting: ${calName}`);
      delete wf.connections[calName];
    }
  }

  // 2. Disable Calendar nodes (set disabled: true so they stay but don't execute)
  for (const node of wf.nodes) {
    if (calendarNodes.includes(node.name)) {
      node.disabled = true;
      console.log(`Disabled node: ${node.name}`);
    }
  }

  // 3. Add new PostgreSQL tool: "Ver Disponibilidad DB"
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
    position: [-832, 3728], // Same position as old Calendar availability
    credentials: {
      postgres: { id: "qUemVVy0Pv8Oyhi5", name: "Postgres account" }
    }
  };

  wf.nodes.push(availabilityTool);

  // 4. Connect new tool to AI Agent
  wf.connections["Ver Disponibilidad DB"] = {
    ai_tool: [[{ node: "AI Agent", type: "ai_tool", index: 0 }]]
  };

  console.log('Added: Ver Disponibilidad DB tool');

  // PUT updated workflow
  const putRes = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(wf)
  });
  const result = await putRes.json();
  if (putRes.ok) {
    console.log('Workflow updated. Version:', result.versionId);
  } else {
    console.error('Failed:', result);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the patch**

```bash
N8N_API_KEY="<key>" node scripts/patch-calendar.js
```

- [ ] **Step 3: Verify Calendar nodes are disabled and new tool connected**

```bash
curl -s -H "X-N8N-API-KEY: <key>" \
  "https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1/workflows/kLpuSxhruNC5Ycas" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const w=JSON.parse(d);w.nodes.filter(n=>n.name.includes('Calendar')||n.name.includes('Disponibilidad')).forEach(n=>console.log(n.name,n.disabled?'DISABLED':'ACTIVE'));console.log('Connection Ver Disponibilidad DB:',!!w.connections['Ver Disponibilidad DB'])})"
```

Expected:
```
Ver Disponibilidad Calendar DISABLED
Crear Cita Calendar DISABLED
Actualizar Cita Calendar DISABLED
Eliminar Cita Calendar DISABLED
Ver Disponibilidad DB ACTIVE
Connection Ver Disponibilidad DB: true
```

---

## Task 4: Update System Prompt — Remove Calendar references, update flows

The system prompt needs to be updated to:
- Remove all Google Calendar references
- Update flows to use only PostgreSQL tools
- Remove the hardcoded services table (keep only dynamic one)
- Update tool descriptions

- [ ] **Step 1: Create script to patch the system prompt**

Create `scripts/patch-prompt.js`:

```javascript
const API_BASE = 'https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1';
const API_KEY = process.env.N8N_API_KEY;
const WF_ID = 'kLpuSxhruNC5Ycas';

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
- **Modificar Cita DB**: Actualiza fecha, hora y estado a "Modificada". USAR cuando el paciente cambia fecha/hora.
- **Actualizar Estado Cita DB**: SOLO para cambiar estado sin cambiar fecha/hora (Confirmada, Cancelada, Completada). Necesita el id de la cita (obtenerlo de Buscar Cita DB).

## Gmail - Escalar a Humano
- Envía email al equipo cuando el paciente necesita hablar con un humano

# FLUJOS

## Reservar nueva cita:
1. Buscar Paciente DB (por teléfono)
2. Si no existe → Registrar Paciente DB
3. Ver Disponibilidad DB (para la fecha deseada)
4. Verificar que no hay conflictos
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
  const res = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const wf = await res.json();

  // Find the AI Agent node and update system prompt
  const agentNode = wf.nodes.find(n => n.id === 'agent-v4');
  if (!agentNode) {
    console.error('AI Agent node not found!');
    process.exit(1);
  }

  agentNode.parameters.options.systemMessage = '=' + NEW_SYSTEM_PROMPT;
  console.log('Updated AI Agent system prompt');

  // PUT updated workflow
  const putRes = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(wf)
  });
  const result = await putRes.json();
  if (putRes.ok) {
    console.log('Workflow updated. Version:', result.versionId);
  } else {
    console.error('Failed:', result);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

**Key changes in the prompt:**
- Removed all Google Calendar references and instructions
- Removed the "## C) Calendar" section with ISO 8601 offset instructions
- Removed the hardcoded services table at the bottom (kept only `{{ tablaServicios }}`)
- Updated all flows to use DB-only operations (no Calendar steps)
- Changed tools to use `id` instead of `event_id_google` for identifying citas
- Added "Ver Disponibilidad DB" tool description explaining it returns EXISTING appointments

- [ ] **Step 2: Run the patch**

```bash
N8N_API_KEY="<key>" node scripts/patch-prompt.js
```

- [ ] **Step 3: Verify prompt was updated**

Quick check that "Google Calendar" no longer appears in the prompt:
```bash
curl -s -H "X-N8N-API-KEY: <key>" \
  "https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1/workflows/kLpuSxhruNC5Ycas" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const w=JSON.parse(d);const a=w.nodes.find(n=>n.id==='agent-v4');const p=a.parameters.options.systemMessage;console.log('Contains Google Calendar:',p.includes('Google Calendar'));console.log('Contains Ver Disponibilidad DB:',p.includes('Ver Disponibilidad DB'));console.log('Contains hardcoded services table:',p.includes('| Primera visita | 30 min |'))})"
```
Expected:
```
Contains Google Calendar: false
Contains Ver Disponibilidad DB: true
Contains hardcoded services table: false
```

---

## Task 5: Fix Timezone — Use Luxon/Intl instead of hardcoded UTC-3

The "Preparar Datos" code node hardcodes `paraguayOffset = -3`. Paraguay uses UTC-3 in summer (Oct-Mar) and UTC-4 in winter (Mar-Oct). Fix by using `Intl.DateTimeFormat` which handles DST automatically.

- [ ] **Step 1: Create script to patch the timezone code**

Create `scripts/patch-timezone.js`:

```javascript
const API_BASE = 'https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1';
const API_KEY = process.env.N8N_API_KEY;
const WF_ID = 'kLpuSxhruNC5Ycas';

async function main() {
  const res = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const wf = await res.json();

  const prepNode = wf.nodes.find(n => n.id === 'code-prep-v4');
  if (!prepNode) { console.error('Preparar Datos node not found!'); process.exit(1); }

  // Replace the timezone calculation block
  const oldCode = prepNode.parameters.jsCode;

  // Find and replace the Paraguay timezone calculation
  const newCode = oldCode
    .replace(
      /\/\/ Hoy en Paraguay.*?const hoy = new Date\(paraguayTime\.getFullYear\(\), paraguayTime\.getMonth\(\), paraguayTime\.getDate\(\)\);/s,
      `// Hoy en Paraguay (con DST automático)
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
    console.error('Could not find timezone code to replace!');
    process.exit(1);
  }

  prepNode.parameters.jsCode = newCode;
  console.log('Patched timezone calculation in Preparar Datos');

  const putRes = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(wf)
  });
  const result = await putRes.json();
  if (putRes.ok) {
    console.log('Workflow updated. Version:', result.versionId);
  } else {
    console.error('Failed:', result);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the patch**

```bash
N8N_API_KEY="<key>" node scripts/patch-timezone.js
```

- [ ] **Step 3: Verify the old hardcoded offset is gone**

```bash
curl -s -H "X-N8N-API-KEY: <key>" \
  "https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1/workflows/kLpuSxhruNC5Ycas" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const w=JSON.parse(d);const n=w.nodes.find(n=>n.id==='code-prep-v4');console.log('Contains hardcoded offset:',n.parameters.jsCode.includes('paraguayOffset = -3'));console.log('Contains Intl.DateTimeFormat:',n.parameters.jsCode.includes('Intl.DateTimeFormat'))})"
```
Expected:
```
Contains hardcoded offset: false
Contains Intl.DateTimeFormat: true
```

---

## Task 6: Enable Error Handling — Activate the 3 disabled error nodes

- [ ] **Step 1: Create script to enable error nodes**

Create `scripts/patch-errors.js`:

```javascript
const API_BASE = 'https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1';
const API_KEY = process.env.N8N_API_KEY;
const WF_ID = 'kLpuSxhruNC5Ycas';

async function main() {
  const res = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const wf = await res.json();

  const errorNodeIds = ['err-trigger-v4', 'err-format-v4', 'err-email-v4'];
  let enabled = 0;

  for (const node of wf.nodes) {
    if (errorNodeIds.includes(node.id) && node.disabled) {
      delete node.disabled;
      enabled++;
      console.log(`Enabled: ${node.name}`);
    }
  }
  console.log(`Enabled ${enabled} error handling nodes`);

  const putRes = await fetch(`${API_BASE}/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(wf)
  });
  const result = await putRes.json();
  if (putRes.ok) {
    console.log('Workflow updated. Version:', result.versionId);
  } else {
    console.error('Failed:', result);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the patch**

```bash
N8N_API_KEY="<key>" node scripts/patch-errors.js
```

---

## Task 7: Fix server.js — Remove hardcoded Evolution API key

**Files:**
- Modify: `server.js:12`

- [ ] **Step 1: Remove the default fallback API key**

Change line 12 from:
```javascript
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';
```
To:
```javascript
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
```

Also add a startup check after the constant:
```javascript
if (!EVOLUTION_API_KEY) {
  console.warn('WARNING: EVOLUTION_API_KEY not set. Evolution API features will not work.');
}
```

- [ ] **Step 2: Verify the change doesn't break anything**

The server should still start (Evolution API calls will just fail gracefully with `evolutionFetch` returning null).

- [ ] **Step 3: Commit all changes**

```bash
git add server.js scripts/
git commit -m "fix: remove hardcoded Evolution API key, add patch scripts for n8n workflow fixes"
```

---

## Summary of All Changes

| Fix | What Changed | Where |
|-----|-------------|-------|
| SQL Injection | All postgresTool queries sanitized with `regexp_replace()` | n8n workflow nodes |
| Google Calendar | 4 Calendar nodes disabled, connections removed, new "Ver Disponibilidad DB" tool added | n8n workflow |
| System Prompt | Removed Calendar refs, removed hardcoded services table, updated flows to DB-only | n8n workflow AI Agent |
| Timezone | Replaced hardcoded UTC-3 with `Intl.DateTimeFormat('America/Asuncion')` | n8n workflow Code node |
| Error Handling | Enabled 3 disabled error notification nodes | n8n workflow |
| API Key | Removed hardcoded fallback from server.js | server.js:12 |
