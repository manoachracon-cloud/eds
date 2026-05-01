# Déploiement direct sur Vercel — Esthetic Diamonds & Spa

## Méthode recommandée

Vercel fonctionne mieux avec GitHub.

Le bon processus est :

```txt
1. Dézipper le dossier
2. Créer un repository GitHub
3. Envoyer le code sur GitHub
4. Importer le repository dans Vercel
5. Ajouter les variables d’environnement
6. Déployer
7. Brancher reservation.estheticdiamonds.fr
```

## Étape 1 — Dézipper

Dézippe le fichier :

```txt
esthetic-diamonds-vercel-ready.zip
```

## Étape 2 — Créer un repo GitHub

Nom recommandé :

```txt
esthetic-diamonds-reservation
```

## Étape 3 — Envoyer le dossier sur GitHub

Depuis le dossier du projet :

```bash
git init
git add .
git commit -m "Initial production version"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/esthetic-diamonds-reservation.git
git push -u origin main
```

## Étape 4 — Importer dans Vercel

Dans Vercel :

```txt
Add New Project
→ Import Git Repository
→ Sélectionner esthetic-diamonds-reservation
→ Framework Preset : Next.js
→ Build Command : npm run build
→ Output Directory : laisser vide
→ Install Command : npm install
```

## Étape 5 — Ajouter les variables d’environnement

Dans Vercel :

```txt
Project Settings
→ Environment Variables
→ Ajouter les variables de .env.production.example
```

Minimum obligatoire pour démarrer :

```env
NEXT_PUBLIC_APP_URL=https://reservation.estheticdiamonds.fr
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
INTERNAL_NOTIFICATION_EMAIL=
CRON_SECRET=
HEALTHCHECK_SECRET=
```

## Étape 6 — Déployer

Après avoir ajouté les variables :

```txt
Deploy
```

Si Vercel affiche une erreur, lire les logs de build.

## Étape 7 — Brancher le domaine

Dans Vercel :

```txt
Project Settings
→ Domains
→ Add
→ reservation.estheticdiamonds.fr
```

Ensuite, chez le fournisseur DNS de `estheticdiamonds.fr`, ajouter l’entrée demandée par Vercel.

Vercel donnera généralement une entrée de type :

```txt
CNAME reservation cname.vercel-dns.com
```

ou une configuration équivalente.

## Étape 8 — Tester

Tester :

```txt
https://reservation.estheticdiamonds.fr
https://reservation.estheticdiamonds.fr/admin
https://reservation.estheticdiamonds.fr/api/health?secret=VOTRE_HEALTHCHECK_SECRET
```

## Étape 9 — Relier au site existant

Sur `estheticdiamonds.fr`, ajouter un bouton :

```html
<a href="https://reservation.estheticdiamonds.fr">
  Réserver un rendez-vous
</a>
```

Et un bouton carte cadeau :

```html
<a href="https://reservation.estheticdiamonds.fr/cartes-cadeaux">
  Acheter une carte cadeau
</a>
```

## Important

Cette application ne fonctionnera pas correctement sans Supabase configuré et sans migrations SQL exécutées.

Vercel héberge le code, mais la base de données et l’authentification sont dans Supabase.
