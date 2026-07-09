// GetFileInformation - /getfileinformation
// New endpoint — no n8n workflow existed for this. Built per policy-federation-api.md,
// section 3: PS calls this to retrieve file metadata; the documented implementation
// guidance is to simply echo back the owner and classification details it sent, unless
// your application tracks ownership/classification changes over time. This app doesn't
// (yet), so it echoes.

const { parseXml, get, extractRequestId } = require('./_lib/xml');
const { appendLog } = require('./_lib/store');

exports.handler = async (event) => {
  const rawXml = event.body || '';
  const parsed = parseXml(rawXml);
  const root = parsed['ara-request-get-file-information'] || {};
  const details = root['ara-request-details-get-file-information'] || {};

  const requestId = get(root, 'ara-request-header.request-id', '') || extractRequestId(rawXml);

  const ownerUser = get(details, 'ara-owner-details.ara-user-details', {});
  const classification = details['ara-classification-details'] || {};
  const fileExtId = get(details, 'ara-file-details.ext-id', '');

  const ownerExtId = (ownerUser['ext-id'] || '').toString();
  const ownerRepCode = (ownerUser['rep-code'] || '1').toString();
  const ownerName = (ownerUser['name'] || '').toString();
  const ownerEmail = (ownerUser['email-id'] || '').toString();

  const classificationFsId = (classification['fs-id'] || '1').toString();
  const classificationName = (classification['name'] || 'Unclassified').toString();

  const responseXml = `<ara-response-get-file-information type="3">
    <ara-response-header>
        <request-id>${requestId}</request-id>
        <protocol-version>1</protocol-version>
        <status>1</status>
    </ara-response-header>
    <ara-response-details-get-file-information>
        <ara-owner-details>
            <ara-user-details>
                <ext-id>${ownerExtId}</ext-id>
                <rep-code>${ownerRepCode}</rep-code>
                <name>${ownerName}</name>
                <email-id>${ownerEmail}</email-id>
            </ara-user-details>
        </ara-owner-details>
        <ara-classification-details>
            <fs-id>${classificationFsId}</fs-id>
            <name>${classificationName}</name>
        </ara-classification-details>
    </ara-response-details-get-file-information>
</ara-response-get-file-information>`;

  await appendLog({
    ts: new Date().toISOString(),
    endpoint: 'getfileinformation',
    email: ownerEmail || '—',
    folder: '—',
    fileExtId: fileExtId || '—',
    matchedScope: '',
    acl: '—',
    grant: true,
    offline: null,
    reqXml: rawXml,
    respXml: responseXml
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/xml' },
    body: responseXml
  };
};
