const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDY4MTYzNy1hNGM5LTQwNmItOGRkNy00ZTJiZTliMzg2MGMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0MDQ0Mzk5fQ.AJ2ZfSKWHkeD8BOWgWMeO7WhNhUCatU-PXJDlAeOtZs';
const N8N_URL = 'https://humberto-proyect-n8n.jxugns.easypanel.host';
const WORKFLOW_ID = 'kLpuSxhruNC5Ycas';

async function run() {
  const res = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const data = await res.json();

  // Fix "Enviar texto" - use bodyContentType raw instead of json expression
  const enviar = data.nodes.find(n => n.name === 'Enviar texto');
  enviar.parameters = {
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
    specifyBody: 'string',
    body: `={{ JSON.stringify({ number: $('Preparar Datos').item.json.phoneNumber, text: $json.guardrailsInput || $('AI Agent').item.json.output }) }}`,
    options: {}
  };
  console.log('Fixed Enviar texto');

  // Fix "Enviar texto1"
  const enviar1 = data.nodes.find(n => n.name === 'Enviar texto1');
  enviar1.parameters = {
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
    specifyBody: 'string',
    body: `={{ JSON.stringify({ number: $('Webhook Evolution API').item.json.body.data.key.remoteJid.replace('@s.whatsapp.net', ''), text: "Lo siento. No puedo ayudarte con eso." }) }}`,
    options: {}
  };
  console.log('Fixed Enviar texto1');

  // Fix "Resp Tipo No Soportado"
  const resp = data.nodes.find(n => n.name === 'Resp Tipo No Soportado');
  resp.parameters = {
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
    specifyBody: 'string',
    body: `={{ JSON.stringify({ number: $json.phoneNumber, text: $json.message }) }}`,
    options: {}
  };
  console.log('Fixed Resp Tipo No Soportado');

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
    console.log('\nSUCCESS: Workflow updated with JSON.stringify fix');
  } else {
    console.error('ERROR:', JSON.stringify(result));
  }
}

run().catch(e => console.error(e));
