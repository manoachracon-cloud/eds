# Checklist de déploiement — Esthetic Diamonds & Spa

## 1. Supabase

- Créer un projet Supabase production.
- Copier `NEXT_PUBLIC_SUPABASE_URL`.
- Copier la clé publishable / anon.
- Copier `SUPABASE_SERVICE_ROLE_KEY`.
- Exécuter toutes les migrations SQL dans l’ordre.
- Créer un utilisateur admin dans Supabase Auth.
- Créer le profil admin dans `user_profiles`.

Exemple :

```sql
insert into public.user_profiles (user_id, role, display_name)
values ('UUID_AUTH_USER_ICI', 'super_admin', 'Admin Esthetic Diamonds');
```

## 2. Vercel

- Créer le projet Vercel.
- Connecter le repository.
- Ajouter toutes les variables d’environnement.
- Définir le domaine de production.
- Vérifier `NEXT_PUBLIC_APP_URL`.
- Déployer.
- Vérifier `/api/health`.

## 3. Resend

- Vérifier le domaine d’envoi.
- Configurer `RESEND_API_KEY`.
- Configurer `RESEND_FROM_EMAIL`.
- Tester une réservation.
- Vérifier l’e-mail client.
- Vérifier la notification interne.

## 4. Stripe

- Configurer `STRIPE_ENABLED=true`.
- Configurer `STRIPE_SECRET_KEY`.
- Configurer le webhook vers :

```txt
https://votre-domaine.fr/api/stripe/webhook
```

- Configurer `STRIPE_WEBHOOK_SECRET`.
- Tester une réservation avec acompte.
- Tester une carte cadeau.
- Vérifier le statut `paid`.

## 5. Google Calendar

- Créer un service account Google Cloud.
- Activer Google Calendar API.
- Récupérer `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
- Récupérer `GOOGLE_PRIVATE_KEY`.
- Partager le calendrier avec l’e-mail du service account.
- Configurer `GOOGLE_CALENDAR_ID`.
- Tester une réservation.
- Vérifier l’événement créé.

## 6. WhatsApp Business

- Configurer WhatsApp Business Cloud API.
- Configurer `WHATSAPP_PHONE_NUMBER_ID`.
- Configurer `WHATSAPP_ACCESS_TOKEN`.
- Configurer `WHATSAPP_INTERNAL_TO`.
- Tester une notification interne.
- Prévoir des templates Meta validés pour les messages clients.

## 7. Cron Vercel

- Vérifier `vercel.json`.
- Configurer `CRON_SECRET`.
- Vérifier `/api/cron/reminders`.
- Tester les rappels 24h / 2h.

## 8. Tests métier

- Réservation esthétique simple.
- Réservation Aqua-sports.
- Annulation client.
- Demande de modification client.
- Paiement Stripe.
- Carte cadeau.
- Utilisation carte cadeau.
- Liste d’attente Aqua-sports.
- Notification groupée Aqua-sports.
- Relance d’une notification échouée.

## 9. Avant ouverture client

- Vérifier les horaires.
- Vérifier les employés.
- Vérifier les ressources.
- Vérifier les prestations.
- Vérifier les prix.
- Vérifier les mentions RGPD.
- Vérifier les textes e-mails.
- Vérifier le centre de notifications.
