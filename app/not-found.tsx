export default function NotFound() {
  return (
    <main className="page-shell">
      <div className="page-message">
        <div className="brand-mark">◆</div>
        <div className="eyebrow">Page introuvable</div>
        <h1>Cette page n’existe pas.</h1>
        <p>
          Le lien est peut-être incorrect ou la page a été déplacée. Retournez à la réservation pour continuer.
        </p>
        <div className="actions">
          <a className="btn btn-primary" href="/">
            Retour à la réservation
          </a>
          <a className="btn btn-light" href="/cartes-cadeaux">
            Voir les cartes cadeaux
          </a>
        </div>
      </div>
    </main>
  );
}
