# Variables minimum à ajouter dans Vercel

Pour afficher la plateforme sans activer tous les modules externes :

```env
NEXT_PUBLIC_APP_URL=https://reservation.estheticdiamonds.fr

NEXT_PUBLIC_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=VOTRE_CLE_PUBLISHABLE
SUPABASE_SERVICE_ROLE_KEY=VOTRE_SERVICE_ROLE_KEY

RESEND_API_KEY=VOTRE_CLE_RESEND
RESEND_FROM_EMAIL="Esthetic Diamonds & Spa <reservation@estheticdiamonds.fr>"
INTERNAL_NOTIFICATION_EMAIL=contact@estheticdiamonds.fr

CRON_SECRET=VOTRE_SECRET_LONG
HEALTHCHECK_ENABLED=true
HEALTHCHECK_SECRET=VOTRE_SECRET_LONG

ADMIN_ACCESS_ENABLED=true
NEXT_PUBLIC_SECURITY_PERMISSIONS_ENABLED=true
NEXT_PUBLIC_DEMO_MODE=false
```

## Désactiver temporairement les modules non configurés

Tu peux mettre :

```env
STRIPE_ENABLED=false
GOOGLE_CALENDAR_ENABLED=false
WHATSAPP_ENABLED=false
```

Cela permet de déployer plus vite, puis d’activer les modules un par un.
