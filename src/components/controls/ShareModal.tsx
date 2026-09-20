import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SharePayload } from '@/hooks/useSimulation';
import {
  buildHashShareUrl,
  buildShortShareUrl,
  encodeUrlState,
  resolveApiBase,
} from '@/hooks/useUrlState';

export type { SharePayload };

export type ShareModalProps = {
  open: boolean;
  onClose: () => void;
  payload: SharePayload;
  /** Override API base (default `import.meta.env.VITE_API_URL` or empty / proxy). */
  apiBase?: string;
};

type ShareStatus = 'idle' | 'saving' | 'copied' | 'error';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ShareModal({
  open,
  onClose,
  payload,
  apiBase,
}: ShareModalProps) {
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const hashUrl = useMemo(() => buildHashShareUrl(payload), [payload]);

  const base = resolveApiBase(apiBase);
  // Sans API configurée (site statique), le lien court n'existe pas : seul le lien hash est proposé.
  const shortLinkAvailable = apiBase !== undefined || base !== '' || import.meta.env.DEV;

  const copyHashLink = useCallback(async () => {
    const ok = await copyText(hashUrl);
    setShortUrl(null);
    setStatus(ok ? 'copied' : 'error');
    setMessage(
      ok
        ? 'Lien hash (fallback) copié dans le presse-papiers.'
        : 'Impossible de copier le lien hash.',
    );
  }, [hashUrl]);

  const copyShortLink = useCallback(async () => {
    setStatus('saving');
    setMessage(null);
    try {
      const endpoint = `${base}/api/scenarios`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload, isPublic: true }),
      });
      if (!res.ok) {
        throw new Error(`API ${res.status}`);
      }
      const body = (await res.json()) as {
        slug?: string;
        short_id?: string;
        url?: string;
      };
      const slug = body.slug ?? body.short_id;
      if (!slug) throw new Error('Missing slug');

      // Prefer API `url` (`/s/:slug`); fall back to builder.
      const path =
        typeof body.url === 'string' && body.url.startsWith('/s/')
          ? body.url
          : `/s/${slug}`;
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const link = `${origin}${path}`;
      const ok = await copyText(link || buildShortShareUrl(slug));
      setShortUrl(link || buildShortShareUrl(slug));
      setStatus(ok ? 'copied' : 'error');
      setMessage(
        ok
          ? 'Lien court copié.'
          : 'Scénario enregistré, mais la copie a échoué.',
      );
    } catch {
      setStatus('error');
      setMessage('API indisponible — utilisez le lien hash ci-dessous.');
    }
  }, [base, payload]);

  // Échap ferme la modale : seule sortie au clavier, le fond n'est pas focusable.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="share-backdrop fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4"
      role="presentation"
      onClick={(e) => {
        // Seul le fond ferme : pas de handler souris sur la boîte de dialogue.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="w-full max-w-md border border-border bg-surface p-4 text-fg shadow-none"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2
              id="share-modal-title"
              className="m-0 text-lg font-semibold tracking-tight"
            >
              Partager le scénario
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              {shortLinkAvailable
                ? 'Lien court via API (`/s/:slug`), ou fallback compressé dans l’URL.'
                : 'Le schéma complet est compressé dans l’URL : aucun serveur, aucun compte.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 min-w-11 items-center justify-center border border-border bg-surface px-3 text-sm text-fg hover:border-border-strong"
            aria-label="Fermer le partage"
          >
            Fermer
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {shortLinkAvailable && (
            <button
              type="button"
              onClick={() => void copyShortLink()}
              disabled={status === 'saving'}
              className="inline-flex h-11 items-center justify-center border border-border-strong bg-surface px-3 text-sm font-medium text-fg hover:border-flow-cash disabled:opacity-60"
            >
              {status === 'saving' ? 'Enregistrement…' : 'Copier le lien court'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void copyHashLink()}
            className="inline-flex h-11 items-center justify-center border border-border-strong bg-surface px-3 text-sm font-medium text-fg hover:border-flow-cash"
          >
            {shortLinkAvailable ? 'Copier le lien hash (hors-ligne)' : 'Copier le lien de partage'}
          </button>
        </div>

        {(shortUrl || hashUrl) && (
          <p
            className="mt-3 break-all font-mono text-xs text-fg-muted tabular-nums"
            data-testid="share-url-preview"
          >
            {shortUrl ?? `${hashUrl.slice(0, 72)}…`}
          </p>
        )}

        {message && (
          <p
            className={`mt-2 text-sm ${status === 'error' ? 'text-flow-alert' : 'text-flow-cash'}`}
            role="status"
          >
            {message}
          </p>
        )}

        <p className="mt-3 text-xs text-fg-muted">
          Taille hash ≈ {encodeUrlState(payload).length} caractères encodés.
        </p>
      </div>
    </div>
  );
}
