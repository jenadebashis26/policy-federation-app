// GetAccessRight - /getaccessright
// Port of GetAccessRight_Main1 EXT.json (n8n "Parse Request" + "Check ACL & Build Response"
// nodes), with two deliberate changes from the original, both confirmed with DJ:
//   1. The classification block is echoed back from the request instead of being
//      hardcoded to fs-id 1 / "Top Secret".
//   2. File-level ACLs (FileExternalRefMapping, keyed by <ara-file-details><ext-id>) are
//      now actually checked, ahead of the folder-level lookup (ProdCustMapping, keyed by
//      <ara-hot-folder-details><ext-id>) — see policy-federation-api.md, "Key fields to
//      use in your access decision."

const { parseXml, get, extractRequestId } = require('./_lib/xml');
const { getConfig, appendLog } = require('./_lib/store');

function lookup(rules, key, email) {
  if (!key || !rules) return null;
  const rk = Object.keys(rules).find((k) => k.toLowerCase() === key.toLowerCase());
  if (!rk) return null;
  const folderRules = rules[rk] || {};
  const ek = Object.keys(folderRules).find((k) => k.toLowerCase() === email.toLowerCase());
  if (ek === undefined) return null;
  return { entry: folderRules[ek], scope: rk, emailKey: ek };
}

