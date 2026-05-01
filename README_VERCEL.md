# Esthetic Diamonds & Spa — Version Vercel-ready

Cette version est prête à être importée dans Vercel.

## Ce que contient cette version

- Application Next.js complète.
- `vercel.json` configuré.
- Cron Vercel pour les rappels.
- Headers de sécurité.
- `.vercelignore`.
- Documentation Vercel.
- Variables production.
- Documentation d’intégration au site `estheticdiamonds.fr`.

## Fichiers importants

```txt
vercel.json
.vercelignore
.env.production.example
README_FINAL.md
README_VERCEL.md
docs/VERCEL_DEPLOYMENT_DIRECT.md
docs/VERCEL_ENV_MINIMUM.md
docs/QUICK_START_VERCEL.md
docs/INTEGRATION_ESTHETICDIAMONDS_FR.md
docs/SQL_INSTALL_ORDER.md
```

## URL recommandée

```txt
https://reservation.estheticdiamonds.fr
```

## Admin

```txt
https://reservation.estheticdiamonds.fr/admin
```

## Healthcheck

```txt
https://reservation.estheticdiamonds.fr/api/health?secret=VOTRE_HEALTHCHECK_SECRET
```

## Point important

Vercel héberge l’application.

Supabase reste obligatoire pour :

- base de données ;
- authentification ;
- règles de sécurité ;
- back-office ;
- réservations ;
- cartes cadeaux ;
- clients ;
- notifications.
