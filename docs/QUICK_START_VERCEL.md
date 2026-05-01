# Démarrage rapide Vercel

## 1. Déploiement rapide

```bash
npm install
npm run build
```

Si le build passe localement, pousse sur GitHub puis importe dans Vercel.

## 2. Dans Vercel

Framework :

```txt
Next.js
```

Commandes :

```txt
Install Command: npm install
Build Command: npm run build
Output Directory: vide
```

## 3. Variables

Copier les variables depuis :

```txt
.env.production.example
docs/VERCEL_ENV_MINIMUM.md
```

## 4. Supabase

Exécuter les migrations dans :

```txt
docs/SQL_INSTALL_ORDER.md
```

## 5. Créer le super admin

Dans Supabase SQL Editor :

```sql
insert into public.user_profiles (
  user_id,
  role,
  first_name,
  last_name,
  is_active
)
values (
  'UUID_DU_COMPTE_AUTH',
  'super_admin',
  'Admin',
  'Esthetic Diamonds',
  true
);
```

## 6. Tester

```txt
/admin
/api/health?secret=VOTRE_SECRET
```
