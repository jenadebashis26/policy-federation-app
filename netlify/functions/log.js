// Log API - /api/log
// Replaces n8n's execution-history polling. Each ARA function writes its own request/
// response straight into this log as it handles a call, so the dashboard just reads it
// back directly — no more reconstructing XML out of n8n's internal run-data.
// Gated by the same CONFIG_SECRET shared secret as /api/config.

const { getLog, clearLog } = require('./_lib/store');

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
    const log = await getLog();
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(log) };
  }

  if (event.httpMethod === 'DELETE') {
    await clearLog();
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
};
