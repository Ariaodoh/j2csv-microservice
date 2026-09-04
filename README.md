# Products Index Service

A tiny, single-purpose app: upload a Shopify product CSV export, get back
`products-index.json` in the exact shape the style-sync Vercel analysis
endpoint (`route.ts`) expects. No history — every upload replaces the
previously staged file.

## How it works

- `POST /api/convert` — accepts a CSV file upload, converts it, and
  overwrites a single fixed-path blob in Vercel Blob storage.
- `GET /api/latest` — redirects to whatever's currently staged, so you
  (or a future automated step) can always fetch the latest version from
  one stable URL.
- A single-page upload UI at `/` protected by a shared access key.

No database. No file history. Vercel Blob storage is the entire
"staging area" — each conversion overwrites the same object.

## Local setup

```bash
npm install
```

Create `.env.local`:

```
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
UPLOAD_SECRET=choose_a_password_only_you_know
```

```bash
npm run dev
```

## Deploying to Vercel (clean CI/CD)

1. **Push this folder to its own GitHub repo** — keep it separate from
   your theme repo and your `ma-style-sync` analysis app repo. Three
   distinct concerns, three distinct deploys.
2. **Import the repo into Vercel** as a new project (vercel.com →
   Add New → Project → select the repo). Vercel auto-detects Next.js,
   no config needed.
3. **Add Vercel Blob storage**: in the new project → Storage tab →
   Create Database → Blob. Vercel automatically injects
   `BLOB_READ_WRITE_TOKEN` into your project's environment variables —
   you don't need to generate or paste this yourself.
4. **Set `UPLOAD_SECRET`**: Project Settings → Environment Variables →
   add `UPLOAD_SECRET` with a password of your choosing. This is the
   value you'll type into the "Access Key" field on the upload page —
   it keeps the endpoint from being a publicly-writable URL that
   anyone who finds it could overwrite.
5. **Deploy.** Every push to `main` redeploys automatically — that's
   the whole CI/CD story here; there's no build step beyond Next.js's
   own, and no test suite wired in yet (add one if this grows).

## Using it

1. Shopify Admin → Products → Export → CSV for Excel.
2. Visit the deployed app's URL, enter your access key, upload the CSV.
3. Download the result immediately, or hit `/api/latest` any time
   afterward to grab whatever was staged most recently — useful if you
   want to wire this into a script or another automation later without
   re-uploading.
4. Copy the downloaded `products-index.json` into your theme's
   `/assets` folder and deploy the theme as usual.

## Why Vercel Blob instead of writing to disk

Vercel's serverless functions don't have a persistent filesystem —
anything written to disk during one request is gone by the next
invocation. Blob storage is Vercel's own object storage product and
is the standard way to persist a file like this between requests
without standing up a database for what's essentially one file.

## What this deliberately doesn't do

- No history/versioning — by design, per your requirement. If you
  later want to see what changed between uploads, that'd mean writing
  to a timestamped path instead of overwriting, which is a small
  change to `BLOB_PATHNAME` in `app/api/convert/route.ts` if you ever
  want it.
- No automatic Shopify export — this still expects you to manually
  export the CSV from Admin. A future version could poll the Admin
  API or a scheduled export instead, but that reintroduces the token
  dependency you just moved away from.
