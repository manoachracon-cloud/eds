"use client";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-shell">
      <div className="page-message">
        <div className="brand-mark">◆</div>
        <div className="eyebrow">Erreur temporaire</div>
        <h1>Une erreur est survenue.</h1>
        <p>
          La plateforme n’a pas pu charger cette page correctement. Vous pouvez réessayer ou revenir à l’accueil.
        </p>
        {error?.message && (
          <p className="muted" style={{ fontSize: 13 }}>
            Détail technique : {error.message}
          </p>
        )}
        <div className="actions">
          <button className="btn btn-primary" onClick={reset}>
            Réessayer
          </button>
          <a className="btn btn-light" href="/">
            Retour à l’accueil
          </a>
        </div>
      </div>
    </main>
  );
}
