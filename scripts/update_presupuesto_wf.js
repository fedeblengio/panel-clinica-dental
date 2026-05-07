/**
 * Script para agregar herramientas de Presupuesto PDF al workflow Recepcionista v4
 *
 * Enfoque: postgresTool (mismo tipo que las otras tools del agente)
 * El tool inserta en la tabla presupuestos y retorna el token.
 * Luego un nodo downstream (después del agente) detecta si se generó
 * un presupuesto y llama al endpoint HTTP para generar/enviar el PDF.
 *
 * Ejecutar: node scripts/update_presupuesto_wf.js
 */

const N8N_URL = 'https://humberto-proyect-n8n.jxugns.easypanel.host';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDY4MTYzNy1hNGM5LTQwNmItOGRkNy00ZTJiZTliMzg2MGMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0MDQ0Mzk5fQ.AJ2ZfSKWHkeD8BOWgWMeO7WhNhUCatU-PXJDlAeOtZs';
const WF_ID = 'kLpuSxhruNC5Ycas';
const PANEL_URL = 'https://humberto-proyect-pagina-web-clinica-dental.jxugns.easypanel.host';

async function main() {
  console.log('Descargando workflow...');
  const res = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const workflow = await res.json();
  console.log(`Workflow: ${workflow.name} (${workflow.nodes.length} nodos)`);

  // --- 1. ELIMINAR NODOS toolHttpRequest VIEJOS ---
  const oldNames = ['Presupuesto Citas PDF', 'Cotización Servicios PDF', 'Cotizacion Servicios PDF'];
  workflow.nodes = workflow.nodes.filter(n => {
    if (oldNames.includes(n.name)) {
      console.log(`  Eliminando nodo viejo "${n.name}" (tipo: ${n.type})`);
      delete workflow.connections[n.name];
      return false;
    }
    return true;
  });

  // --- 2. AGREGAR postgresTool PARA PRESUPUESTO ---
  // Usa el mismo tipo y credential que los demás tools (Buscar Paciente DB, etc.)
  const existingTool = workflow.nodes.find(n => n.name === 'Buscar Paciente DB');
  const credentials = existingTool?.credentials || {};

  const newTools = [
    {
      id: 'tool-presupuesto-db',
      name: 'Generar Presupuesto DB',
      type: 'n8n-nodes-base.postgresTool',
      typeVersion: 2.5,
      position: [464, 3900],
      credentials: credentials,
      parameters: {
        operation: 'executeQuery',
        query: `WITH datos AS (
  SELECT
    c.id as cita_id, c.tipo_cita, c.fecha_cita::text, c.hora_cita::text, c.precio as cita_precio,
    p.nombre as paciente_nombre, p.telefono as paciente_telefono,
    cc.nombre_clinica, cc.direccion, cc.telefono as tel_clinica, cc.email, cc.servicios,
    cl.instance_name,
    gen_random_uuid()::text as token
  FROM pacientes p
  JOIN clinicas cl ON cl.id = p.clinica_id
  JOIN configuracion_clinica cc ON cc.clinica_id = cl.id
  LEFT JOIN citas c ON c.paciente_telefono = p.telefono AND c.clinica_id = cl.id
    AND c.estado IN ('Pendiente', 'Confirmada', 'Modificada')
  WHERE p.telefono = $1 AND cl.id = $2
  ORDER BY c.fecha_cita, c.hora_cita
),
resumen AS (
  SELECT
    token, paciente_nombre, paciente_telefono, instance_name,
    nombre_clinica, direccion, tel_clinica, email, servicios,
    json_agg(json_build_object(
      'nombre', tipo_cita, 'fecha', fecha_cita, 'hora', hora_cita,
      'precio', COALESCE(cita_precio, (SELECT (s->>'precio')::int FROM jsonb_array_elements(servicios) s WHERE LOWER(TRIM(s->>'nombre')) = LOWER(TRIM(tipo_cita)) LIMIT 1), 0)
    )) FILTER (WHERE tipo_cita IS NOT NULL) as items
  FROM datos
  GROUP BY token, paciente_nombre, paciente_telefono, instance_name, nombre_clinica, direccion, tel_clinica, email, servicios
)
INSERT INTO presupuestos (token, clinica_id, paciente_telefono, paciente_nombre, tipo, items, total, clinica_datos)
SELECT
  token, $2, paciente_telefono, paciente_nombre, 'citas_agendadas',
  COALESCE(items, '[]'::json),
  COALESCE((SELECT SUM((i->>'precio')::int) FROM json_array_elements(items) i), 0),
  json_build_object('nombre_clinica', nombre_clinica, 'direccion', direccion, 'telefono', tel_clinica, 'email', email)
FROM resumen
RETURNING token, total, (SELECT json_array_length(items) FROM resumen) as items_count`,
        options: {
          toolDescription: 'Genera un presupuesto PDF con las citas agendadas (pendientes/confirmadas) del paciente. Usar cuando el paciente dice "quiero un presupuesto de mis citas", "cuanto me salen mis citas". Necesita telefono del paciente y clinica_id. Devuelve token (para el link de descarga) y total en guaranies.'
        }
      }
    },
    {
      id: 'tool-cotizacion-db',
      name: 'Generar Cotizacion DB',
      type: 'n8n-nodes-base.postgresTool',
      typeVersion: 2.5,
      position: [464, 4100],
      credentials: credentials,
      parameters: {
        operation: 'executeQuery',
        query: `WITH servicios_req AS (
  SELECT s->>'nombre' as nombre, (s->>'precio')::int as precio
  FROM configuracion_clinica cc, jsonb_array_elements(cc.servicios) s
  WHERE cc.clinica_id = $2
    AND LOWER(TRIM(s->>'nombre')) = ANY(SELECT LOWER(TRIM(x)) FROM unnest(string_to_array($3, ',')) x)
)
INSERT INTO presupuestos (token, clinica_id, paciente_telefono, paciente_nombre, tipo, items, total, clinica_datos)
SELECT
  gen_random_uuid()::text,
  $2,
  $1,
  COALESCE((SELECT nombre FROM pacientes WHERE telefono = $1 AND clinica_id = $2), 'Paciente'),
  'cotizacion',
  (SELECT json_agg(json_build_object('nombre', nombre, 'precio', COALESCE(precio, 0))) FROM servicios_req),
  (SELECT COALESCE(SUM(precio), 0) FROM servicios_req),
  (SELECT json_build_object('nombre_clinica', cc.nombre_clinica, 'direccion', cc.direccion, 'telefono', cc.telefono, 'email', cc.email) FROM configuracion_clinica cc WHERE cc.clinica_id = $2)
RETURNING token, total, (SELECT COUNT(*) FROM servicios_req)::int as items_count`,
        options: {
          toolDescription: 'Genera una cotizacion PDF de servicios especificos (sin necesidad de tener citas). Usar cuando el paciente quiere saber precios de varios servicios en PDF. Ej: "pasame cotizacion de limpieza y ortodoncia". El parametro $3 son los nombres de servicios separados por coma. Devuelve token y total en guaranies.'
        }
      }
    }
  ];

  // Agregar nuevos tools
  for (const node of newTools) {
    const existing = workflow.nodes.findIndex(n => n.name === node.name);
    if (existing >= 0) {
      console.log(`  Nodo "${node.name}" ya existe, actualizando...`);
      workflow.nodes[existing] = node;
    } else {
      console.log(`  Agregando nodo "${node.name}"`);
      workflow.nodes.push(node);
    }
  }

  // Conexiones ai_tool -> AI Agent
  for (const node of newTools) {
    if (!workflow.connections[node.name]) {
      workflow.connections[node.name] = {};
    }
    workflow.connections[node.name].ai_tool = [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]];
    console.log(`  Conexión: ${node.name} -> AI Agent (ai_tool)`);
  }

  // --- 3. AGREGAR NODO "Detectar Presupuesto" (Code) ---
  // Después del Guardrails de salida, detecta si se generó un presupuesto
  // y llama al endpoint HTTP para generar y enviar el PDF
  const detectNode = {
    id: 'detect-presupuesto',
    name: 'Enviar Presupuesto PDF',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2100, 680],
    parameters: {
      jsCode: `// Buscar si el agente generó un presupuesto (mirando tool calls del agente)
const agentOutput = $input.first().json;
const outputText = agentOutput?.output || agentOutput?.text || '';

// Buscar token de presupuesto en los steps/tool outputs del agente
const steps = agentOutput?.steps || [];
let presupuestoToken = null;
let presupuestoTotal = null;

for (const step of steps) {
  const obs = step?.observation || step?.result || '';
  if (typeof obs === 'string' && obs.includes('"token"')) {
    try {
      const parsed = JSON.parse(obs);
      if (parsed?.token) {
        presupuestoToken = parsed.token;
        presupuestoTotal = parsed.total;
      }
    } catch(e) {
      // Try to extract token with regex
      const match = obs.match(/"token"\\s*:\\s*"([^"]+)"/);
      if (match) presupuestoToken = match[1];
    }
  }
}

// También buscar en el output del agente si mencionó un link de presupuesto
if (!presupuestoToken && outputText.includes('/presupuesto/')) {
  const match = outputText.match(/\\/presupuesto\\/([a-f0-9-]+)/);
  if (match) presupuestoToken = match[1];
}

if (presupuestoToken) {
  // Llamar al endpoint para generar y enviar el PDF por WhatsApp
  const panelUrl = '${PANEL_URL}';
  const instanceName = $('Preparar Datos').first().json.instanceName;
  const phoneNumber = $('Preparar Datos').first().json.phoneNumber;

  try {
    const response = await fetch(panelUrl + '/api/bot/presupuesto/enviar-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: presupuestoToken, instance: instanceName, telefono_paciente: phoneNumber })
    });
    const result = await response.json();
    return [{ json: { presupuestoEnviado: true, token: presupuestoToken, total: presupuestoTotal, ...result } }];
  } catch(e) {
    return [{ json: { presupuestoEnviado: false, error: e.message, token: presupuestoToken } }];
  }
} else {
  return [{ json: { presupuestoEnviado: false, noPresupuesto: true } }];
}
`
    }
  };

  // Agregar o actualizar el nodo
  const existingDetect = workflow.nodes.findIndex(n => n.name === 'Enviar Presupuesto PDF');
  if (existingDetect >= 0) {
    console.log('  Nodo "Enviar Presupuesto PDF" ya existe, actualizando...');
    workflow.nodes[existingDetect] = detectNode;
  } else {
    console.log('  Agregando nodo "Enviar Presupuesto PDF"');
    workflow.nodes.push(detectNode);
  }

  // Conectar: Detectar Escalación -> Enviar Presupuesto PDF (en paralelo con ¿Se Escaló?)
  // El nodo "Detectar Escalación" ya está conectado a "¿Se Escaló?"
  // Agregamos una segunda salida hacia nuestro nodo
  const detectEscNode = workflow.connections['Detectar Escalación'];
  if (detectEscNode?.main) {
    // Verificar si ya está conectado
    const alreadyConnected = detectEscNode.main[0]?.some(c => c.node === 'Enviar Presupuesto PDF');
    if (!alreadyConnected) {
      detectEscNode.main[0].push({ node: 'Enviar Presupuesto PDF', type: 'main', index: 0 });
      console.log('  Conexión: Detectar Escalación -> Enviar Presupuesto PDF');
    }
  }

  // --- 4. ACTUALIZAR SYSTEM PROMPT ---
  const agent = workflow.nodes.find(n => n.name === 'AI Agent');
  if (agent) {
    // Primero eliminar instrucciones viejas de presupuesto si existen
    let currentPrompt = agent.parameters.options?.systemMessage || '';
    const presupIdx = currentPrompt.indexOf('\n\n# PRESUPUESTOS Y COTIZACIONES');
    if (presupIdx > -1) {
      currentPrompt = currentPrompt.substring(0, presupIdx);
    }

    const presupuestoInstructions = `

# PRESUPUESTOS Y COTIZACIONES PDF

## Herramientas disponibles:
- Generar Presupuesto DB: Genera un presupuesto con las citas agendadas del paciente. El PDF se enviara automaticamente por WhatsApp.
- Generar Cotizacion DB: Genera una cotizacion de servicios especificos. El PDF se enviara automaticamente por WhatsApp.

## Cuando usar cada herramienta:
- Si el paciente dice "quiero un presupuesto de mis citas" o "cuanto me salen mis citas agendadas" → Usa Generar Presupuesto DB con telefono_paciente y clinica_id
- Si el paciente dice "cuanto sale limpieza + ortodoncia en PDF" o "pasame precios de..." o "quiero una cotizacion" → Usa Generar Cotizacion DB. El parametro $3 son los nombres separados por coma (ej: "Limpieza dental,Ortodoncia")
- Si el paciente solo pregunta el precio de UN servicio → NO generes PDF, solo respondele con el precio de la tabla de servicios
- Si el paciente pide "presupuesto" sin especificar, preguntale: "Queres el presupuesto de tus citas agendadas o una cotizacion de servicios especificos?"

## Flujo:
1. SIEMPRE busca primero al paciente con Buscar Paciente DB
2. Llama la herramienta correspondiente
3. La herramienta devuelve un token y total. Usa el token para armar el link de descarga: ${PANEL_URL}/presupuesto/{token}
4. El PDF se envia AUTOMATICAMENTE por WhatsApp.

## Formato de respuesta al paciente:
"Listo! Ya te envie el presupuesto por WhatsApp 📄
💰 Total: Gs. X.XXX.XXX
🔗 Tambien podes descargarlo aca: ${PANEL_URL}/presupuesto/{token}
El presupuesto es valido por 30 dias."`;

    agent.parameters.options.systemMessage = currentPrompt + presupuestoInstructions;
    console.log('  System prompt actualizado con instrucciones de presupuesto');
  }

  // --- 5. ACTUALIZAR SQL DE GUARDAR CITA DB ---
  const guardarCita = workflow.nodes.find(n => n.name === 'Guardar Cita DB');
  if (guardarCita) {
    const oldSQL = guardarCita.parameters.query;
    if (!oldSQL.includes('precio')) {
      guardarCita.parameters.query = `INSERT INTO citas (paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas, clinica_id, precio) VALUES ($1, $2, LEFT($3, 10)::date, LEFT($4, 5)::time, $5, 'Pendiente', '', $6, (SELECT (s->>'precio')::integer FROM configuracion_clinica cc, jsonb_array_elements(cc.servicios) s WHERE cc.clinica_id = $6 AND LOWER(TRIM(s->>'nombre')) = LOWER(TRIM($5)) LIMIT 1)) RETURNING *`;
      console.log('  SQL de Guardar Cita DB actualizado con precio automatico');
    } else {
      console.log('  SQL de Guardar Cita DB ya tiene precio');
    }
  }

  // --- 6. SUBIR WORKFLOW ACTUALIZADO ---
  console.log('\nSubiendo workflow actualizado...');
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
  };

  const updateRes = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (updateRes.ok) {
    const updated = await updateRes.json();
    console.log(`\n✅ Workflow actualizado: ${updated.name} (${updated.nodes.length} nodos)`);
  } else {
    const err = await updateRes.text();
    console.error(`\n❌ Error: ${updateRes.status} ${err}`);
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
