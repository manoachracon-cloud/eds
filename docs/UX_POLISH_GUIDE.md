# UX polish — V1.19

## Objectif

La V1.19 améliore la perception produit sans changer le cœur fonctionnel.

Elle ajoute :

- états vides premium ;
- skeleton loading ;
- messages d’erreur plus propres ;
- page 404 ;
- page erreur globale ;
- page chargement globale ;
- mode démonstration ;
- microcopy plus rassurante côté client ;
- styles responsive renforcés.

## Mode démonstration

Activer :

```env
NEXT_PUBLIC_DEMO_MODE=true
```

Effet :

- la page publique utilise des prestations fictives ;
- aucune lecture Supabase n’est obligatoire côté catalogue ;
- le tunnel simule une réservation ;
- un ruban “Mode démonstration” s’affiche.

À désactiver en production réelle :

```env
NEXT_PUBLIC_DEMO_MODE=false
```

## Composants ajoutés

```txt
components/ui/Polish.tsx
```

Contient :

- `EmptyState`
- `SkeletonCard`
- `SkeletonGrid`
- `PremiumNotice`
- `DemoBadge`

## Pages ajoutées

```txt
app/not-found.tsx
app/error.tsx
app/loading.tsx
```

## Données démo

```txt
lib/demoData.ts
```

Contient :

- catégories fictives ;
- prestations fictives ;
- employés fictifs ;
- séances Aqua-sports fictives.

## Recommandation

Utiliser le mode démo pour présenter la plateforme à un client avant configuration Supabase complète.

Ne jamais laisser le mode démo activé sur le domaine final client.
