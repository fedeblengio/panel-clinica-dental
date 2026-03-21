const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDY4MTYzNy1hNGM5LTQwNmItOGRkNy00ZTJiZTliMzg2MGMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0MDQ0Mzk5fQ.AJ2ZfSKWHkeD8BOWgWMeO7WhNhUCatU-PXJDlAeOtZs';
const N8N_URL = 'https://humberto-proyect-n8n.jxugns.easypanel.host';
const WORKFLOW_ID = 'kLpuSxhruNC5Ycas';

async function run() {
  const res = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const data = await res.json();

  // --- FIX "Enviar texto" ---
  // Add a Code node before it that prepares the body
  const enviar = data.nodes.find(n => n.name === 'Enviar texto');
  const enviarPos = enviar.position;

  // Create "Preparar Envio" code node
  const prepEnvio = {
    parameters: {
      jsCode: `const phoneNumber = $('Preparar Datos').item.json.phoneNumber;
const text = $json.guardrailsInput || $('AI Agent').item.json.output;
const instanceName = $('Preparar Datos').item.json.instanceName;
return [{
  json: {
    instanceName,
    sendBody: { number: phoneNumber, text: text }
  }
}];`
    },
    id: 'prep-envio-001',
    name: 'Preparar Envio',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [enviarPos[0] - 250, enviarPos[1]]
  };
  data.nodes.push(prepEnvio);

  // Update Enviar texto to use the prepared body
  enviar.parameters = {
    method: 'POST',
    url: `=http://evolution-api:8080/message/sendText/{{ $json.instanceName }}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'apikey', value: '4831CC95-0BEF-4C7A-B721-903DF586550E' },
        { name: 'Content-Type', value: 'application/json' }
      ]
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify($json.sendBody) }}`,
    options: {}
  };
  enviar.onError = 'continueRegularOutput';

  // Update connections: Guardrails -> Preparar Envio -> Enviar texto
  // Currently: Guardrails -> Enviar texto
  data.connections['Guardrails'].main[0] = [{ node: 'Preparar Envio', type: 'main', index: 0 }];
  data.connections['Preparar Envio'] = { main: [[{ node: 'Enviar texto', type: 'main', index: 0 }]] };

  console.log('Added Preparar Envio node before Enviar texto');

  // --- FIX "Enviar texto1" ---
  const enviar1 = data.nodes.find(n => n.name === 'Enviar texto1');
  const enviar1Pos = enviar1.position;

  const prepEnvio1 = {
    parameters: {
      jsCode: `const remoteJid = $('Webhook Evolution API').item.json.body.data.key.remoteJid;
const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
const instanceName = $('Preparar Datos').item.json.instanceName;
return [{
  json: {
    instanceName,
    sendBody: { number: phoneNumber, text: "Lo siento. No puedo ayudarte con eso." }
  }
}];`
    },
    id: 'prep-envio1-001',
    name: 'Preparar Envio1',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [enviar1Pos[0] - 250, enviar1Pos[1]]
  };
  data.nodes.push(prepEnvio1);

  enviar1.parameters = {
    method: 'POST',
    url: `=http://evolution-api:8080/message/sendText/{{ $json.instanceName }}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'apikey', value: '4831CC95-0BEF-4C7A-B721-903DF586550E' },
        { name: 'Content-Type', value: 'application/json' }
      ]
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify($json.sendBody) }}`,
    options: {}
  };
  enviar1.onError = 'continueRegularOutput';

  // Find what connects to Enviar texto1 and redirect to Preparar Envio1
  for (const [nodeName, conns] of Object.entries(data.connections)) {
    if (conns.main) {
      conns.main.forEach(outputs => {
        if (outputs) {
          outputs.forEach((conn, idx) => {
            if (conn.node === 'Enviar texto1') {
              outputs[idx] = { node: 'Preparar Envio1', type: 'main', index: 0 };
            }
          });
        }
      });
    }
  }
  data.connections['Preparar Envio1'] = { main: [[{ node: 'Enviar texto1', type: 'main', index: 0 }]] };

  console.log('Added Preparar Envio1 node before Enviar texto1');

  // --- FIX "Resp Tipo No Soportado" ---
  const resp = data.nodes.find(n => n.name === 'Resp Tipo No Soportado');
  const respPos = resp.position;

  const prepResp = {
    parameters: {
      jsCode: `const phoneNumber = $json.phoneNumber;
const message = $json.message;
const instanceName = $('Preparar Datos').item.json.instanceName;
return [{
  json: {
    instanceName,
    sendBody: { number: phoneNumber, text: message }
  }
}];`
    },
    id: 'prep-resp-001',
    name: 'Preparar Resp Envio',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [respPos[0] - 250, respPos[1]]
  };
  data.nodes.push(prepResp);

  resp.parameters = {
    method: 'POST',
    url: `=http://evolution-api:8080/message/sendText/{{ $json.instanceName }}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'apikey', value: '4831CC95-0BEF-4C7A-B721-903DF586550E' },
        { name: 'Content-Type', value: 'application/json' }
      ]
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify($json.sendBody) }}`,
    options: {}
  };
  resp.onError = 'continueRegularOutput';

  // Redirect connections to Resp Tipo No Soportado through Preparar Resp Envio
  for (const [nodeName, conns] of Object.entries(data.connections)) {
    if (nodeName === 'Preparar Resp Envio') continue;
    if (conns.main) {
      conns.main.forEach(outputs => {
        if (outputs) {
          outputs.forEach((conn, idx) => {
            if (conn.node === 'Resp Tipo No Soportado') {
              outputs[idx] = { node: 'Preparar Resp Envio', type: 'main', index: 0 };
            }
          });
        }
      });
    }
  }
  data.connections['Preparar Resp Envio'] = { main: [[{ node: 'Resp Tipo No Soportado', type: 'main', index: 0 }]] };

  console.log('Added Preparar Resp Envio node before Resp Tipo No Soportado');

  // Push
  const updateRes = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      nodes: data.nodes,
      connections: data.connections,
      name: data.name,
      settings: data.settings || {}
    })
  });

  const result = await updateRes.json();
  if (updateRes.ok) {
    console.log('\nSUCCESS: Workflow updated');
    console.log('Total nodes:', result.nodes.length);
  } else {
    console.error('ERROR:', JSON.stringify(result).substring(0, 500));
  }
}

run().catch(e => console.error(e));
