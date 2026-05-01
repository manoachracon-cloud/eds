# Intégration finale — estheticdiamonds.fr

## Décision recommandée

Ne pas intégrer cette plateforme comme un simple bloc HTML dans le site existant.

La version finale est une application Next.js complète. Elle doit être déployée séparément, puis reliée au site `estheticdiamonds.fr`.

## Option recommandée : sous-domaine

Créer un sous-domaine :

```txt
reservation.estheticdiamonds.fr
```

Puis faire pointer ce sous-domaine vers Vercel.

Avantages :

- plus propre ;
- plus sécurisé ;
- plus rapide à déployer ;
- ne casse pas le site existant ;
- permet d’avoir `/admin` séparé ;
- permet d’utiliser Stripe, Supabase, Google Calendar, WhatsApp et les cron correctement.

## Intégration dans le site actuel

Sur le site `estheticdiamonds.fr`, ajouter des boutons :

```txt
Réserver un rendez-vous
```

Lien :

```txt
https://reservation.estheticdiamonds.fr
```

Et pour les cartes cadeaux :

```txt
https://reservation.estheticdiamonds.fr/cartes-cadeaux
```

## Pages à relier depuis le site

```txt
Accueil du site → bouton Réserver
Prestations → bouton Réserver cette prestation
Aqua-sports → bouton Réserver une séance Aqua-sports
Fête des Mères / offres → bouton Acheter une carte cadeau
Footer → lien Réservation en ligne
Instagram / TikTok / Facebook / Google Business → lien réservation
```

## Option alternative : domaine principal avec chemin /reservation

Possible mais moins simple :

```txt
https://estheticdiamonds.fr/reservation
```

Cette option nécessite un reverse proxy ou une configuration d’hébergement avancée. Elle est déconseillée si le site actuel est sur un CMS ou un constructeur de site.

## Option iframe

Possible mais déconseillée.

Exemple :

```html
<iframe
  src="https://reservation.estheticdiamonds.fr"
  style="width:100%; min-height:900px; border:0; border-radius:24px;"
  loading="lazy"
></iframe>
```

Limites :

- moins propre sur mobile ;
- moins bon pour l’expérience utilisateur ;
- problèmes possibles avec Stripe, cookies, sécurité et navigation ;
- moins professionnel qu’un vrai sous-domaine.

## Ordre de mise en ligne

1. Déployer l’application sur Vercel.
2. Configurer les variables d’environnement.
3. Exécuter les migrations Supabase.
4. Créer le compte super admin.
5. Configurer Resend.
6. Configurer Stripe.
7. Configurer Google Calendar.
8. Configurer WhatsApp si activé.
9. Tester `/api/health`.
10. Tester une réservation complète.
11. Ajouter les boutons sur `estheticdiamonds.fr`.
12. Remplacer les liens Instagram / réseaux sociaux par le lien de réservation.

## URL admin

```txt
https://reservation.estheticdiamonds.fr/admin
```

## URL healthcheck

```txt
https://reservation.estheticdiamonds.fr/api/health?secret=VOTRE_HEALTHCHECK_SECRET
```

## Important

Cette plateforme est prête côté code, mais elle ne peut pas fonctionner en production sans :

- projet Supabase configuré ;
- migrations SQL exécutées ;
- variables d’environnement remplies ;
- compte admin créé ;
- domaine ou sous-domaine branché ;
- services externes configurés selon les modules activés.
