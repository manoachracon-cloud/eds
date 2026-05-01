# Esthetic Diamonds & Spa — Réservation en ligne

Version propre prête pour GitHub + Vercel.

## Structure correcte

À la racine du dépôt GitHub, tu dois voir :

```txt
app/
components/
docs/
lib/
public/
supabase/
package.json
vercel.json
```

## Déploiement Vercel

Framework : Next.js  
Build Command : `npm run build`  
Install Command : `npm install`  
Output Directory : vide  
Root Directory : vide  

## Mode démo

Le mode démo est activé dans `.env.production.example` :

```env
NEXT_PUBLIC_DEMO_MODE=true
```

Cela permet de voir la plateforme sans configurer Supabase tout de suite.

## Admin

URL après déploiement :

```txt
/admin
```

## Healthcheck

```txt
/api/health?secret=secret-test-123
```
