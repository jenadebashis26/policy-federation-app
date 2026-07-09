// Shared XML helpers for the ARA functions.
//
// n8n's webhook node auto-parsed incoming XML into a JSON object before handing it to
// the Code nodes. Netlify Functions give us the raw request body instead, so we parse
// it ourselves here and expose the same "dig into a nested object by dotted path" helper
// the original Code nodes relied on.

const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

function parseXml(rawXml) {
  try {
    return parser.parse(rawXml || '') || {};
  } catch (e) {
    return {};
  }
}

// get(obj, 'a.b.c', fallback)
function get(obj, path, fallback) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return fallback;
    cur = cur[p];
  }
  return cur === undefined || cur === null ? fallback : cur;
}

// Last-resort fallback if XML parsing fails outright — mirrors the regex fallback the
// original n8n Code nodes used when the pre-parsed JSON didn't have what they needed.
function extractRequestId(rawXml) {
  const m = rawXml && rawXml.match(/<request-id>([^<]+)<\/request-id>/i);
  return m ? m[1].trim() : '';
}

module.exports = { parseXml, get, extractRequestId };
