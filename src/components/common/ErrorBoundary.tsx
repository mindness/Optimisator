import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Dernier filet avant l'écran blanc : une erreur de rendu (canvas, moteur,
 * scénario corrompu en storage) affiche un message et une sortie de secours.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur de rendu non rattrapée', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="flex min-h-dvh flex-col items-start gap-4 bg-canvas p-6 text-fg">
        <h1 className="m-0 text-xl font-semibold">Le simulateur s&apos;est arrêté</h1>
        <p className="m-0 max-w-prose text-sm text-fg-muted">
          Une erreur a interrompu l&apos;affichage. Vos données restent dans ce navigateur ;
          recharger suffit le plus souvent. Si l&apos;erreur revient, repartez d&apos;un scénario neuf.
        </p>
        <pre className="m-0 max-w-full overflow-auto border border-border p-3 text-xs">{error.message}</pre>
        <div className="flex gap-2">
          <button
            type="button"
            className="border border-border-strong px-3 py-1.5 text-sm hover:border-fg"
            onClick={() => window.location.reload()}
          >
            Recharger
          </button>
          <button
            type="button"
            className="border border-border px-3 py-1.5 text-sm hover:border-border-strong"
            onClick={() => {
              // Un brouillon invalide en localStorage rejouerait l'erreur à chaque chargement.
              try {
                localStorage.clear();
              } catch {
                /* mode privé : rien à purger */
              }
              window.location.assign(window.location.pathname);
            }}
          >
            Repartir d&apos;un scénario neuf
          </button>
        </div>
      </div>
    );
  }
}
