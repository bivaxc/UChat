# UChat starter

A mobile-first React + Vite + Supabase messaging web app starter. Includes email/password auth, profiles, direct chats, groups, text/image messages, read receipts, and experimental one-to-one WebRTC audio/video calls.

## Current status
The frontend source and deployment workflow are included, but this project is not live until you connect a Supabase project and publish the repository. A successful build and real two-account test are still required before calling it working.

## Requirements
- Node.js 20 or newer
- A Supabase project
- GitHub account for publishing

## 1. Configure Supabase
1. Create a project at https://supabase.com/dashboard. Choose a region near your users if available. Free-tier availability and limits can change.
2. Open **SQL Editor**, create a query, paste all of `supabase.sql`, and run it.
3. In **Project Settings / API Keys**, copy the Project URL and a **publishable key**. Never use a `service_role` or secret key in browser code.
4. In **Authentication / URL Configuration**, set your local URL to `http://localhost:5173`. Later add your deployed GitHub Pages URL to the allowed redirect URLs. If email confirmation is enabled, configure the site's redirect URL too.
5. In **Authentication / Providers**, enable Email. For first tests, you may disable email confirmation, but enable it before public launch.

## 2. Run locally
```bash
npm install
cp .env.example .env
```
Edit `.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```
Then run:
```bash
npm run dev
```
Open the local URL Vite prints. Create two accounts in separate browsers/devices to test chats and calls.

## 3. Publish free on GitHub Pages
For a Vite app on GitHub Pages, use a GitHub Actions deployment so Vite builds the static site. Add repository **Settings > Secrets and variables > Actions > Variables**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Create `.github/workflows/deploy.yml` with the workflow below. Replace `YOUR_REPOSITORY_NAME` in `base` with the exact repository name. For a user/organization site repository named `username.github.io`, use `/` as base instead.

```yaml
name: Deploy UChat
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm install
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Also add `vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: '/YOUR_REPOSITORY_NAME/'
});
```
Then commit and push the files to a GitHub repository's `main` branch, and enable **Settings > Pages > Build and deployment > GitHub Actions**. After deployment, add the final `https://USERNAME.github.io/YOUR_REPOSITORY_NAME/` URL to Supabase Auth URL configuration.

## Important limits and security notes
- The publishable key is designed to be public. Database safety comes from RLS policies, not hiding this key. Never put a service-role key in `.env` for a browser app.
- The SQL includes RLS on app tables and room membership checks, but have an experienced reviewer audit the policies before public launch. In particular, this starter's read-receipt update policy allows room members to update a message row; tighten it with a dedicated receipts table or a database function before real-world use.
- Image bucket is public so image links work simply. Anyone with an image URL may be able to view it. Do not upload private or sensitive images. A production version should use a private bucket and signed URLs.
- Read receipts are stored as an array on each message for simplicity, not as a scalable receipt model.
- Calls use browser WebRTC and a public STUN server only. This can fail across some networks, mobile carriers, or restrictive NATs. Production reliability usually requires a TURN server, which may not be free at scale. Incoming-call ringing, call history, group calls, and robust reconnection are not implemented yet. Calls are experimental, one-to-one, and should be tested between two signed-in users in the same room.
- This is not WhatsApp-level end-to-end encrypted. HTTPS protects transport, but Supabase stores message content in the database. Do not market it as end-to-end encrypted.
- Free-tier quotas, dormancy/pause policies, storage, bandwidth and Realtime limits can change. Free is suitable for a prototype, not a promise of unlimited service.
- Before public launch add abuse reporting/blocking, rate limiting, account deletion, privacy policy, terms, backup strategy, and monitoring.

## Included files
- `src/main.jsx`: application and realtime/chat/call logic
- `src/style.css`: responsive mobile-first interface
- `src/supabase.js`: Supabase client
- `supabase.sql`: tables, RLS policies, storage bucket and call signaling policies
- `.env.example`: environment variable template
