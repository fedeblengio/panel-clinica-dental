const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDY4MTYzNy1hNGM5LTQwNmItOGRkNy00ZTJiZTliMzg2MGMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0MDQ0Mzk5fQ.AJ2ZfSKWHkeD8BOWgWMeO7WhNhUCatU-PXJDlAeOtZs';
const N8N_URL = 'https://humberto-proyect-n8n.jxugns.easypanel.host';
const WORKFLOW_ID = 'kLpuSxhruNC5Ycas';

async function run() {
  // 1. Fetch current workflow
  const res = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const data = await res.json();

  // 2. Replace "Enviar texto" community node with HTTP Request node
  const enviarIdx = data.nodes.findIndex(n => n.name === 'Enviar texto');
  const enviarOld = data.nodes[enviarIdx];

  data.nodes[enviarIdx] = {
    parameters: {
      method: 'POST',
      url: `=http://evolution-api:8080/message/sendText/{{ $('Preparar Datos').item.json.instanceName }}`,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'apikey', value: '4831CC95-0BEF-4C7A-B721-903DF586550E' },
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={
  "number": "{{ $('Preparar Datos').item.json.phoneNumber }}",
  "text": "{{ $json.guardrailsInput || $('AI Agent').item.json.output }}"
}`,
      options: {}
    },
    id: enviarOld.id,
    name: 'Enviar texto',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: enviarOld.position,
    onError: 'continueRegularOutput'
  };

  console.log('Replaced "Enviar texto" with HTTP Request node');

  // 3. Also replace "Enviar texto1" (the guardrails rejection message)
  const enviar1Idx = data.nodes.findIndex(n => n.name === 'Enviar texto1');
  const enviar1Old = data.nodes[enviar1Idx];

  data.nodes[enviar1Idx] = {
    parameters: {
      method: 'POST',
      url: `=http://evolution-api:8080/message/sendText/{{ $('Preparar Datos').item.json.instanceName }}`,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'apikey', value: '4831CC95-0BEF-4C7A-B721-903DF586550E' },
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={
  "number": "{{ $('Webhook Evolution API').item.json.body.data.key.remoteJid.replace('@s.whatsapp.net', '') }}",
  "text": "Lo siento. No puedo ayudarte con eso."
}`,
      options: {}
    },
    id: enviar1Old.id,
    name: 'Enviar texto1',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: enviar1Old.position,
    onError: 'continueRegularOutput'
  };

  console.log('Replaced "Enviar texto1" with HTTP Request node');

  // 4. Also replace "Resp Tipo No Soportado"
  const respIdx = data.nodes.findIndex(n => n.name === 'Resp Tipo No Soportado');
  const respOld = data.nodes[respIdx];

  data.nodes[respIdx] = {
    parameters: {
      method: 'POST',
      url: `=http://evolution-api:8080/message/sendText/{{ $('Preparar Datos').item.json.instanceName }}`,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'apikey', value: '4831CC95-0BEF-4C7A-B721-903DF586550E' },
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={
  "number": "{{ $json.phoneNumber }}",
  "text": "{{ $json.message }}"
}`,
      options: {}
    },
    id: respOld.id,
    name: 'Resp Tipo No Soportado',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: respOld.position,
    onError: 'continueRegularOutput'
  };

  console.log('Replaced "Resp Tipo No Soportado" with HTTP Request node');

  // Keep "Obter media em base64" as community node (it's for receiving, not sending)

  // 5. Push update
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
    console.log('Nodes:', result.nodes.length);

    // Verify
    const httpNodes = result.nodes.filter(n => n.name === 'Enviar texto' || n.name === 'Enviar texto1' || n.name === 'Resp Tipo No Soportado');
    httpNodes.forEach(n => {
      console.log(`  ${n.name}: ${n.type} (was evolutionApi, now httpRequest)`);
    });
  } else {
    console.error('ERROR:', JSON.stringify(result));
  }
}

run().catch(e => console.error(e));
