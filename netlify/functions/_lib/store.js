// Netlify Blobs-backed replacement for ProductCustomerMapping.json + the local proxy.
//
// One shared team instance -> one config blob, one log blob. Config shape is unchanged
// from the original file so the dashboard's existing data model still applies:
//   { ProdCustMapping, FileExternalRefMapping, watermark, noAccessDisplayMessage, offlineAccessRight }

const { getStore } = require('@netlify/blobs');

const CONFIG_KEY = 'config.json';
const LOG_KEY = 'log.json';
const MAX_LOG_ENTRIES = 50;

// getStore() is supposed to auto-detect the site/token when running inside a Netlify
// Function, but that auto-detection doesn't always kick in (seen in practice with
// classic exports.handler-style functions). Falling back to explicit siteID/token from
// env vars, per Netlify's own documented manual-configuration path, makes this work
// regardless. NETLIFY_BLOBS_SITE_ID / NETLIFY_BLOBS_TOKEN are set on the Netlify site
// (not auto-provided) — see README for how to get them.
function manualOpts() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  return siteID && token ? { siteID, token } : {};
}

function configStore() {
  return getStore(Object.assign({ name: 'policy-federation-config' }, manualOpts()));
}

function logStore() {
  return getStore(Object.assign({ name: 'policy-federation-log' }, manualOpts()));
}

const DEFAULT_CONFIG = {
  ProdCustMapping: {},
  FileExternalRefMapping: {},
  watermark: {
    lines: ['$USERNAME$', '$USEREMAIL$', '', ''],
    font: { face: 'Arial', bold: false, italic: false },
    color: 'DCDCDC'
  },
  noAccessDisplayMessage: 'You do not have access to this product.',
  offlineAccessRight: true
};

async function getConfig() {
  const store = configStore();
  const raw = await store.get(CONFIG_KEY, { type: 'json' });
  return raw || DEFAULT_CONFIG;
}

async function saveConfig(cfg) {
  const store = configStore();
  await store.setJSON(CONFIG_KEY, cfg);
}

async function getLog() {
  const store = logStore();
  return (await store.get(LOG_KEY, { type: 'json' })) || [];
}

async function appendLog(entry) {
  const store = logStore();
  const existing = (await store.get(LOG_KEY, { type: 'json' })) || [];
  entry.id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  existing.unshift(entry);
  if (existing.length > MAX_LOG_ENTRIES) existing.length = MAX_LOG_ENTRIES;
  await store.setJSON(LOG_KEY, existing);
}

async function clearLog() {
  const store = logStore();
  await store.setJSON(LOG_KEY, []);
}

module.exports = { getConfig, saveConfig, getLog, appendLog, clearLog };
