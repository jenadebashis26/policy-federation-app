// Config API - /api/config
// Replaces the local n8n-proxy.js's /config endpoint + ProductCustomerMapping.json.
// Gated by a shared secret (CONFIG_SECRET env var) sent as the x-api-key header — this
// is the "API key" the dashboard's API Config panel asks for. The ARA endpoints
// (ping/getaccessright/getfileinformation) are NOT gated; Seclore's Policy Server calls
// those directly with no custom header.

const { getConfig, saveConfig } = require('./_lib/store');

exports.handler = async (event) => {
  const secret = process.env.CONFIG_SECRET;
  const provided = event.headers['x-api-key'] || event.headers['X-Api-Key'];

  if (secret && provided !== secret) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid or missing API key' })
    };
  }

  if (event.httpMethod === 'GET') {
    const config = await getConfig();
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      await saveConfig(body);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
};
