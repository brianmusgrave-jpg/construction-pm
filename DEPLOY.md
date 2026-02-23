# Deployment Guide — Construction PM

## Step 1: Create a GitHub Repository

1. Go to https://github.com/new
2. Name it `construction-pm` (or whatever you prefer)
3. Leave it **public** or **private** — your choice
4. **Don't** add a README or .gitignore (we already have them)
5. Click **Create repository**

Then push the code. In your terminal, from the `construction-pm` folder:

```bash
git remote add origin https://github.com/YOUR_USERNAME/construction-pm.git
git push -u origin main
```

## Step 2: Create a Supabase Project (Free Tier)

1. Go to https://supabase.com and sign in (or create an account)
2. Click **New Project**
3. Name: `construction-pm`
4. Database Password: generate a strong one and **save it**
5. Region: pick one close to you
6. Click **Create new project** (takes ~2 minutes)

Once created, go to **Project Settings → Database** and copy:
- **Connection string (URI)**: This is your `DATABASE_URL`
  - It looks like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`
- **Direct connection string**: This is your `DIRECT_URL`
  - Same but on port `5432` without `?pgbouncer=true`

## Step 3: Deploy to Vercel

1. Go to https://vercel.com/new
2. Click **Import Git Repository** and select your `construction-pm` repo
3. Vercel auto-detects Next.js — leave the defaults
4. Click **Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Supabase pooled connection string |
| `DIRECT_URL` | Your Supabase direct connection string |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` to generate one |
| `NEXTAUTH_URL` | Leave blank for now (Vercel auto-detects) |

5. Click **Deploy**

## Step 4: Push the Database Schema

After the first deploy, you need to create the database tables. The easiest way:

```bash
# From the construction-pm folder on your machine
npm install
npx prisma db push
```

This reads your local `.env.local` file (which should have the Supabase URLs) and creates all the tables.

Then seed with sample data:

```bash
npm install -D tsx
npx tsx prisma/seed.ts
```

## Step 5: Set Up Local Development

Create a `.env.local` file in the project root:

```
DATABASE_URL="your-supabase-pooled-url"
DIRECT_URL="your-supabase-direct-url"
NEXTAUTH_SECRET="same-secret-as-vercel"
NEXTAUTH_URL="http://localhost:3000"
```

Then:

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with `admin@constructionpm.com`.

## Optional: Google OAuth

If you want Google sign-in later:

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an OAuth 2.0 Client ID
3. Add `http://localhost:3000/api/auth/callback/google` as authorized redirect URI
4. Add your Vercel URL too: `https://your-app.vercel.app/api/auth/callback/google`
5. Add these env vars to both `.env.local` and Vercel:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
