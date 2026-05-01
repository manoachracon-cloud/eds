# À LIRE — Dossier prêt pour Vercel

Ce dossier est prêt.

Tu ne dois modifier aucun fichier de code.

## Ce que tu dois faire

1. Va sur GitHub.
2. Crée un nouveau dépôt vide nommé :

```txt
esthetic-diamonds-reservation
```

3. Clique sur **Add file → Upload files**.
4. Ouvre ce dossier sur ton ordinateur.
5. Sélectionne **TOUS les fichiers et dossiers à l'intérieur**.
6. Upload dans GitHub.
7. Clique sur **Commit changes**.

Quand tu regardes GitHub, tu dois voir directement :

```txt
app
components
docs
lib
public
supabase
package.json
vercel.json
```

Tu ne dois pas voir un gros dossier contenant tout ça.

## Ensuite dans Vercel

1. Add New Project.
2. Import GitHub Repository.
3. Sélectionne `esthetic-diamonds-reservation`.
4. Framework : Next.js.
5. Root Directory : vide.
6. Output Directory : vide.
7. Build Command : `npm run build`.
8. Install Command : `npm install`.

## Variables Vercel

Pour démarrer vite, copie les variables du fichier :

```txt
.env.production.example
```

Le site est en mode démo au départ :

```env
NEXT_PUBLIC_DEMO_MODE=true
```

Comme ça, il peut s'afficher sans Supabase complet.

## Après

Quand le site s'affiche correctement, on remplacera les valeurs de démonstration par les vraies valeurs Supabase, Resend, Stripe, Google Calendar et WhatsApp.
