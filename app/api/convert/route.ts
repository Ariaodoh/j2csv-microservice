/**
 * app/api/convert/route.ts
 *
 * POST a Shopify product CSV export -> converts it -> overwrites the
 * single staged products-index.json in Vercel Blob storage (fixed
 * pathname, no history kept — each upload replaces the last).
 *
 * Protected by a shared secret (UPLOAD_SECRET env var) so this isn't a
 * publicly-writable endpoint anyone stumbling on the URL could hit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { buildProductsIndex } from '@/lib/csvToIndex';

export const runtime = 'nodejs';

// Fixed pathname = no history. Every successful upload overwrites this
// same blob rather than creating a new one.
const BLOB_PATHNAME = 'products-index.json';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-upload-secret');
  if (!process.env.UPLOAD_SECRET || secret !== process.env.UPLOAD_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded under field "file".' }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ error: 'File must be a .csv export from Shopify Admin.' }, { status: 400 });
  }

  let csvText: string;
  try {
    csvText = await file.text();
  } catch {
    return NextResponse.json({ error: 'Could not read the uploaded file.' }, { status: 400 });
  }

  let result;
  try {
    result = buildProductsIndex(csvText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse CSV.';
    return NextResponse.json({ error: message }, { status: 422 });
  }

  if (result.entries.length === 0) {
    return NextResponse.json(
      {
        error:
          'No products with style: or tier: tags were found in this export. Tag products in Admin, re-export, and try again.',
      },
      { status: 422 }
    );
  }

  const jsonPayload = JSON.stringify(result.entries, null, 2);

  const blob = await put(BLOB_PATHNAME, jsonPayload, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false, // keep the URL stable across uploads
    allowOverwrite: true, // this upload replaces the previous version
  });

  return NextResponse.json({
    success: true,
    downloadUrl: blob.url,
    productCount: result.entries.length,
    skippedInactive: result.skippedInactive,
    skippedUntagged: result.skippedUntagged,
    generatedAt: new Date().toISOString(),
  });
}
