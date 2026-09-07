import { useCallback, useEffect, useState } from 'react';
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';

import { parseScenarioState, type ScenarioState } from '@/core/types';
import type { WhatIfInputs } from '@/core/engine';
import type { FlowLayer } from '@/core/types';
import type { SharePayload } from '@/hooks/useSimulation';

const DEFAULT_HASH_KEY = 's';

/** Compress arbitrary JSON-serializable state for URL hash / query. */
export function encodeUrlState(data: unknown): string {
  return compressToEncodedURIComponent(JSON.stringify(data));
}

/** Decode lz-string payload; returns null on empty or corrupt input. */
export function decodeUrlState<T = unknown>(encoded: string): T | null {
  if (!encoded) return null;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function readHashParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return null;

  // Avoid URLSearchParams — it turns `+` into spaces and breaks lz-string.
  if (raw.includes('=')) {
    const eq = raw.indexOf('=');
    const k = raw.slice(0, eq);
    if (k === key) return raw.slice(eq + 1);
    // Multi-param fallback: split on & without decoding + as space.
    for (const part of raw.split('&')) {
      const i = part.indexOf('=');
      if (i >= 0 && part.slice(0, i) === key) return part.slice(i + 1);
    }
    return null;
  }
  if (key === DEFAULT_HASH_KEY) return raw;
  return null;
}

function writeHashParam(key: string, encoded: string | null) {
  if (typeof window === 'undefined') return;
  if (!encoded) {
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(null, '', url.toString());
    return;
  }
  const params = new URLSearchParams();
  params.set(key, encoded);
  const url = new URL(window.location.href);
  url.hash = params.toString();
  window.history.replaceState(null, '', url.toString());
}

export type UseUrlStateOptions<T> = {
  /** Hash query key (default `s`). */
  key?: string;
  /** Called once when a hash payload is present on mount. */
  onHydrate?: (value: T) => void;
};

/**
 * Sync serializable state with the URL hash via lz-string (offline share fallback).
 */
export function useUrlState<T>(
  initial: T,
  options: UseUrlStateOptions<T> = {},
): {
  state: T;
  setState: (next: T | ((prev: T) => T)) => void;
  shareHash: string;
  hydrateFromHash: () => T | null;
} {
  const key = options.key ?? DEFAULT_HASH_KEY;
  const [state, setStateInternal] = useState<T>(initial);

  const hydrateFromHash = useCallback((): T | null => {
    const encoded = readHashParam(key);
    if (!encoded) return null;
    return decodeUrlState<T>(encoded);
  }, [key]);

  useEffect(() => {
    const hydrated = hydrateFromHash();
    if (hydrated !== null) {
      setStateInternal(hydrated);
      options.onHydrate?.(hydrated);
    }
    // Intentional mount-only hydrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once
  }, []);

  const setState = useCallback(
    (next: T | ((prev: T) => T)) => {
      setStateInternal((prev) => {
        const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        writeHashParam(key, encodeUrlState(value));
        return value;
      });
    },
    [key],
  );

  const shareHash = `#${key}=${encodeUrlState(state)}`;

  return { state, setState, shareHash, hydrateFromHash };
}