exports.handler = async (event) => {
  const rawXml = event.body || '';
  const parsed = parseXml(rawXml);
  const root = parsed['ara-request-get-access-right'] || {};
  const details = root['ara-request-details-get-access-right'] || {};

  const requestId = get(root, 'ara-request-header.request-id', '') || extractRequestId(rawXml);

  const fileDetails = details['ara-file-details'] || {};
  const hotFolderDetails = details['ara-hot-folder-details'] || {};
  const userDetails = details['ara-user-details'] || {};
  const ownerUser = get(details, 'ara-owner-details.ara-user-details', {});
  const classificationDetails = details['ara-classification-details'] || {};

  const fileExtId = (fileDetails['ext-id'] || '').toString().trim();
  const hotFolderExtId = (hotFolderDetails['ext-id'] || '').toString().trim();
  const requestorEmail = (userDetails['email-id'] || '').toString().trim();

  const ownerRepCode = (ownerUser['rep-code'] || '1').toString();
  const ownerExtId = (ownerUser['ext-id'] || '').toString();
  const ownerEmail = (ownerUser['email-id'] || '').toString();
  const ownerName = (ownerUser['name'] || '').toString();

  const config = await getConfig();

  const wmConfig = config.watermark || {};
  const wmLines = Array.isArray(wmConfig.lines) ? wmConfig.lines : ['$USERNAME$', '$USEREMAIL$', '', ''];
  const wmFont = wmConfig.font || {};
  const wmFace = wmFont.face || 'Arial';
  const wmBold = wmFont.bold === true;
  const wmItalic = wmFont.italic === true;
  const wmColor = wmConfig.color || 'DCDCDC';

  const noAccessMessage = (config.noAccessDisplayMessage || '').trim() || 'You do not have access to this product.';
  const globalOffline = typeof config.offlineAccessRight === 'boolean' ? config.offlineAccessRight : true;

  // File-level lookup takes precedence over folder-level, per DJ's call.
  let hit = fileExtId ? lookup(config.FileExternalRefMapping, fileExtId, requestorEmail) : null;
  let matchedScope = hit ? 'file' : '';
  if (!hit && hotFolderExtId) {
    hit = lookup(config.ProdCustMapping, hotFolderExtId, requestorEmail);
    if (hit) matchedScope = 'folder';
  }

  let matchFound = false;
  let primaryAccessRight = 0;
  let offlineAccessRight = globalOffline;
  let offlineDays; // undefined = unlimited offline access, per-entry override only

  if (hit) {
    const entry = hit.entry;
    const acl = typeof entry === 'object' ? Number(entry.acl) : Number(entry);
    if (!isNaN(acl)) {
      primaryAccessRight = acl;
      matchFound = true;
      const perUserOffline = typeof entry === 'object' ? entry.offline : undefined;
      offlineAccessRight = perUserOffline !== undefined ? perUserOffline : globalOffline;
      if (typeof entry === 'object' && entry.offlineDays !== undefined && entry.offlineDays !== null) {
        const d = Number(entry.offlineDays);
        if (!isNaN(d) && d >= 0) offlineDays = d;
      }
    }
  }

  // date-embargo/end-time per policy-federation-api.md: UTC, yyyy-MM-dd'T'HH:mm:ss.SSSZZZ:ZZ,
  // empty = no expiry. Only set when offline access is actually granted and a duration
  // was configured for the matched entry — otherwise offline access is unlimited.
  let embargoEndTime = '';
  if (offlineAccessRight && offlineDays !== undefined) {
    const end = new Date(Date.now() + offlineDays * 24 * 60 * 60 * 1000);
    embargoEndTime = end.toISOString().replace(/Z$/, '+00:00');
  }

  const watermarkXml = `
        <ara-watermark-details>
            <lines>
                <line>${wmLines[0] || ''}</line>
                <line>${wmLines[1] || ''}</line>
                <line>${wmLines[2] || ''}</line>
                <line>${wmLines[3] || ''}</line>
            </lines>
            <font>
                <face>${wmFace}</face>
                <bold>${wmBold ? 'true' : 'false'}</bold>
                <italic>${wmItalic ? 'true' : 'false'}</italic>
            </font>
            <color>${wmColor}</color>
        </ara-watermark-details>`;

  const ownerBlock = `
        <ara-owner-details>
            <ara-user-details>
                <rep-code>${ownerRepCode}</rep-code>
                <ext-id>${ownerExtId}</ext-id>
                <email-id>${ownerEmail}</email-id>
                <name>${ownerName}</name>
            </ara-user-details>
        </ara-owner-details>`;

  // Echo back the classification actually sent in the request instead of hardcoding it.
  const classificationFsId = (classificationDetails['fs-id'] || '1').toString();
  const classificationName = (classificationDetails['name'] || 'Unclassified').toString();
  const classificationBlock = `
        <ara-classification-details>
            <fs-id>${classificationFsId}</fs-id>
            <name>${classificationName}</name>
        </ara-classification-details>`;

  const displayMessageBlock =
    primaryAccessRight === 0 && noAccessMessage
      ? `\n        <ara-display-message>${noAccessMessage}</ara-display-message>`
      : '';

  const responseXml = `<?xml version="1.0" encoding="utf-8"?>
<ara-response-get-access-right type="2">
    <ara-response-header>
        <request-id>${requestId}</request-id>
        <protocol-version>1</protocol-version>
        <status>1</status>
    </ara-response-header>
    <ara-response-details-get-access-right>
        <ara-access-right-details>
            <primary-access-right>${primaryAccessRight}</primary-access-right>
            <offline-access-right>${offlineAccessRight ? 'true' : 'false'}</offline-access-right>
            <date-embargo>
                <end-time>${embargoEndTime}</end-time>
            </date-embargo>
        </ara-access-right-details>${displayMessageBlock}
${watermarkXml}
        ${ownerBlock}
${classificationBlock}
    </ara-response-details-get-access-right>
</ara-response-get-access-right>`;

  await appendLog({
    ts: new Date().toISOString(),
    endpoint: 'getaccessright',
    email: requestorEmail || '—',
    folder: hotFolderExtId || '—',
    fileExtId: fileExtId || '—',
    matchedScope,
    acl: primaryAccessRight,
    grant: matchFound,
    offline: offlineAccessRight,
    offlineDays: offlineDays !== undefined ? offlineDays : null,
    embargoEndTime: embargoEndTime || null,
    reqXml: rawXml,
    respXml: responseXml
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/xml' },
    body: responseXml
  };
};
