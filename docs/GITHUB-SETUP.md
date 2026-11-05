# Setting up GitHub sign-in

GitHub sign-in is optional; local mode works without it. To save workspaces to GitHub, whoever runs
the server creates a **GitHub App** once. It's free and takes about five minutes.

## 1. Create the GitHub App

Open <https://github.com/settings/apps/new>. For an organization, use
`https://github.com/organizations/<org>/settings/apps/new` instead.

| Field | Value |
|---|---|
| GitHub App name | Must be unique on GitHub, e.g. `PageHut` or `PageHut Dev (yourname)` |
| Homepage URL | `http://localhost:3000` (or your deployed URL) |
| Callback URL | `http://localhost:3000/api/auth/callback`; add your production URL as a second callback URL later |
| Expire user authorization tokens | **Checked** (required: PageHut relies on expiring tokens with refresh) |
| Request user authorization (OAuth) during installation | Unchecked |
| Enable Device Flow | Unchecked |
| Webhook → Active | **Unchecked** (PageHut doesn't use webhooks) |

**Permissions.** Grant only these:

| Scope | Permission | Access |
|---|---|---|
| Repository | Contents | Read and write |
| Repository | Metadata | Read-only (mandatory, set automatically) |

Leave every other repository, organization and account permission at **No access**.

**Where can this GitHub App be installed?**
- *Only on this account* is fine for trying it out.
- Choose *Any account* when other people (classmates, other teams) should be able to install it
  on their own repositories.

Click **Create GitHub App**.

## 2. Collect the keys

On the app's settings page:

1. Copy the **Client ID**. It starts with `Iv`.
2. Under *Client secrets*, click **Generate a new client secret** and copy it. GitHub shows it once.
3. Note the **app slug**: the last part of the app's public URL, `https://github.com/apps/<slug>`.

You don't need a private key; PageHut only uses user access tokens.

## 3. Configure PageHut

Create `.env.local` in the project root. It is already ignored by Git.

```bash
GITHUB_APP_CLIENT_ID=Iv23li...
GITHUB_APP_CLIENT_SECRET=...
GITHUB_APP_SLUG=pagehut-dev-yourname
# At least 32 random characters. Encrypts the session cookie. Generate one with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
SESSION_SECRET=...
# Optional: fixed public URL when running behind a proxy (must match a callback URL).
# PAGEHUT_PUBLIC_URL=https://pagehut.example
```

Restart `pnpm dev`. On a hosting platform (Vercel, Cloudflare), set the same variables in the
project's environment settings.

Changing `SESSION_SECRET` signs everyone out. It never affects documents.

## 4. Install the app on a repository

1. Create a repository for your GDD on GitHub. It can be empty, public or private.
2. Open `https://github.com/apps/<slug>/installations/new`.
3. Choose **Only select repositories** and pick that repository.

Teammates you add as collaborators on that repository can use it right away. They sign in with
GitHub in PageHut and choose **Open from GitHub**.

## 5. Try it

1. In PageHut, click **Local mode → Connect** in the sidebar and sign in with GitHub.
2. Choose the repository and click **Save to repository**.
3. Open the repository on github.com. You should see `workspace.json`, `README.md` and one
   `pages/<id>.md` file per page.

## How it stays safe

- **Minimal scope.** The app can only reach repositories it is installed on, and only their files.
- **No document storage on the server.** The server exchanges the sign-in code and refreshes
  tokens. Documents go directly between the browser and GitHub.
- **Refresh token.** Encrypted (AES-256-GCM) in an `httpOnly`, `SameSite=Lax` cookie limited to
  `/api/auth`, and `Secure` on HTTPS.
- **Access token.** Lives about 8 hours and is kept in browser memory only. It is never stored,
  never logged and never put in URLs.
- **Login hardening.** The flow uses `state` and PKCE (S256). Token requests need a custom header
  and a same-origin `Origin`, which blocks cross-site requests.
- **Never force-pushes.** If a teammate pushed first, PageHut stops and keeps your changes locally.
  Merging arrives in phase P3.

## Troubleshooting

| Message | Fix |
|---|---|
| "GitHub sign-in is not set up on this server" | One of the four variables is missing, or `SESSION_SECRET` is shorter than 32 characters. Restart after editing `.env.local`. |
| GitHub says "redirect_uri is not associated with this application" | Add the exact callback URL (`…/api/auth/callback`) to the app. |
| "expiring_tokens_disabled" | Enable *Expire user authorization tokens* in the app settings. |
| Repository missing from the list | Install the app on it (step 4), or ask the repository owner to. |
| "The app can't access this repository" | You need write access to the repository. |
