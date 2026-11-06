# Deploying PageHut

PageHut needs no database and no paid service. Documents live in each user's browser and, for
teams, in their own GitHub repositories. The server only serves the app and runs the GitHub
sign-in endpoints (`/api/auth/*`).

- **Local mode** works with no environment variables at all.
- **GitHub sign-in** needs four variables: `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`,
  `GITHUB_APP_SLUG` and `SESSION_SECRET`. Create the GitHub App with
  [GITHUB-SETUP.md](GITHUB-SETUP.md), and add your deployed URL's callback
  (`https://<your-domain>/api/auth/callback`) to the app.

Use a separate GitHub App for each public deployment, and never commit `.env.local`.

## Vercel (free Hobby plan)

1. Push the repository to GitHub, then choose **Add New → Project** on <https://vercel.com> and
   import it. Vercel detects Next.js and pnpm; leave the build settings as they are.
2. Optional: under **Settings → Environment Variables**, add the four GitHub variables.
3. Deploy. Every pull request gets its own preview URL.

If you sign in on preview URLs, either add each preview callback URL to the GitHub App or use
sign-in on the production domain only.

## Docker (any server or home lab)

The [Dockerfile](../Dockerfile) builds a small image that runs the Next.js standalone server as a
non-root user.

```bash
docker build -t pagehut .
```

```bash
docker run -d --name pagehut -p 3000:3000 --env-file .env.local pagehut
```

Leave out `--env-file` for local mode only. Behind a reverse proxy (Caddy, nginx, Traefik), set
`PAGEHUT_PUBLIC_URL=https://your-domain` so the sign-in callback uses the public address, and
serve the app over HTTPS. The session cookie is marked `Secure` when the request is HTTPS, or when the
proxy sends `X-Forwarded-Proto: https` (all common proxies do).

## Any Node.js host

Requirements: Node.js 20+ and pnpm 10+.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

`pnpm start` listens on port 3000 (`pnpm start --port 8080` to change it). For a smaller
deployment folder, build with `PAGEHUT_STANDALONE=1 pnpm build`, then copy `.next/standalone`,
`.next/static` (to `.next/static` inside it) and `public`, and run `node server.js`.

Next.js copies `.env*` files from the project into `.next/standalone`. If you build on a machine
that has `.env.local`, the folder contains your secrets: copy it only to your own server, never
into a public place. The Docker build never sees `.env*` files (`.dockerignore`).

## Cloudflare (Workers, through OpenNext)

Cloudflare's free plan can host PageHut through the [OpenNext Cloudflare
adapter](https://opennext.js.org/cloudflare). **This path is not tested yet.** PageHut uses
Next.js 16 features (Cache Components, a `proxy.ts` middleware), so check the adapter's
supported Next.js versions first. The outline:

1. `pnpm add -D @opennextjs/cloudflare wrangler`
2. Add the `wrangler.jsonc` and `open-next.config.ts` files from the adapter's "existing app"
   guide.
3. Store the GitHub variables as Worker secrets: `pnpm wrangler secret put SESSION_SECRET`, and
   the same for the other three.
4. `pnpm opennextjs-cloudflare build && pnpm opennextjs-cloudflare deploy`

If it works for you, please open a pull request that turns these steps into a tested guide.

## Checking a deployment

- `/<locale>` (for example `/en`) opens the app and creates a local workspace.
- `/api/auth/status` returns `{"configured":true,…}` when the GitHub variables are set.
- Sign in, save a workspace to a test repository, and check that the files appear on GitHub.
