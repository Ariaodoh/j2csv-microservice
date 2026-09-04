'use client';

import { useState } from 'react';

interface ConvertResponse {
  success: boolean;
  downloadUrl: string;
  productCount: number;
  skippedInactive: number;
  skippedUntagged: number;
  generatedAt: string;
}

export default function Page() {
  const [secret, setSecret] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConvertResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'x-upload-secret': secret },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        setResult(data);
      }
    } catch {
      setError('Upload failed — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <h1>Products Index Generator</h1>
      <p className="subtitle">
        Export a product CSV from Shopify Admin (Products → Export), upload it here, and get
        back a fresh <code>products-index.json</code>. Only the most recent version is kept —
        each upload replaces the last.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="secret">Access Key</label>
          <input
            id="secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="file">Shopify Product CSV</label>
          <input
            id="file"
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Converting…' : 'Convert & Stage'}
        </button>
      </form>

      {error && <div className="result error">{error}</div>}

      {result && (
        <div className="result success">
          <p>
            <strong>{result.productCount}</strong> tagged products staged.
            {result.skippedUntagged > 0 && ` ${result.skippedUntagged} skipped (no style:/tier: tags).`}
            {result.skippedInactive > 0 && ` ${result.skippedInactive} skipped (inactive/unpublished).`}
          </p>
          <p>Generated {new Date(result.generatedAt).toLocaleString()}</p>
          <a href={result.downloadUrl} download="products-index.json">
            Download products-index.json →
          </a>
        </div>
      )}

      <a className="download-link" href="/api/latest">
        Or grab the most recently staged file anytime →
      </a>
    </div>
  );
}
