const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDY4MTYzNy1hNGM5LTQwNmItOGRkNy00ZTJiZTliMzg2MGMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0MDQ0Mzk5fQ.AJ2ZfSKWHkeD8BOWgWMeO7WhNhUCatU-PXJDlAeOtZs';
const N8N_URL = 'https://humberto-proyect-n8n.jxugns.easypanel.host';
const WORKFLOW_ID = 'kLpuSxhruNC5Ycas';

async function run() {
  // 1. Fetch current workflow
  const res = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const data = await res.json();

  // 2. Change Enviar texto instanceName to hardcoded value
  const enviar = data.nodes.find(n => n.name === 'Enviar texto');
  console.log('BEFORE - Enviar texto instanceName:', enviar.parameters.instanceName);
  enviar.parameters.instanceName = '=bot-clinica-sonrisa';
  console.log('AFTER  - Enviar texto instanceName:', enviar.parameters.instanceName);

  // 3. Push update
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
    console.log('SUCCESS: Workflow updated with hardcoded instanceName');
    console.log('Ahora manda un mensaje de prueba al WhatsApp de tu amigo');
  } else {
    console.error('ERROR:', JSON.stringify(result));
  }
}

run().catch(e => console.error(e));
