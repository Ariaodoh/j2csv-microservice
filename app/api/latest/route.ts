/**
 * app/api/latest/route.ts
 *
 * GET -> redirects to whatever products-index.json currently sits in
 * Blob storage. No separate database needed to "remember" the URL —
 * we just look up the fixed pathname each time.
 */

import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const runtime = 'nodejs';

const BLOB_PATHNAME = 'products-index.json';

export async function GET() {
  const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1 });

  if (blobs.length === 0) {
    return NextResponse.json(
      { error: 'No products-index.json has been generated yet. Upload a CSV first.' },
      { status: 404 }
    );
  }

  return NextResponse.redirect(blobs[0].url);
}
