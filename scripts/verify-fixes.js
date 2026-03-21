const API_BASE = 'https://humberto-proyect-n8n.jxugns.easypanel.host/api/v1';
const API_KEY = process.env.N8N_API_KEY;

async function main() {
  const res = await fetch(`${API_BASE}/workflows/kLpuSxhruNC5Ycas`, {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  const w = await res.json();

  console.log('=== VERIFICATION ===');
  console.log('Total nodes:', w.nodes.length);

  // 1. SQL Injection
  const bp = w.nodes.find(n => n.id === 'tool-bp-v4b');
  console.log('1. SQL sanitized:', bp.parameters.query.includes('regexp_replace') ? 'OK' : 'FAIL');

  // 2. Calendar disabled
  const calNodes = w.nodes.filter(n => n.name.includes('Calendar'));
  const allCalDisabled = calNodes.every(n => n.disabled === true);
  console.log('2. Calendar disabled (' + calNodes.length + ' nodes):', allCalDisabled ? 'OK' : 'FAIL');

  // 3. New DB availability tool
  const dispDb = w.nodes.find(n => n.id === 'tool-disp-db-v4');
  const dispConnected = w.connections['Ver Disponibilidad DB'] != null;
  console.log('3. Ver Disponibilidad DB added:', dispDb ? 'OK' : 'FAIL');
  console.log('   Connected to AI Agent:', dispConnected ? 'OK' : 'FAIL');

  // 4. System prompt
  const agent = w.nodes.find(n => n.id === 'agent-v4');
  const prompt = agent.parameters.options.systemMessage;
  console.log('4a. No Google Calendar in prompt:', prompt.includes('Google Calendar') ? 'FAIL' : 'OK');
  console.log('4b. No hardcoded services table:', prompt.includes('| Primera visita | 30 min |') ? 'FAIL' : 'OK');
  console.log('4c. Has Ver Disponibilidad DB:', prompt.includes('Ver Disponibilidad DB') ? 'OK' : 'FAIL');
  console.log('4d. Uses cita id instead of event_id:', prompt.includes('id de la cita') ? 'OK' : 'FAIL');

  // 5. Timezone
  const prep = w.nodes.find(n => n.id === 'code-prep-v4');
  console.log('5a. No hardcoded UTC-3:', prep.parameters.jsCode.includes('paraguayOffset = -3') ? 'FAIL' : 'OK');
  console.log('5b. Uses Intl.DateTimeFormat:', prep.parameters.jsCode.includes('Intl.DateTimeFormat') ? 'OK' : 'FAIL');

  // 6. Error handling
  const errIds = ['err-trigger-v4', 'err-format-v4', 'err-email-v4'];
  const errNodes = w.nodes.filter(n => errIds.includes(n.id));
  const errEnabled = errNodes.every(n => n.disabled !== true);
  console.log('6. Error handling enabled (' + errNodes.length + ' nodes):', errEnabled ? 'OK' : 'FAIL');
}

main().catch(err => { console.error(err); process.exit(1); });
