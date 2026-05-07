/**
 * Presupuesto PDF - Enfoque simple con detección por keywords
 *
 * NO usa tools nuevos. El AI Agent incluye etiquetas en su respuesta:
 *   [PRESUPUESTO_CITAS] → presupuesto de citas agendadas
 *   [COTIZACION:Limpieza dental,Ortodoncia] → cotización de servicios
 *
 * Un nodo Code downstream detecta las etiquetas y llama al endpoint HTTP.
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

  // --- 1. ELIMINAR NODOS DE PRESUPUESTO VIEJOS ---
  const oldNames = ['Presupuesto Citas PDF', 'Cotización Servicios PDF', 'Cotizacion Servicios PDF', 'Generar Presupuesto DB', 'Generar Cotizacion DB'];
  workflow.nodes = workflow.nodes.filter(n => {
    if (oldNames.includes(n.name)) {
      console.log(`  Eliminando nodo "${n.name}"`);
      delete workflow.connections[n.name];
      return false;
    }
    return true;
  });

  // --- 2. NODO "Enviar Presupuesto PDF" (Code) ---
  const detectNode = {
    id: 'detect-presupuesto',
    name: 'Enviar Presupuesto PDF',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2100, 680],
    parameters: {
      jsCode: `// Detectar si el agente pidió generar un presupuesto/cotización
const output = $('Guardrails').first().json.guardrailsInput || $('Guardrails').first().json.output || '';
const instanceName = $('Preparar Datos').first().json.instanceName;
const phoneNumber = $('Preparar Datos').first().json.phoneNumber;
const panelUrl = '${PANEL_URL}';

let resultado = { presupuestoEnviado: false };

try {
  if (output.includes('[PRESUPUESTO_CITAS]')) {
    // Presupuesto de citas agendadas
    const response = await fetch(panelUrl + '/api/bot/presupuesto/citas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance: instanceName, telefono_paciente: phoneNumber })
    });
    resultado = await response.json();
    resultado.presupuestoEnviado = true;
    resultado.tipo = 'citas';
  } else {
    // Buscar [COTIZACION:servicio1,servicio2]
    const match = output.match(/\\[COTIZACION:([^\\]]+)\\]/);
    if (match) {
      const servicios = match[1].split(',').map(s => s.trim());
      const response = await fetch(panelUrl + '/api/bot/presupuesto/cotizacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance: instanceName, telefono_paciente: phoneNumber, servicios: servicios })
      });
      resultado = await response.json();
      resultado.presupuestoEnviado = true;
      resultado.tipo = 'cotizacion';
    }
  }
} catch(e) {
  resultado = { presupuestoEnviado: false, error: e.message };
}

return [{ json: resultado }];`
    }
  };

  const existingDetect = workflow.nodes.findIndex(n => n.name === 'Enviar Presupuesto PDF');
  if (existingDetect >= 0) {
    console.log('  Actualizando nodo "Enviar Presupuesto PDF"');
    workflow.nodes[existingDetect] = detectNode;
  } else {
    console.log('  Agregando nodo "Enviar Presupuesto PDF"');
    workflow.nodes.push(detectNode);
  }

  // Conectar: Detectar Escalación -> Enviar Presupuesto PDF
  const detectEscConn = workflow.connections['Detectar Escalación'];
  if (detectEscConn?.main?.[0]) {
    const already = detectEscConn.main[0].some(c => c.node === 'Enviar Presupuesto PDF');
    if (!already) {
      detectEscConn.main[0].push({ node: 'Enviar Presupuesto PDF', type: 'main', index: 0 });
      console.log('  Conexión: Detectar Escalación -> Enviar Presupuesto PDF');
    } else {
      console.log('  Conexión ya existe');
    }
  }

  // --- 3. ACTUALIZAR SYSTEM PROMPT ---
  const agent = workflow.nodes.find(n => n.name === 'AI Agent');
  if (agent) {
    let currentPrompt = agent.parameters.options?.systemMessage || '';
    // Eliminar instrucciones viejas
    const presupIdx = currentPrompt.indexOf('\n\n# PRESUPUESTOS Y COTIZACIONES');
    if (presupIdx > -1) {
      currentPrompt = currentPrompt.substring(0, presupIdx);
    }

    const instrucciones = `

# PRESUPUESTOS Y COTIZACIONES PDF

## Como funciona:
Cuando el paciente pide un presupuesto o cotizacion, vos respondes normalmente Y agregas una etiqueta especial al FINAL de tu mensaje. El sistema detecta la etiqueta y envia el PDF automaticamente por WhatsApp.

## Etiquetas (AGREGAR AL FINAL de tu respuesta, el paciente NO las ve):
- [PRESUPUESTO_CITAS] → para presupuesto de citas agendadas del paciente
- [COTIZACION:servicio1,servicio2] → para cotizacion de servicios especificos (nombres EXACTOS de la tabla de servicios, separados por coma)

## Cuando usar cada etiqueta:
- "quiero un presupuesto de mis citas" / "cuanto me salen mis turnos" → [PRESUPUESTO_CITAS]
- "cuanto sale limpieza y ortodoncia" / "pasame cotizacion" → [COTIZACION:Limpieza dental,ortodoncia]
- Si solo pregunta precio de UN servicio → NO uses etiqueta, respondele con el precio directamente
- Si pide "presupuesto" sin especificar, preguntale si quiere de sus citas agendadas o de servicios especificos

## Ejemplo de respuesta con etiqueta:
"Listo! Ya te estoy enviando el presupuesto por WhatsApp 📄 con los detalles de tus citas. Tambien te va a llegar un link de descarga por si lo necesitas despues. El presupuesto es valido por 30 dias."
[PRESUPUESTO_CITAS]

## Ejemplo cotizacion:
"Dale! Te mando la cotizacion de limpieza dental y ortodoncia por WhatsApp 📄"
[COTIZACION:Limpieza dental,ortodoncia]

## IMPORTANTE:
- La etiqueta va en una linea SEPARADA al final de tu mensaje
- Usa los nombres EXACTOS de los servicios de la tabla
- El PDF se envia automaticamente, NO necesitas hacer nada mas
- SIEMPRE busca al paciente primero con Buscar Paciente DB`;

    agent.parameters.options.systemMessage = currentPrompt + instrucciones;
    console.log('  System prompt actualizado');
  }

  // --- 4. GUARDAR CITA DB (precio) ---
  const guardarCita = workflow.nodes.find(n => n.name === 'Guardar Cita DB');
  if (guardarCita && !guardarCita.parameters.query.includes('precio')) {
    guardarCita.parameters.query = `INSERT INTO citas (paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas, clinica_id, precio) VALUES ($1, $2, LEFT($3, 10)::date, LEFT($4, 5)::time, $5, 'Pendiente', '', $6, (SELECT (s->>'precio')::integer FROM configuracion_clinica cc, jsonb_array_elements(cc.servicios) s WHERE cc.clinica_id = $6 AND LOWER(TRIM(s->>'nombre')) = LOWER(TRIM($5)) LIMIT 1)) RETURNING *`;
    console.log('  SQL Guardar Cita DB actualizado');
  }

  // --- 5. SUBIR ---
  console.log('\nSubiendo...');
  const payload = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings };
  const updateRes = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (updateRes.ok) {
    const u = await updateRes.json();
    console.log(`\n✅ Workflow actualizado: ${u.name} (${u.nodes.length} nodos)`);
  } else {
    console.error(`\n❌ Error: ${updateRes.status} ${await updateRes.text()}`);
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
