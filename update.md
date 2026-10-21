# Task: Remove Lovable Cloud Dependencies and Prepare My Food Delivery App for Free Hosting

Act as a senior full-stack engineer specializing in React, TypeScript, TanStack Start, Supabase, Drizzle ORM, and Cloudflare Workers.

I have a food-delivery application generated using Lovable. I want to remove its dependency on Lovable Cloud and deploy it using **Cloudflare Workers (free tier) for hosting and my own Supabase project for database, authentication, and storage**.

**Important:** Do not rebuild the application from scratch. Preserve the existing UI, design, routing, functionality, and business logic. First inspect the entire project, then make only the changes necessary to migrate it safely.

## 1. Inspect the project first

Before modifying anything, inspect:

- `package.json`
- `vite.config.ts`
- `src/server.ts`
- `src/integrations/lovable/index.ts`
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/client.server.ts`
- `src/integrations/supabase/auth-middleware.ts`
- `src/integrations/supabase/previewAuthStorage.ts`
- `src/routes/auth.tsx`
- `drizzle/schema.ts`
- `drizzle.config.ts`
- All files in `drizzle/migrations/`
- All files that call `supabase.from(...)`
- All files that use `createServerFn(...)`
- All references to `@lovable.dev`, Lovable Cloud, environment variables, email authentication, LiveKit, and server-only secrets.

Search the complete source tree for Lovable-specific imports, authentication functions, environment variables, deployment assumptions, and runtime APIs.

Before editing, report:
1. Which files depend on Lovable.
2. Which files need modifications.
3. Which dependencies can be removed safely.
4. Which features need external configuration.
5. Any compatibility issues with Cloudflare Workers.

Then proceed with the implementation if the environment allows file editing.

## 2. Replace Lovable authentication with Supabase authentication

### File: `src/integrations/lovable/index.ts`

Inspect how `@lovable.dev/cloud-auth-js` is used throughout the application.

Replace Lovable-specific authentication with the official Supabase Auth client where appropriate. Update every dependent import and usage.

Do not remove this file or its exports until all references have been migrated and verified.

### File: `src/routes/auth.tsx`

The existing Google sign-in handler uses Lovable authentication similar to:

```tsx
const google = async () => {
  const r = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  if (r.error) toast.error("Google sign-in failed");
};
```

Replace this with the Supabase Auth equivalent:

```tsx
const google = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) toast.error(error.message);
};
```

Adapt the code to the project's actual imports and types. Remove the Lovable import if no longer required.

Verify that email/password login, registration, logout, session restoration, OAuth callbacks, and protected routes continue working.

Do not assume that changing the Google login function alone completes the authentication migration.

## 3. Update the Supabase browser client

### File: `src/integrations/supabase/client.ts`

Inspect the existing client configuration.

The current client uses `brokeredPreviewStorage` from `./previewAuthStorage`. Determine whether this is Lovable preview-specific and replace it with standard browser session storage if appropriate.

For example, the browser client may use:

```ts
storage: typeof window !== "undefined"
  ? window.localStorage
  : undefined,
persistSession: true,
autoRefreshToken: true,
detectSessionInUrl: true,
```

Integrate these options into the existing configuration rather than blindly replacing the whole file.

Preserve existing custom fetch behavior and any required headers unless they are confirmed to be unnecessary.

Update error messages such as "Connect Supabase in Lovable Cloud" so they explain how to configure my own Supabase project.

Make sure the client works correctly during server-side rendering and browser hydration. Avoid accessing `window` during server execution.

### File: `src/integrations/supabase/previewAuthStorage.ts`

Remove this file only if nothing references it after migration. Otherwise, preserve any required functionality and explain why it remains necessary.

## 4. Keep the server-only Supabase client secure

### File: `src/integrations/supabase/client.server.ts`

Inspect the current service-role client.

- Keep the service-role key server-only.
- Never expose it through a `VITE_` environment variable.
- Never import the server client into browser components.
- Verify authorization before performing privileged database operations.
- Use the correct Cloudflare Workers environment binding mechanism instead of assuming Node.js `process.env` is available.
- Do not weaken Row Level Security or expose privileged database operations to unauthenticated users.

Review `src/integrations/supabase/auth-middleware.ts` and all server functions that depend on it. Preserve or improve the existing authentication and authorization checks.

## 5. Remove Lovable build dependencies safely

### File: `vite.config.ts`

The project uses `@lovable.dev/vite-tanstack-config`.

Inspect what this package configures before replacing it. It may provide important TanStack Start, Vite, Nitro, or Cloudflare integration.

Replace the Lovable-specific configuration with a supported configuration compatible with the project's actual versions of:

- React
- Vite
- TanStack Start
- TanStack Router
- Nitro or the supported Cloudflare deployment adapter

Inspect `src/server.ts` and ensure the server entry remains compatible with the selected deployment target.

Do not simply delete `@lovable.dev/vite-tanstack-config` or uninstall related packages until the replacement configuration works.

Update `package.json` and the lockfile consistently. Avoid upgrading every dependency unnecessarily.

## 6. Verify the database and Drizzle setup

The project includes:

- `drizzle/schema.ts`
- `drizzle.config.ts`
- `drizzle/migrations/`
- `drizzle-orm`
- `drizzle-kit`
- `postgres`
- `@supabase/supabase-js`

The existing application appears to use Supabase JS queries such as:

```ts
supabase.from("products").select("*");
```

Inspect the full project and confirm whether Drizzle is used for actual runtime database queries or only for schema and migration tooling.

**Do not rewrite the application's Supabase queries to Drizzle unless there is a concrete requirement.**

Review all migrations in chronological order. Identify the SQL needed to recreate the database in my own Supabase project, including:

- Tables and relationships
- Primary and foreign keys
- Indexes and constraints
- Row Level Security policies
- Database functions and triggers
- Storage buckets and storage policies
- Any required extensions, enums, or other database objects

Check whether the migrations contain only table definitions or also include policies, functions, triggers, and other objects. Do not assume that the Drizzle schema alone fully describes the Supabase backend.

Create a clear migration checklist and, if needed, a separate SQL setup file suitable for review before execution.

Do not automatically delete migration files or Drizzle dependencies.

Important: Recreating the schema does not automatically transfer existing users, database records, storage files, OAuth settings, or secrets.

## 7. Configure environment variables

Identify every environment variable referenced throughout the project and document its purpose.

Prepare an `.env.example` with placeholders such as:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SECRET

LIVEKIT_URL=YOUR_LIVEKIT_URL
LIVEKIT_API_KEY=YOUR_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_API_SECRET
```

