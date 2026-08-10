# Getting OAuth client IDs and secrets for Gravity

This guide creates the **application credentials** Gravity needs to let each user connect their own Gmail, Drive, Slack, and HubSpot account. A client secret is sensitive: never paste it into chat, commit it, or expose it in browser code.

## Before you begin

Use these fixed application URLs when registering OAuth credentials:

| Environment | Base URL |
| --- | --- |
| Local development | `http://localhost:3000` |
| Vercel production (stable alias) | `https://gravity-callforge.vercel.app` |

Register these exact callback URLs in each provider, once Gravity's OAuth callback handlers have been deployed:

```text
http://localhost:3000/api/oauth/google/callback
http://localhost:3000/api/oauth/slack/callback
http://localhost:3000/api/oauth/hubspot/callback
https://gravity-callforge.vercel.app/api/oauth/google/callback
https://gravity-callforge.vercel.app/api/oauth/slack/callback
https://gravity-callforge.vercel.app/api/oauth/hubspot/callback
```

For Google, also register these **Authorized JavaScript origins**:

```text
http://localhost:3000
https://gravity-callforge.vercel.app
```

Do not use the generated deployment URL (`gravity-callforge-jy0tgwpen-…vercel.app`) in provider settings: it can change on a redeploy. OAuth providers require an exact match, so use the stable alias above.

## 1. Gmail, Google Drive, and Google Sheets

Gmail, Drive, Sheets, and Google sign-in use **one Google OAuth web client**.

1. Open [Google Cloud Console](https://console.cloud.google.com/), create a dedicated project named `Gravity`.
2. Open **APIs & Services → Library** and enable:
   - Gmail API
   - Google Drive API
   - Google Sheets API
   - Google Calendar API only if the Calendar status panel will use live data.
3. Open **Google Auth platform → Branding**, complete the app name, support email, and developer contact information.
4. In **Audience**, choose **Internal** only if every user belongs to the same Google Workspace. Otherwise choose **External**, add test users while developing, and submit the app for verification before public use.
5. In **Data Access**, add the smallest scopes Gravity needs:

```text
openid
email
profile
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/spreadsheets
```

`gmail.readonly` and `drive.readonly` are restricted scopes. Production public use can require Google verification and, depending on how data is stored or transmitted, a security assessment. Do not request broader Gmail or Drive access unless the implementation genuinely needs it.

6. Open **Google Auth platform → Clients → Create Client**.
7. Choose **Web application**. Add both Authorized JavaScript origins and both Google callback URLs shown above.
8. Click **Create**, copy the **Client ID** and **Client secret**, and add them to local `.env` and Vercel environment variables:

```dotenv
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="..."
```

## 2. Slack

1. Go to [Slack API: Your Apps](https://api.slack.com/apps) and choose **Create New App → From scratch**.
2. Name it `Gravity`, select a development workspace, then create it.
3. Under **Basic Information → App Credentials**, copy the **Client ID** and **Client Secret**.
4. Under **OAuth & Permissions → Redirect URLs**, add the local and production Slack callback URLs above, then save.
5. Under **OAuth & Permissions → Bot Token Scopes**, add the minimum required scopes:

```text
chat:write
commands
```

Add `chat:write.public` only if Gravity must post into public channels without first being invited. For interactive approval buttons, enable **Interactivity & Shortcuts**, supply the deployed interaction request URL, and save. For production Slack request validation, also copy the **Signing Secret** from **Basic Information**.

6. Store the credentials:

```dotenv
SLACK_CLIENT_ID="..."
SLACK_CLIENT_SECRET="..."
SLACK_SIGNING_SECRET="..."
```

## 3. HubSpot

1. Sign in to [HubSpot Developer](https://developers.hubspot.com/), create a project/app, and configure its authentication type as **OAuth**.
2. In the app's **Auth** settings, add the local and production HubSpot callback URLs above. Production redirects must use HTTPS; HubSpot permits `http://localhost` for development.
3. Request the required CRM scopes:

```text
crm.objects.contacts.read
crm.objects.contacts.write
crm.objects.deals.read
crm.objects.deals.write
crm.objects.owners.read
```

Only add engagement/note/task scopes after the corresponding HubSpot write adapter is implemented and tested.

4. On the app's **Auth** tab, copy the **Client ID** and **Client secret**. Installers need sufficient HubSpot permissions; a Super Admin may be needed.
5. Store them:

```dotenv
HUBSPOT_CLIENT_ID="..."
HUBSPOT_CLIENT_SECRET="..."
```

## 4. Store and deploy safely

1. Copy `.env.example` to `.env` locally and fill in the values. `.env` must stay untracked.
2. Add the same values under **Vercel → Project → Settings → Environment Variables** for Preview and Production as appropriate.
3. Generate and set a unique `TOKEN_ENCRYPTION_KEY`; use it to encrypt OAuth refresh tokens at rest. Do not use the client secrets as an encryption key.
4. Rotate a provider secret immediately if it is exposed. Update the environment variable and redeploy.
5. After callback handlers are deployed, connect one test account for each provider and verify token refresh, draft creation, Slack approval, and HubSpot/Sheets writes before inviting users.

## What Gravity still needs in code

The current repository contains environment placeholders and the data model, but not the provider callback/refresh transports. Add the OAuth `/api/oauth/*` routes, encrypted token persistence, signed Slack request verification, and provider adapters before entering any real credentials. This prevents collecting live credentials into a demo-only UI.

## Official references

- [Google OAuth web credentials](https://developers.google.com/workspace/guides/create-credentials)
- [Google OAuth and Drive scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Slack OAuth installation](https://docs.slack.dev/authentication/installing-with-oauth/)
- [HubSpot OAuth quickstart](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/oauth-quickstart-guide)
