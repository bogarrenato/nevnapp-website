import http from 'node:http';

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const PORT = Number.parseInt(process.env.YOUTUBE_OAUTH_PORT || '53682', 10);
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error('Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET environment variable.');
}

const state = crypto.randomUUID();
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.search = new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline',
  prompt: 'consent',
  state,
}).toString();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', REDIRECT_URI);

    if (url.pathname !== '/oauth2callback') {
      res.writeHead(404).end('Not found');
      return;
    }

    if (url.searchParams.get('state') !== state) {
      res.writeHead(400).end('Invalid OAuth state.');
      return;
    }

    const code = url.searchParams.get('code');
    if (!code) {
      res.writeHead(400).end(`Missing code: ${url.searchParams.get('error') || 'unknown error'}`);
      return;
    }

    const token = await exchangeCode(code);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`
      <!doctype html>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>YouTube OAuth OK</title>
      <body style="font-family: system-ui; padding: 32px;">
        <h1>YouTube authorization done</h1>
        <p>You can close this tab and return to Codex.</p>
      </body>
    `);

    console.log('\nYouTube OAuth sikeres. Ezt tedd GitHub Secretbe:');
    console.log(`YOUTUBE_REFRESH_TOKEN=${token.refresh_token || '<missing refresh token - run again with prompt=consent>'}`);
    console.log('\nNe commitold, ne tedd .env fájlba.');
    server.close();
  } catch (error) {
    res.writeHead(500).end(error instanceof Error ? error.message : String(error));
    server.close();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`YouTube OAuth local callback: ${REDIRECT_URI}`);
  console.log('Nyisd meg ezt a linket, és válaszd ki a YouTube csatornát:');
  console.log(authUrl.toString());
});

async function exchangeCode(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.access_token) {
    const message = payload.error_description || payload.error || response.statusText;
    throw new Error(`YouTube OAuth code exchange failed (${response.status}): ${message}`);
  }

  return payload;
}
