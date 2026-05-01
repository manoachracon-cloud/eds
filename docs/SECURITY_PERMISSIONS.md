# Sécurité & permissions — V1.20

## Objectif

La V1.20 ajoute une vraie couche de sécurité opérationnelle :

- permissions par rôle ;
- sections admin filtrées ;
- vérification serveur sur les routes API sensibles ;
- middleware avec headers de sécurité ;
- fonctions Supabase tenant compte de `is_active` ;
- table `role_permissions` ;
- table `security_events` ;
- documentation des accès.

## Rôles disponibles

```txt
super_admin
admin
reception
employee_esthetic
coach_aquasport
```

## Accès par rôle

### super_admin

Accès total :

- sécurité ;
- paramètres ;
- production readiness ;
- prestations ;
- employés ;
- ressources ;
- horaires ;
- Aqua-sports ;
- notifications ;
- statistiques.

### admin

Accès opérationnel complet, sauf sécurité avancée.

### reception

Accès orienté accueil :

- dashboard ;
- planning ;
- réservations ;
- demandes de modification ;
- clients ;
- cartes cadeaux ;
- notifications.

### employee_esthetic

Accès limité :

- dashboard ;
- planning ;
- réservations ;
- clients.

### coach_aquasport

Accès limité :

- dashboard ;
- planning ;
- Aqua-sports ;
- clients.

## Routes API protégées

Les routes suivantes exigent un token Supabase valide et un rôle autorisé :

```txt
POST /api/bookings/update-status
POST /api/aquasport/update-class
POST /api/aquasport/update-attendance
POST /api/notifications/retry
POST /api/notifications/resolve
```

Le token est envoyé côté admin via :

```txt
Authorization: Bearer <supabase_access_token>
```

## Routes publiques qui restent publiques

Les routes suivantes restent publiques volontairement :

```txt
POST /api/bookings/create
POST /api/bookings/manage
POST /api/payments/create-checkout-session
POST /api/gift-cards/create-checkout-session
POST /api/aquasport/book-class
POST /api/aquasport/waitlist
POST /api/stripe/webhook
GET /api/health avec secret
POST /api/cron/reminders avec secret
```

## Middleware

Le fichier :

```txt
middleware.ts
```

ajoute des headers de sécurité :

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

Il peut aussi bloquer `/admin` si :

```env
ADMIN_ACCESS_ENABLED=false
```

## Supabase RLS

La migration V1.20 met à jour :

```txt
current_user_role()
is_staff()
is_admin()
is_super_admin()
```

Les fonctions ne considèrent plus les profils inactifs.

Un compte avec `is_active = false` perd donc ses droits.

## Créer un utilisateur admin

1. Créer l’utilisateur dans Supabase Auth.
2. Copier son UUID.
3. Insérer le profil :

```sql
insert into public.user_profiles (
  user_id,
  role,
  first_name,
  last_name,
  is_active
)
values (
  'UUID_AUTH_USER_ICI',
  'super_admin',
  'Admin',
  'Esthetic Diamonds',
  true
);
```

## Désactiver un accès

```sql
update public.user_profiles
set is_active = false
where user_id = 'UUID_AUTH_USER_ICI';
```

## Bonne pratique

- Donner `super_admin` uniquement au propriétaire.
- Donner `admin` uniquement aux responsables.
- Donner `reception` à l’accueil.
- Donner `employee_esthetic` aux praticiennes.
- Donner `coach_aquasport` aux coachs.
- Ne jamais partager `SUPABASE_SERVICE_ROLE_KEY`.
- Activer la double authentification côté Supabase Auth si disponible.