Adjust the variables to match the code and current Supabase key conventions.

Do not commit real credentials. Do not put server secrets in browser-accessible variables.

For Cloudflare Workers, use supported environment bindings or secrets and adapt the application to read them correctly. Do not assume `.env` files or Node.js `process.env` automatically work in production Workers.

Check whether the frontend currently relies on any environment variables that must be exposed at build time.

## 8. Email authentication and notifications

Inspect the registration, password reset, email confirmation, and order-notification flows.

Determine whether the application depends on Lovable-provided email functionality or Supabase's default email service.

If an external email provider is required, document how to configure a provider such as Resend through Supabase SMTP or a secure server-side integration.

Do not invent API keys or silently remove email features.

Keep email sending secure and prevent unauthorized users from sending arbitrary emails.

## 9. LiveKit calling features

Search the entire project for LiveKit usage.

Identify the client-side code, token-generation server functions, required environment variables, and API routes.

Ensure LiveKit API secrets are only used server-side and never shipped to the browser.

Check whether the token-generation endpoints require authentication and validate which users may call one another.

Adapt the implementation to Cloudflare Workers only if the necessary SDKs and APIs are supported. Otherwise, recommend a separate compatible free or low-cost backend for the affected functions.

Do not remove calling functionality merely to make the build pass.

## 10. Cloudflare Workers compatibility

The deployment target is Cloudflare Workers, preferably using a currently supported TanStack Start integration.

Inspect dependencies and code for unsupported Node.js APIs, filesystem access, incompatible packages, database connection assumptions, and other runtime limitations.

Check whether the current database client and LiveKit server SDK work in the Workers runtime.

If a feature cannot run reliably on Workers, explain the exact issue and propose the smallest compatible alternative. Do not claim deployment compatibility without testing it.

Keep the existing React application and SSR behavior wherever possible.

## 11. Testing and validation

After making changes:

1. Install dependencies using the project's existing package manager and lockfile.
2. Run the TypeScript check if configured.
3. Run the production build.
4. Run linting and tests if configured.
5. Fix errors introduced by your changes.
6. Search again for remaining Lovable imports and references.
7. Confirm the browser bundle contains no service-role keys or LiveKit API secrets.
8. Verify that routes, authentication, protected pages, products, cart, checkout, orders, tracking, admin, rider features, and support pages remain intact.
9. Document any tests that cannot be performed without real credentials or a deployed Supabase project.

Do not claim a test passed unless you actually ran it and observed a successful result.

## 12. Expected deliverables

When finished, provide:

1. A list of modified files and the reason for each change.
2. The complete updated code for each modified file, or make the changes directly in the workspace.
3. Any new configuration files.
4. An `.env.example` with placeholders only.
5. SQL migrations or setup instructions for my own Supabase project.
6. Exact steps for configuring Google OAuth, email SMTP, and LiveKit.
7. Exact Cloudflare deployment steps.
8. All required Cloudflare secrets and non-secret environment bindings.
9. Commands to install, run locally, build, and deploy.
10. A list of remaining manual steps, limitations, and features that require external services.

## Critical rules

- Do not rebuild the app from scratch.
- Do not redesign the UI.
- Do not replace working Supabase JS queries with Drizzle unnecessarily.
- Do not delete features to get a successful build.
- Do not expose secrets or disable authorization.
- Do not fabricate credentials or pretend external services are configured.
- Do not remove dependencies until their usage and replacements are verified.
- Prefer minimal, reversible changes.
- If the project cannot be deployed directly to Cloudflare Workers because of a genuine compatibility issue, explain the issue and provide a working alternative architecture rather than forcing an unsafe or broken migration.

**Start by inspecting the project and producing a file-by-file change plan. Then implement the changes, run the available checks, and report exactly what works and what still needs manual configuration.**