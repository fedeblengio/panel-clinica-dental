const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDY4MTYzNy1hNGM5LTQwNmItOGRkNy00ZTJiZTliMzg2MGMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0MDQ0Mzk5fQ.AJ2ZfSKWHkeD8BOWgWMeO7WhNhUCatU-PXJDlAeOtZs';
const N8N_URL = 'https://humberto-proyect-n8n.jxugns.easypanel.host';
const WORKFLOW_ID = 'kLpuSxhruNC5Ycas';

async function run() {
  // Start from the ORIGINAL workflow we saved at the beginning
  const original = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, 'wf_v4_recepcionista.json'), 'utf8'));

  console.log('Starting from original workflow with', original.nodes.length, 'nodes');

  // === CHANGE 1: Add "Validar Instance Name" node ===
  const validarNode = {
    parameters: {
      jsCode: `const instanceRaw = $('Webhook Evolution API').first().json.body.instance || '';
const instanceName = instanceRaw.replace(/[^a-zA-Z0-9_-]/g, '');
if (!instanceName) {
  throw new Error('Instance name invalido o vacio');
}
return [{ json: { instanceName } }];`
    },
    id: 'validar-instance-001',
    name: 'Validar Instance Name',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-3232, 2800]
  };
  original.nodes.push(validarNode);

  // Update connections: Webhook -> [Solo Chats Privados, Validar Instance Name]
  original.connections['Webhook Evolution API'].main[0] =
    original.connections['Webhook Evolution API'].main[0].filter(c => c.node !== 'Leer Config Panel');
  original.connections['Webhook Evolution API'].main[0].push({
    node: 'Validar Instance Name', type: 'main', index: 0
  });
  original.connections['Validar Instance Name'] = {
    main: [[{ node: 'Leer Config Panel', type: 'main', index: 0 }]]
  };
  console.log('Added Validar Instance Name node');

  // === CHANGE 2: Update Leer Config Panel query ===
  const leerConfig = original.nodes.find(n => n.name === 'Leer Config Panel');
  leerConfig.parameters.query = `SELECT cc.nombre_clinica, cc.direccion, cc.telefono, cc.email, cc.nombre_bot, cc.horarios, cc.servicios, cc.mensaje_bienvenida, cc.prompt_sistema, c.id as clinica_id, c.instance_name
FROM configuracion_clinica cc
JOIN clinicas c ON cc.clinica_id = c.id
WHERE c.instance_name = '{{ $('Validar Instance Name').item.json.instanceName }}'
LIMIT 1`;
  console.log('Updated Leer Config Panel query');

  // === CHANGE 3: Update Preparar Datos - add clinicaId ===
  const prepDatos = original.nodes.find(n => n.name === 'Preparar Datos');
  let code = prepDatos.parameters.jsCode;
  code = code.replace(
    "mensajeBienvenida: configPanel.mensaje_bienvenida || ''",
    "mensajeBienvenida: configPanel.mensaje_bienvenida || '',\n    clinicaId: configPanel.clinica_id || null"
  );
  prepDatos.parameters.jsCode = code;
  console.log('Updated Preparar Datos with clinicaId');

  // === CHANGE 4: Update Evolution API nodes - dynamic instanceName ===
  // KEEP the original node type (n8n-nodes-evolution-api.evolutionApi)
  // Just change the instanceName to dynamic
  ['Enviar texto', 'Enviar texto1', 'Obter media em base64', 'Resp Tipo No Soportado'].forEach(name => {
    const node = original.nodes.find(n => n.name === name);
    if (node) {
      node.parameters.instanceName = `={{ $('Preparar Datos').item.json.instanceName }}`;
      console.log(`Updated ${name} instanceName to dynamic (keeping Evolution API node)`);
    }
  });

  // === CHANGE 5: Update Postgres Tool queries with clinica_id ===
  const buscarPaciente = original.nodes.find(n => n.name === 'Buscar Paciente DB');
  buscarPaciente.parameters.query = `SELECT * FROM pacientes WHERE telefono = '{{ $fromAI("telefono", "Numero de telefono del paciente") }}' AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }}`;

  const registrarPaciente = original.nodes.find(n => n.name === 'Registrar Paciente DB');
  registrarPaciente.parameters.query = `INSERT INTO pacientes (telefono, nombre, email, fecha_nacimiento, notas, clinica_id) VALUES ('{{ $fromAI("telefono", "Telefono obligatorio") }}', '{{ $fromAI("nombre", "Nombre obligatorio") }}', NULLIF('{{ $fromAI("email", "Email opcional") }}', ''), NULLIF('{{ $fromAI("fecha_nacimiento", "Fecha YYYY-MM-DD opcional") }}', '')::date, NULLIF('{{ $fromAI("notas", "Notas opcional") }}', ''), {{ $('Preparar Datos').item.json.clinicaId }}) RETURNING *`;

  const buscarCita = original.nodes.find(n => n.name === 'Buscar Cita DB');
  buscarCita.parameters.query = `SELECT id, event_id_google, paciente_telefono, paciente_nombre, fecha_cita::text, hora_cita::text, tipo_cita, estado, notas FROM citas WHERE paciente_telefono = '{{ $fromAI("telefono", "Telefono del paciente") }}' AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }} ORDER BY fecha_cita DESC, hora_cita DESC`;

  const guardarCita = original.nodes.find(n => n.name === 'Guardar Cita DB');
  guardarCita.parameters.query = `INSERT INTO citas (event_id_google, paciente_telefono, paciente_nombre, fecha_cita, hora_cita, tipo_cita, estado, notas, clinica_id) VALUES ('{{ $fromAI("event_id_google", "ID evento Google Calendar") }}', '{{ $fromAI("paciente_telefono", "Telefono") }}', '{{ $fromAI("paciente_nombre", "Nombre") }}', LEFT('{{ $fromAI("fecha_cita", "Fecha YYYY-MM-DD") }}', 10)::date, LEFT('{{ $fromAI("hora_cita", "Hora HH:MM") }}', 5)::time, '{{ $fromAI("tipo_cita", "Tipo de cita") }}', 'Pendiente', NULLIF('{{ $fromAI("notas", "Notas opcional") }}', ''), {{ $('Preparar Datos').item.json.clinicaId }}) RETURNING *`;

  const actualizarEstado = original.nodes.find(n => n.name === 'Actualizar Estado Cita DB');
  actualizarEstado.parameters.query = `UPDATE citas SET estado = '{{ $fromAI("nuevo_estado", "Estado: Confirmada, Modificada, Cancelada o Completada") }}' WHERE event_id_google = '{{ $fromAI("event_id_google", "ID evento Google Calendar") }}' AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }} RETURNING id, event_id_google, estado`;

  const modificarCita = original.nodes.find(n => n.name === 'Modificar Cita DB');
  modificarCita.parameters.query = `UPDATE citas SET fecha_cita = LEFT('{{ $fromAI("fecha_cita", "Nueva fecha YYYY-MM-DD") }}', 10)::date, hora_cita = LEFT('{{ $fromAI("hora_cita", "Nueva hora HH:MM") }}', 5)::time, estado = 'Modificada' WHERE event_id_google = '{{ $fromAI("event_id_google", "ID evento Google Calendar") }}' AND clinica_id = {{ $('Preparar Datos').item.json.clinicaId }} RETURNING id, event_id_google, fecha_cita::text, hora_cita::text, estado`;

  console.log('Updated 6 Postgres Tool queries with clinica_id');

  // === CHANGE 6: Update Memoria sessionKey ===
  const memoria = original.nodes.find(n => n.name.includes('Memoria'));
  memoria.parameters.sessionKey = `={{ $('Preparar Datos').item.json.instanceName }}_{{ $('Preparar Datos').item.json.sessionId }}`;
  console.log('Updated Memoria sessionKey');

  // === PUSH TO N8N ===
  const updateRes = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      nodes: original.nodes,
      connections: original.connections,
      name: original.name,
      settings: original.settings || {}
    })
  });

  const result = await updateRes.json();
  if (updateRes.ok) {
    console.log('\nSUCCESS: Workflow restored cleanly');
    console.log('Total nodes:', result.nodes.length, '(original was 33, +1 Validar = 34)');

    // Verify Evolution API nodes are back
    const evoNodes = result.nodes.filter(n => n.type.includes('evolution'));
    console.log('Evolution API nodes:', evoNodes.map(n => n.name).join(', '));
  } else {
    console.error('ERROR:', JSON.stringify(result).substring(0, 500));
  }
}

run().catch(e => console.error(e));
