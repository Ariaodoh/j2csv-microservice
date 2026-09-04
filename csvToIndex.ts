/**
 * lib/csvToIndex.ts
 *
 * Core conversion logic: Shopify product CSV export -> products-index.json
 * shape expected by the style-sync Vercel analysis endpoint's Product
 * interface: { id, title, style_tags[], tier_tags[], image, url }.
 *
 * Kept framework-agnostic (no Next.js imports) so it's easy to unit test
 * or reuse elsewhere.
 */

export interface ProductIndexEntry {
  id: string;
  title: string;
  style_tags: string[];
  tier_tags: string[];
  image: string;
  url: string;
}

export interface ConversionResult {
  entries: ProductIndexEntry[];
  totalRowsProcessed: number;
  skippedInactive: number;
  skippedUntagged: number;
}

/**
 * Minimal RFC4180-style CSV parser — handles quoted fields containing
 * commas, quotes, and newlines (Shopify's Body/description column
 * regularly contains all three). No external dependency required.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && next === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Extracts style: and tier: namespaced values from Shopify's Tags column.
 * "style:bold, tier:signature, cotton" ->
 * { style_tags: ['bold'], tier_tags: ['signature'] }
 */
function extractNamespacedTags(tagString: string): { style_tags: string[]; tier_tags: string[] } {
  const tags = (tagString || '').split(',').map((t) => t.trim()).filter(Boolean);
  const style_tags: string[] = [];
  const tier_tags: string[] = [];

  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('style:')) {
      style_tags.push(tag.slice(6).trim());
    } else if (lower.startsWith('tier:')) {
      tier_tags.push(tag.slice(5).trim());
    }
  }

  return { style_tags, tier_tags };
}

interface RawProductRow {
  handle: string;
  title: string;
  tags: string;
  images: { src: string; position: number }[];
  published: string | null;
  status: string | null;
}

export function buildProductsIndex(csvText: string): ConversionResult {
  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    throw new Error('CSV appears empty or unreadable.');
  }

  const header = rows[0].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);

  const idxHandle = col('Handle');
  const idxTitle = col('Title');
  const idxTags = col('Tags');
  const idxImageSrc = col('Image Src');
  const idxImagePosition = col('Image Position');
  const idxPublished = col('Published');
  const idxStatus = col('Status');

  if (idxHandle === -1) {
    throw new Error('No "Handle" column found — is this a valid Shopify product export CSV?');
  }

  const productsByHandle = new Map<string, RawProductRow>();

  for (const cells of rows.slice(1)) {
    const handle = cells[idxHandle]?.trim();
    if (!handle) continue;

    if (!productsByHandle.has(handle)) {
      productsByHandle.set(handle, {
        handle,
        title: '',
        tags: '',
        images: [],
        published: null,
        status: null,
      });
    }

    const entry = productsByHandle.get(handle)!;

    if (idxTitle !== -1 && cells[idxTitle]?.trim()) entry.title = cells[idxTitle].trim();
    if (idxTags !== -1 && cells[idxTags]?.trim()) entry.tags = cells[idxTags].trim();
    if (idxPublished !== -1 && cells[idxPublished]?.trim()) entry.published = cells[idxPublished].trim();
    if (idxStatus !== -1 && cells[idxStatus]?.trim()) entry.status = cells[idxStatus].trim();

    if (idxImageSrc !== -1 && cells[idxImageSrc]?.trim()) {
      entry.images.push({
        src: cells[idxImageSrc].trim(),
        position: idxImagePosition !== -1 ? Number(cells[idxImagePosition]) || 999 : entry.images.length + 1,
      });
    }
  }

  const entries: ProductIndexEntry[] = [];
  let skippedInactive = 0;
  let skippedUntagged = 0;

  for (const entry of productsByHandle.values()) {
    if (entry.published !== null && entry.published.toUpperCase() === 'FALSE') {
      skippedInactive++;
      continue;
    }
    if (entry.status !== null && !['active', ''].includes(entry.status.toLowerCase())) {
      skippedInactive++;
      continue;
    }

    const { style_tags, tier_tags } = extractNamespacedTags(entry.tags);
    if (style_tags.length === 0 && tier_tags.length === 0) {
      skippedUntagged++;
      continue;
    }

    entry.images.sort((a, b) => a.position - b.position);
    const image = entry.images.length > 0 ? entry.images[0].src : '';

    entries.push({
      id: entry.handle,
      title: entry.title,
      style_tags,
      tier_tags,
      image,
      url: `/products/${entry.handle}`,
    });
  }

  return {
    entries,
    totalRowsProcessed: productsByHandle.size,
    skippedInactive,
    skippedUntagged,
  };
}
