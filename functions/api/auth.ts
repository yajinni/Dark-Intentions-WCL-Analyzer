export const onRequest: PagesFunction<Env> = async (context) => {
  const { env } = context;
  
  const CLIENT_ID = env.WCL_CLIENT_ID;
  const REDIRECT_URI = new URL(context.request.url).origin + '/api/callback';
  
  if (!CLIENT_ID) {
    return new Response('Missing WCL_CLIENT_ID environment variable', { status: 500 });
  }

  const authUrl = new URL('https://www.warcraftlogs.com/oauth/authorize');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  // authUrl.searchParams.set('scope', ''); // Optional scopes if needed

  return Response.redirect(authUrl.toString(), 302);
};

interface Env {
  WCL_CLIENT_ID: string;
}
