# Policy Federation Console (Netlify)

Seclore Policy Federation ARA demo server + config/monitor dashboard. Replaces the old
n8n + Cloudflare tunnel + local proxy setup with three Netlify Functions and Netlify
Blobs for storage — no local processes to run, one shared public URL for the team.

## What's here

- `netlify/functions/ping.js` — `/ping`, protocol handshake.
- `netlify/functions/getaccessright.js` — `/getaccessright`, the actual access decision.
  Checks file-level ACLs (`FileExternalRefMapping`, keyed by `<ara-file-details><ext-id>`)
  first, then falls back to folder-level ACLs (`ProdCustMapping`, keyed by
  `<ara-hot-folder-details><ext-id>`). Echoes back the classification from the request.
- `netlify/functions/getfileinformation.js` — `/getfileinformation`, new endpoint (no
  n8n equivalent existed). Echoes back owner + classification from the request, per
  Seclore's documented implementation guidance.
- `netlify/functions/config.js` — `/api/config`, GET/POST the shared ACL + settings
  config (Netlify Blobs). Gated by the `CONFIG_SECRET` env var via `x-api-key` header.
- `netlify/functions/log.js` — `/api/log`, GET/DELETE the live request/response log the
  dashboard's Monitor tab polls. Same gating as config.
- `public/index.html` — the dashboard (Folder Policies, File Policies, Watermark, Live
  Monitor, API Config, Export JSON). Same UI as before, repointed at the endpoints above.

The `ping`/`getaccessright`/`getfileinformation` endpoints themselves are **not** gated —
Seclore's Policy Server calls them directly with no custom auth header, same as before.

## One-time setup

1. `npm install`
2. Push this repo to GitHub, connect it to a new Netlify site (Netlify picks up
   `netlify.toml` automatically — no build command needed, `public/` is the publish dir).
3. In Netlify → Site configuration → Environment variables, add `CONFIG_SECRET` (any
   string your team will use as the shared dashboard API key).
4. Enable Netlify Blobs for the site — it's on by default for new sites; no extra setup.
5. Open the deployed site URL, go to **API Config**, paste in the `CONFIG_SECRET` value,
   click **Save & Start Polling**.

## Pointing Seclore at it

In the Policy Server admin console, set the ARA base URL to your Netlify site's URL, e.g.
`https://your-site.netlify.app`. The three endpoints resolve to:

- `https://your-site.netlify.app/ping`
- `https://your-site.netlify.app/getaccessright`
- `https://your-site.netlify.app/getfileinformation`

## Local development

`netlify dev` runs the functions and dashboard together locally (Netlify Blobs works
against a local emulated store in dev mode, so no separate database is needed to test).

## Config data shape

Unchanged from the original `ProductCustomerMapping.json`:

```json
{
  "ProdCustMapping": { "<hotFolderExtId>": { "<email>": { "acl": 34, "offline": true } } },
  "FileExternalRefMapping": { "<fileExtId>": { "<email>": { "acl": 34, "offline": true } } },
  "watermark": { "lines": ["$USERNAME$", "$USEREMAIL$", "", ""], "font": { "face": "Arial", "bold": false, "italic": false }, "color": "DCDCDC" },
  "noAccessDisplayMessage": "You do not have access to this product.",
  "offlineAccessRight": true
}
```
