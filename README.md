# Dark Intentions WCL Analyzer

A premium performance analyzer for the Dark Intentions guild, built with React, Vite, and the Warcraft Logs API.

## Features
- **Premium UI**: Custom-designed dark theme with Warcraft-inspired aesthetics.
- **WCL Integration**: Secure OAuth2 connection to your Warcraft Logs account.
- **Cloudflare Ready**: Built for Cloudflare Pages with backend Functions for secure token exchange.

## Deployment Setup

To host this on Cloudflare Pages, you need to set up your OAuth credentials:

1.  **Create WCL Client**:
    - Go to [Warcraft Logs Clients](https://www.warcraftlogs.com/api/clients/).
    - Create a new client.
    - Set the **Redirect URI** to:
        - Local Development: `http://localhost:5173/api/callback`
        - Production: `https://your-site.pages.dev/api/callback`
2.  **Configure Cloudflare**:
    - In your Cloudflare Pages dashboard, go to **Settings > Environment variables**.
    - Add the following variables:
        - `WCL_CLIENT_ID`: Your Client ID from WCL.
        - `WCL_CLIENT_SECRET`: Your Client Secret from WCL. (Encrypted recommended)
3.  **Local Development**:
    - Use [Wrangler](https://developers.cloudflare.com/workers/wrangler/) to run local functions:
        ```bash
        npx wrangler pages dev --binding WCL_CLIENT_ID=your_id --binding WCL_CLIENT_SECRET=your_secret
        ```

## Future Roadmap
- [ ] Implement per-boss metric analyzers.
- [ ] Add guild-wide performance overview.
- [ ] Real-time log scraping and breakdown.

## Tech Stack
- Frontend: React + TypeScript + Vite
- Icons: Lucide React
- Backend: Cloudflare Pages Functions
- API: [@rpglogs/api-sdk](https://github.com/RPGLogs/RPGLogsApiSdk)
