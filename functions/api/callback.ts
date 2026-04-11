export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  const CLIENT_ID = env.WCL_CLIENT_ID;
  const CLIENT_SECRET = env.WCL_CLIENT_SECRET;
  const REDIRECT_URI = url.origin + '/api/callback';

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response('Missing environment variables', { status: 500 });
  }

  // Exchange code for token
  const tokenResponse = await fetch('https://www.warcraftlogs.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    return new Response(`Token exchange failed: ${errorBody}`, { status: 500 });
  }

  const data = await tokenResponse.json() as { access_token: string; expires_in: number };

  // Redirect back to main app with the token
  // For security in production, you'd use a session or secure cookie.
  // For this initial version, we'll pass it back to the client to store in localStorage.
  const redirectUrl = new URL('/', url.origin);
  redirectUrl.searchParams.set('access_token', data.access_token);
  
  return Response.redirect(redirectUrl.toString(), 302);
};

interface Env {
  WCL_CLIENT_ID: string;
  WCL_CLIENT_SECRET: string;
}
