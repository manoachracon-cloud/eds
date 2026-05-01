export default function Loading() {
  return (
    <main className="page-shell">
      <div className="page-message">
        <div className="brand-mark">◆</div>
        <div className="eyebrow">Chargement</div>
        <h1>Préparation de votre expérience.</h1>
        <p>La plateforme charge les informations nécessaires.</p>
        <div style={{ marginTop: 28 }}>
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      </div>
    </main>
  );
}