/** Build a full share URL with lz-string hash fallback (no API). */
export function buildHashShareUrl(data: unknown, origin?: string): string {
  const base =
    origin ??
    (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');
  return `${base}#${DEFAULT_HASH_KEY}=${encodeUrlState(data)}`;
}

/** Short-link path aligned with API `url` field (`/s/:slug`). */
export function buildShortSharePath(slug: string): string {
  return `/s/${slug}`;
}

/** Absolute short-link URL for clipboard / share modal. */
export function buildShortShareUrl(slug: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base.replace(/\/$/, '')}${buildShortSharePath(slug)}`;
}

export function resolveApiBase(override?: string): string {
  if (override !== undefined) return override.replace(/\/$/, '');
  const fromEnv =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_API_URL === 'string'
      ? import.meta.env.VITE_API_URL
      : '';
  // Empty → same-origin (`/api` via Vite proxy in dev).
  return fromEnv.replace(/\/$/, '');
}

/** Detect share boot intent from the current location. */
export type ShareBootIntent =
  | { kind: 'hash'; encoded: string }
  | { kind: 'slug'; slug: string }
  | { kind: 'none' };

/**
 * Parse `#s=` (lz), `?s=` (slug), or `/s/:slug` from a Location-like object.
 * Priority: path slug → query slug → hash payload.
 */
export function parseShareBootIntent(
  loc: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
): ShareBootIntent {
  const pathMatch = loc.pathname.match(/\/s\/([0-9a-zA-Z_-]{4,})\/?$/);
  if (pathMatch?.[1]) {
    return { kind: 'slug', slug: pathMatch[1] };
  }

  const params = new URLSearchParams(loc.search);
  const queryS = params.get('s');
  if (queryS) {
    // Prefer slug shape; fall back to treating as lz if it looks encoded.
    if (/^[0-9a-zA-Z_-]{4,16}$/.test(queryS)) {
      return { kind: 'slug', slug: queryS };
    }
    return { kind: 'hash', encoded: queryS };
  }

  const hashEncoded = (() => {
    const raw = loc.hash.replace(/^#/, '');
    if (!raw) return null;
    if (raw.includes('=')) {
      const eq = raw.indexOf('=');
      const k = raw.slice(0, eq);
      if (k === DEFAULT_HASH_KEY) return raw.slice(eq + 1);
      for (const part of raw.split('&')) {
        const i = part.indexOf('=');
        if (i >= 0 && part.slice(0, i) === DEFAULT_HASH_KEY) {
          return part.slice(i + 1);
        }
      }
      return null;
    }
    return raw;
  })();

  if (hashEncoded) {
    return { kind: 'hash', encoded: hashEncoded };
  }

  return { kind: 'none' };
}

/** Soft-parse unknown JSON into a SharePayload; returns null if invalid. */
export function parseSharePayload(data: unknown): SharePayload | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;

  // API may store either SharePayload or bare ScenarioState under `data`.
  let scenarioRaw = record.scenario;
  let whatIf = record.whatIf as WhatIfInputs | undefined;
  let activeLayers = record.activeLayers as FlowLayer[] | undefined;

  if (!scenarioRaw && 'id' in record && 'entities' in record) {
    scenarioRaw = data;
  }

  if (!scenarioRaw) return null;

  try {
    const scenario: ScenarioState = parseScenarioState(scenarioRaw);
    return {
      scenario,
      ...(whatIf && typeof whatIf === 'object' ? { whatIf } : {}),
      ...(Array.isArray(activeLayers) ? { activeLayers } : {}),
    };
  } catch {
    return null;
  }
}

export async function fetchScenarioBySlug(
  slug: string,
  apiBase?: string,
): Promise<SharePayload | null> {
  const base = resolveApiBase(apiBase);
  const endpoint = `${base}/api/scenarios/${encodeURIComponent(slug)}`;
  const res = await fetch(endpoint);
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: unknown };
  return parseSharePayload(body.data);
}

/**
 * Boot-time hydrate: `#s=` lz hash, `?s=` slug (or lz), `/s/:slug`.
 * Returns the payload applied, or null when nothing to load / failure.
 */
export async function resolveShareBootPayload(
  loc: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
  apiBase?: string,
): Promise<SharePayload | null> {
  const intent = parseShareBootIntent(loc);
  if (intent.kind === 'none') return null;

  if (intent.kind === 'hash') {
    const decoded = decodeUrlState<unknown>(intent.encoded);
    return parseSharePayload(decoded);
  }

  try {
    return await fetchScenarioBySlug(intent.slug, apiBase);
  } catch {
    return null;
  }
}
