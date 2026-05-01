# Esthetic Diamonds & Spa — Plateforme de réservation finale

Version finale prête à déployer pour intégration au site `estheticdiamonds.fr`.

## Recommandation d’intégration

Déployer cette application sur :

```txt
https://reservation.estheticdiamonds.fr
```

Puis ajouter des boutons sur le site principal `estheticdiamonds.fr`.

## Pourquoi un sous-domaine ?

La plateforme contient :

- tunnel de réservation ;
- back-office admin ;
- Supabase Auth ;
- Stripe ;
- Google Calendar ;
- WhatsApp Business ;
- cron de rappels ;
- cartes cadeaux ;
- Aqua-sports ;
- centre de notifications ;
- rôles et permissions.

Ce n’est pas un simple bloc HTML. Le sous-domaine est la solution la plus propre et la plus fiable.

## Pages principales

```txt
/                       Réservation client
/cartes-cadeaux         Cartes cadeaux
/admin                  Back-office
/api/health             Healthcheck technique
```

## Installation locale

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## Déploiement production

1. Déployer sur Vercel.
2. Configurer les variables de `.env.production.example`.
3. Créer le projet Supabase.
4. Exécuter les migrations SQL dans l’ordre.
5. Créer le compte `super_admin`.
6. Brancher le sous-domaine `reservation.estheticdiamonds.fr`.
7. Tester `/api/health`.
8. Ajouter les boutons sur `estheticdiamonds.fr`.

## Documents importants

```txt
docs/INTEGRATION_ESTHETICDIAMONDS_FR.md
docs/FINAL_LAUNCH_CHECKLIST.md
docs/BOUTONS_SITE_EXISTANT.html
docs/ENVIRONMENT_VARIABLES.md
docs/SQL_INSTALL_ORDER.md
docs/PRODUCTION_TEST_PLAN.md
docs/SECURITY_PERMISSIONS.md
```

## Variables production

Voir :

```txt
.env.production.example
```

## Statut

Code prêt pour déploiement.

À faire côté hébergement :

- configurer Supabase ;
- configurer Vercel ;
- configurer les variables ;
- brancher le domaine ;
- tester les modules.
