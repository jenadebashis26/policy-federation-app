// Ping - /ping
// Faithful port of Ping_Main.json (n8n workflow "Build Response XML" node).
// Seclore's Policy Server calls this first to confirm the ARA is reachable and to learn
// which protocol version and services it supports.

const { extractRequestId } = require('./_lib/xml');

exports.handler = async (event) => {
  const rawXml = event.body || '';
  const requestId = extractRequestId(rawXml);

  const responseXml = `<ara-response-ping type="1">
    <ara-response-header>
        <request-id>${requestId}</request-id>
        <protocol-version>1</protocol-version>
        <status>1</status>
    </ara-response-header>
    <ara-response-details-ping>
        <ara-supported-protocol-versions>
            <protocol-version>1</protocol-version>
        </ara-supported-protocol-versions>
        <ara-supported-services>
            <service-type>1</service-type>
            <service-type>2</service-type>
            <service-type>3</service-type>
            <service-type>4</service-type>
        </ara-supported-services>
    </ara-response-details-ping>
</ara-response-ping>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/xml' },
    body: responseXml
  };
};
