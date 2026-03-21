const fs = require('fs');
const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZDY4MTYzNy1hNGM5LTQwNmItOGRkNy00ZTJiZTliMzg2MGMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0MDQ0Mzk5fQ.AJ2ZfSKWHkeD8BOWgWMeO7WhNhUCatU-PXJDlAeOtZs';
const execId = process.argv[2] || '1009';

async function check() {
  const res = await fetch(`https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1/executions/${execId}`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const d = await res.json();
  const raw = JSON.stringify(d);

  // Find all instanceName values
  const matches = raw.match(/instanceName":"[^"]+"/g) || [];
  console.log('instanceName values found:');
  [...new Set(matches)].forEach(m => console.log(' ', m));

  // Check what Preparar Datos output
  if (d.data && d.data.resultData && d.data.resultData.runData) {
    const prepData = d.data.resultData.runData['Preparar Datos'];
    if (prepData && prepData[0] && prepData[0].data && prepData[0].data.main) {
      const output = prepData[0].data.main[0][0].json;
      console.log('\nPreparar Datos output:');
      console.log('  instanceName:', output.instanceName);
      console.log('  clinicaId:', output.clinicaId);
      console.log('  nombreClinica:', output.nombreClinica);
      console.log('  nombreBot:', output.nombreBot);
    }

    // Check Enviar texto
    const enviarData = d.data.resultData.runData['Enviar texto'];
    if (enviarData && enviarData[0]) {
      if (enviarData[0].error) {
        console.log('\nEnviar texto ERROR:', enviarData[0].error.message);
      }
      if (enviarData[0].data && enviarData[0].data.main) {
        const output = enviarData[0].data.main[0][0].json;
        console.log('\nEnviar texto output:', JSON.stringify(output).substring(0, 500));
      }
    }

    // Check Leer Config Panel
    const configData = d.data.resultData.runData['Leer Config Panel'];
    if (configData && configData[0] && configData[0].data && configData[0].data.main) {
      const items = configData[0].data.main[0];
      if (items.length === 0) {
        console.log('\nLeer Config Panel: NO ROWS RETURNED (empty result!)');
      } else {
        const output = items[0].json;
        console.log('\nLeer Config Panel output:');
        console.log('  clinica_id:', output.clinica_id);
        console.log('  instance_name:', output.instance_name);
        console.log('  nombre_clinica:', output.nombre_clinica);
      }
    }

    // Check Validar Instance Name
    const validarData = d.data.resultData.runData['Validar Instance Name'];
    if (validarData && validarData[0] && validarData[0].data && validarData[0].data.main) {
      const output = validarData[0].data.main[0][0].json;
      console.log('\nValidar Instance Name output:', JSON.stringify(output));
    }

    // List all nodes that ran
    console.log('\nNodes that ran:', Object.keys(d.data.resultData.runData).join(', '));
  }
}

check().catch(e => console.error(e));
