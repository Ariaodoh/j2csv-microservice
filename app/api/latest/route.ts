/**
 * app/api/latest/route.ts
 *
 * GET -> fetches whatever products-index.json currently sits in Blob
 * storage and streams it back with a Content-Disposition header, so
 * the browser downloads it as a file instead of just rendering the
 * JSON inline (which is what happened when we redirected straight to
 * the Blob URL — the `download` HTML attribute only works for
 * same-origin links, and the Blob URL is a different origin).
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

  const fileRes = await fetch(blobs[0].url);
  if (!fileRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch the staged file from storage.' }, { status: 502 });
  }
  const text = await fileRes.text();

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="products-index.json"',
      'Cache-Control': 'no-store',
    },
  });
}