# Ordre d’installation SQL

Exécuter les fichiers dans Supabase SQL Editor dans cet ordre strict :

```txt
supabase/01_schema_v1.sql
supabase/02_availability_rpc.sql
supabase/03_google_calendar.sql
supabase/04_whatsapp.sql
supabase/05_reminders.sql
supabase/06_client_management.sql
supabase/07_stripe_payments.sql
supabase/08_gift_cards.sql
supabase/09_gift_card_redemption.sql
supabase/10_analytics.sql
supabase/11_services_admin.sql
supabase/12_employees_admin.sql
supabase/13_business_hours_admin.sql
supabase/14_resources_admin.sql
supabase/15_aquasport_admin.sql
supabase/16_aquasport_notifications.sql
supabase/17_notification_center.sql
supabase/18_error_recovery.sql
supabase/19_production_readiness.sql
supabase/20_ux_polish.sql
supabase/21_security_permissions.sql
```

Important :

`02_availability_rpc.sql` a été enrichi dans les versions successives.  
Il faut exécuter la version présente dans ce package V1.18.

## Après installation

Créer un compte admin dans Supabase Auth, puis créer le profil :

```sql
insert into public.user_profiles (user_id, role, display_name)
values ('UUID_AUTH_USER_ICI', 'super_admin', 'Admin Esthetic Diamonds');
```

## Vérification rapide

```sql
select * from public.platform_operational_summary;
```
