/**
 * Suivi d'erreurs (Sentry) et audience (Plausible), tous deux inactifs sans variable d'env.
 * Le scénario vit dans le hash de l'URL : il ne doit jamais quitter le navigateur,
 * donc toute URL est amputée de son hash avant envoi.
 */
type Reporter = (error: unknown) => void;
let report: Reporter = () => {};

const stripHash = (url: string) => url.split('#')[0];

export function reportError(error: unknown) {
  report(error);
}

export function initObservability() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn) {
    void import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        beforeSend(event) {
          if (event.request?.url) event.request.url = stripHash(event.request.url);
          return event;
        },
        beforeBreadcrumb(crumb) {
          if (crumb.category === 'navigation') return null;
          if (typeof crumb.data?.url === 'string') crumb.data.url = stripHash(crumb.data.url);
          return crumb;
        },
      });
      report = (error) => Sentry.captureException(error);
    });
  }

  // URL du script propre au site (Plausible → Site installation), ex. https://plausible.io/js/pa-XXXX.js
  const plausibleSrc = import.meta.env.VITE_PLAUSIBLE_SRC;
  if (plausibleSrc) {
    const w = window as unknown as { plausible?: { (...a: unknown[]): void; q?: unknown[]; o?: object; init?: (o?: object) => void } };
    w.plausible ??= function (...args: unknown[]) {
      (w.plausible!.q ??= []).push(args);
    };
    w.plausible.init ??= (o) => {
      w.plausible!.o = o ?? {};
    };
    w.plausible.init();
    const script = document.createElement('script');
    script.async = true;
    script.src = plausibleSrc;
    document.head.append(script);
  }
}
