/**
 * Script para agregar herramientas de Presupuesto PDF al workflow Recepcionista v4
 *
 * Cambios:
 * 1. Agrega 2 tool nodes: "Presupuesto Citas PDF" y "Cotización Servicios PDF"
 * 2. Actualiza el system prompt del AI Agent con instrucciones de presupuesto
 * 3. Actualiza el SQL de "Guardar Cita DB" para incluir precio automático
 *
 * Ejecutar: node scripts/update_presupuesto_wf.js
 */

const N8N_URL = 'https://humberto-proyect-n8n.jxugns.easypanel.host';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDY4MTYzNy1hNGM5LTQwNmItOGRkNy00ZTJiZTliMzg2MGMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0MDQ0Mzk5fQ.AJ2ZfSKWHkeD8BOWgWMeO7WhNhUCatU-PXJDlAeOtZs';
const WF_ID = 'kLpuSxhruNC5Ycas';

// URL del panel (donde están los endpoints de presupuesto)
const PANEL_URL = process.env.PANEL_URL || 'https://humberto-proyect-pagina-web-clinica-dental.jxugns.easypanel.host';

async function main() {
  console.log('Descargando workflow...');
  const res = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const workflow = await res.json();
  console.log(`Workflow: ${workflow.name} (${workflow.nodes.length} nodos)`);

  // --- 1. AGREGAR TOOL NODES ---

  // Posiciones (cerca de las otras tools del agente)
  const newNodes = [
    {
      id: 'tool-presupuesto-citas',
      name: 'Presupuesto Citas PDF',
      type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
      typeVersion: 1.1,
      position: [464, 3900],
      parameters: {
        method: 'POST',
        url: `${PANEL_URL}/api/bot/presupuesto/citas`,
        authentication: 'none',
        sendBody: true,
        specifyBody: 'keypair',
        parametersBody: {
          values: [
            { name: 'instance', valueProvider: 'fieldValue', value: `={{ $('Preparar Datos').item.json.instanceName }}` },
            { name: 'telefono_paciente', valueProvider: 'modelRequired' }
          ]
        },
        toolDescription: 'Genera un PDF de presupuesto con todas las citas agendadas (pendientes/confirmadas) del paciente y lo envia automaticamente por WhatsApp. Usar cuando el paciente dice: "quiero un presupuesto", "cuanto me salen mis citas", "mandame el presupuesto de mis turnos". El parametro telefono_paciente es el telefono del paciente sin @s.whatsapp.net. Devuelve download_url (link de descarga) y total en guaranies.',
        optimizeResponse: false,
        placeholderDefinitions: {
          values: [
            { name: 'telefono_paciente', description: 'Telefono del paciente sin @s.whatsapp.net, ej: 595981123456', type: 'string' }
          ]
        }
      }
    },
    {
      id: 'tool-cotizacion-pdf',
      name: 'Cotizacion Servicios PDF',
      type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
      typeVersion: 1.1,
      position: [464, 4100],
      parameters: {
        method: 'POST',
        url: `${PANEL_URL}/api/bot/presupuesto/cotizacion`,
        authentication: 'none',
        sendBody: true,
        specifyBody: 'keypair',
        parametersBody: {
          values: [
            { name: 'instance', valueProvider: 'fieldValue', value: `={{ $('Preparar Datos').item.json.instanceName }}` },
            { name: 'telefono_paciente', valueProvider: 'modelRequired' },
            { name: 'servicios', valueProvider: 'modelRequired' }
          ]
        },
        toolDescription: 'Genera un PDF de cotizacion con servicios especificos (sin necesidad de tener citas agendadas) y lo envia automaticamente por WhatsApp. Usar cuando el paciente pregunta precios de varios servicios y quiere un documento. Ej: "pasame precios de limpieza y ortodoncia en PDF", "quiero una cotizacion". El parametro servicios es un array JSON de nombres, ej: ["Limpieza dental", "Ortodoncia"]. Devuelve download_url y total en guaranies.',
        optimizeResponse: false,
        placeholderDefinitions: {
          values: [
            { name: 'telefono_paciente', description: 'Telefono del paciente sin @s.whatsapp.net, ej: 595981123456', type: 'string' },
            { name: 'servicios', description: 'Array JSON de nombres de servicios solicitados, ej: ["Limpieza dental", "Ortodoncia"]', type: 'json' }
          ]
        }
      }
    }
  ];

  // Eliminar nodos viejos con tipo incorrecto
  const oldNames = ['Presupuesto Citas PDF', 'Cotización Servicios PDF', 'Cotizacion Servicios PDF'];
  workflow.nodes = workflow.nodes.filter(n => {
    if (oldNames.includes(n.name) && n.type !== '@n8n/n8n-nodes-langchain.toolHttpRequest') {
      console.log(`  Eliminando nodo viejo "${n.name}" (tipo: ${n.type})`);
      delete workflow.connections[n.name];
      return false;
    }
    return true;
  });

  // Agregar nodos al workflow
  for (const node of newNodes) {
    const existing = workflow.nodes.findIndex(n => n.name === node.name);
    if (existing >= 0) {
      console.log(`  Nodo "${node.name}" ya existe, actualizando...`);
      workflow.nodes[existing] = node;
    } else {
      console.log(`  Agregando nodo "${node.name}"`);
      workflow.nodes.push(node);
    }
  }

  // Agregar conexiones ai_tool -> AI Agent
  for (const node of newNodes) {
    if (!workflow.connections[node.name]) {
      workflow.connections[node.name] = {};
    }
    workflow.connections[node.name].ai_tool = [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]];
    console.log(`  Conexión: ${node.name} -> AI Agent (ai_tool)`);
  }

  // --- 2. ACTUALIZAR SYSTEM PROMPT ---
  const agent = workflow.nodes.find(n => n.name === 'AI Agent');
  if (agent) {
    const presupuestoInstructions = `

# PRESUPUESTOS Y COTIZACIONES PDF

## Herramientas disponibles:
- Presupuesto Citas PDF: Genera un PDF con el presupuesto de las citas agendadas del paciente (pendientes/confirmadas). El PDF se envía automáticamente por WhatsApp.
- Cotización Servicios PDF: Genera un PDF de cotización con servicios específicos que el paciente consulta. El PDF se envía automáticamente por WhatsApp.

## Cuándo usar cada herramienta:
- Si el paciente dice "quiero un presupuesto de mis citas" o "cuánto me salen mis citas agendadas" → Usa Presupuesto Citas PDF
- Si el paciente dice "cuánto sale limpieza + ortodoncia en PDF" o "pasame precios de..." o "quiero una cotización" → Usa Cotización Servicios PDF
- Si el paciente solo pregunta el precio de UN servicio → NO generes PDF, solo respondele con el precio de la tabla de servicios
- Si el paciente pide "presupuesto" sin especificar, preguntale: "¿Querés el presupuesto de tus citas agendadas o una cotización de servicios específicos?"

## Flujo:
1. SIEMPRE buscá primero al paciente con Buscar Paciente DB
2. Para Presupuesto Citas: Buscá con Buscar Cita DB primero para verificar que tiene citas pendientes. Si no tiene, decile que no hay citas agendadas.
3. Para Cotización: Verificá que los servicios existan en la tabla de servicios antes de llamar la herramienta.
4. Llamá la herramienta correspondiente
5. El PDF se envía AUTOMÁTICAMENTE por WhatsApp. Respondele al paciente con el link de descarga.

## Formato de respuesta al paciente:
"¡Listo! Ya te envié el presupuesto por WhatsApp 📄
💰 Total: Gs. X.XXX.XXX
🔗 También podés descargarlo acá: [download_url]
El presupuesto es válido por 30 días."`;

    // Agregar al final del systemMessage
    const currentPrompt = agent.parameters.options?.systemMessage || '';
    if (!currentPrompt.includes('PRESUPUESTOS Y COTIZACIONES')) {
      agent.parameters.options.systemMessage = currentPrompt + presupuestoInstructions;
      console.log('  System prompt actualizado con instrucciones de presupuesto');
    } else {
      console.log('  System prompt ya tiene instrucciones de presupuesto');
    }
  }

  // --- 3. ACTUALIZAR SQL DE GUARDAR CITA DB ---
  const guardarCita = workflow.nodes.find(n => n.name === 'Guardar Cita DB');
  if (guardarCita) {
    const oldSQL = guardarCita.parameters.query;
    if (!oldSQL.includes('precio')) {
      guardarCita.parameters.query = `INSERT INTO citas (paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas, clinica_id, precio) VALUES ($1, $2, LEFT($3, 10)::date, LEFT($4, 5)::time, $5, 'Pendiente', '', $6, (SELECT (s->>'precio')::integer FROM configuracion_clinica cc, jsonb_array_elements(cc.servicios) s WHERE cc.clinica_id = $6 AND LOWER(TRIM(s->>'nombre')) = LOWER(TRIM($5)) LIMIT 1)) RETURNING *`;
      console.log('  SQL de Guardar Cita DB actualizado con precio automático');
    } else {
      console.log('  SQL de Guardar Cita DB ya tiene precio');
    }
  }

  // --- 4. SUBIR WORKFLOW ACTUALIZADO ---
  console.log('\nSubiendo workflow actualizado...');

  // Solo enviar los campos que acepta el API
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
  };

  const updateRes = await fetch(`${N8N_URL}/api/v1/workflows/${WF_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (updateRes.ok) {
    const updated = await updateRes.json();
    console.log(`\n✅ Workflow actualizado exitosamente: ${updated.name} (${updated.nodes.length} nodos)`);
  } else {
    const err = await updateRes.text();
    console.error(`\n❌ Error al actualizar: ${updateRes.status} ${err}`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
