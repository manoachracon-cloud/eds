# Variables d’environnement — Esthetic Diamonds & Spa

## Obligatoires

```env
NEXT_PUBLIC_APP_URL=https://reservation.estheticdiamonds.fr
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx

RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL="Esthetic Diamonds & Spa <reservation@estheticdiamonds.fr>"
INTERNAL_NOTIFICATION_EMAIL=contact@estheticdiamonds.fr

CRON_SECRET=valeur-longue-secrete
HEALTHCHECK_ENABLED=true
HEALTHCHECK_SECRET=valeur-longue-secrete
```

## Stripe

```env
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_CURRENCY=eur
```

## Google Calendar

```env
GOOGLE_CALENDAR_ENABLED=true
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=calendar_id@group.calendar.google.com
```

## WhatsApp

```env
WHATSAPP_ENABLED=true
WHATSAPP_GRAPH_API_VERSION=v22.0
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_INTERNAL_TO=590690000000
WHATSAPP_INTERNAL_MODE=text
WHATSAPP_TEMPLATE_NAME=internal_booking_notification
WHATSAPP_TEMPLATE_LANGUAGE=fr
```

## Rappels

```env
REMINDERS_ENABLED=true
REMINDER_WINDOW_MINUTES=35
```

## Cartes cadeaux

```env
GIFT_CARDS_ENABLED=true
GIFT_CARD_DEFAULT_EXPIRY_MONTHS=12
GIFT_CARD_REDEMPTION_ENABLED=true
```

## Aqua-sports

```env
AQUASPORT_GROUP_NOTIFICATIONS_ENABLED=true
AQUASPORT_WAITLIST_AUTO_NOTIFY_ENABLED=true
```

## Reprise d’erreur

```env
ERROR_RECOVERY_ENABLED=true
ERROR_RECOVERY_MAX_RETRIES=3
```

## Production readiness

```env
NEXT_PUBLIC_ENABLE_STATUS_PAGE=true
```


## UX polish / démonstration

```env
NEXT_PUBLIC_DEMO_MODE=false
```

Utiliser `true` uniquement pour une présentation démo sans base Supabase complète.


## Sécurité admin

```env
ADMIN_ACCESS_ENABLED=true
NEXT_PUBLIC_SECURITY_PERMISSIONS_ENABLED=true
```

`ADMIN_ACCESS_ENABLED=false` bloque l’accès `/admin` via middleware.
