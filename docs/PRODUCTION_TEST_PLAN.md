# Plan de test production

## Test 1 — Healthcheck

- Ouvrir `/api/health?secret=VOTRE_SECRET`.
- Vérifier que le statut est `ok` ou `warning`.
- Corriger toute intégration en `error`.

## Test 2 — Connexion admin

- Ouvrir `/admin`.
- Se connecter avec le compte admin.
- Vérifier les sections :
  - Tableau de bord ;
  - Prestations ;
  - Employés ;
  - Horaires ;
  - Ressources ;
  - Aqua-sports ;
  - Notifications ;
  - Statut production.

## Test 3 — Réservation esthétique

- Choisir une prestation esthétique.
- Choisir une date.
- Choisir un créneau.
- Remplir les informations client.
- Confirmer.
- Vérifier :
  - création dans `bookings` ;
  - e-mail client ;
  - notification interne ;
  - Google Calendar si activé ;
  - centre de notifications.

## Test 4 — Paiement Stripe

- Configurer une prestation en acompte obligatoire.
- Réserver.
- Payer via Stripe.
- Vérifier :
  - `payment_status = paid` ;
  - ligne dans `payments` ;
  - e-mail paiement ;
  - webhook Stripe reçu.

## Test 5 — Carte cadeau

- Acheter une carte cadeau.
- Vérifier :
  - `gift_cards.status = active` après paiement ;
  - e-mail acheteur ;
  - e-mail bénéficiaire.
- Utiliser le code dans une réservation.
- Vérifier :
  - déduction ;
  - `gift_card_redemptions` ;
  - solde restant.

## Test 6 — Aqua-sports

- Créer une séance Aqua-sports.
- Réserver une place côté client.
- Vérifier :
  - participant ajouté ;
  - compteur de places ;
  - e-mail client.
- Marquer présent / absent.
- Tester liste d’attente si complet.

## Test 7 — Annulation Aqua-sports

- Annuler une séance depuis l’admin.
- Vérifier :
  - séance `cancelled` ;
  - réservations liées annulées ;
  - e-mails participants ;
  - notification interne.

## Test 8 — Relance d’erreur

- Créer ou provoquer une notification échouée.
- Ouvrir `/admin > Notifications`.
- Cliquer sur “Relancer”.
- Vérifier :
  - nouvelle notification créée ;
  - ancienne notification marquée résolue si réussite ;
  - retry_count incrémenté.

## Test 9 — Cron rappels

- Vérifier `vercel.json`.
- Simuler ou attendre le cron.
- Vérifier la création de notifications de rappel.
