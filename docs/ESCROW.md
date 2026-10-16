# Séquestre (eskrow) Vendza — comment l'argent circule

```
Acheteur paie (Bazik/MonCash ou Stripe)
   └─► webhook signé / session Stripe vérifiée
         └─► creerCommandeApresPaiement()
               1. enregistre le paiement dans `verified_payments` (écrit UNIQUEMENT par le serveur)
               2. crée la/les commande(s) en statut `payee` (+ crédit du portefeuille « en séquestre »)
Livraison
   ├─ le VENDEUR affiche un QR : GET /api/orders/:id/delivery-code  →  https://www.vendza.store/?confirm=<id>&code=<CODE>
   └─ l'ACHETEUR le scanne (ou clique « Confirmer la réception ») : POST /api/orders/confirm-delivery
         vérifie : jeton Supabase = acheteur · statut `payee` · code (s'il est fourni) · paiement vérifié (+ montant)
         transition atomique `payee → completed` (une seule requête gagne) · stock décrémenté (RPC atomique)
         └─► executeVendorPayout() : montant et n° MonCash lus en base · verrou `payouts.reference` · virement Bazik
```

Règles :
- **Le vendeur ne peut jamais libérer ses fonds** (plus de bouton « Forcer Livraison » ; la base refuse qu'un client écrive
  `status = completed`, `reception_confirmed`, `vendor_credited`, `total_price`… : trigger `orders_guard_sensitive`).
- **Pas d'argent sorti sans argent entré** : un virement n'est possible que si `verified_payments` contient la référence
  (et, si le montant est connu, qu'il couvre la somme des commandes du même paiement).
- **Un virement raté** (ex. n° MonCash manquant) n'annule pas la livraison : l'acheteur ou le vendeur peut relancer via
  `/api/bazik/pay-vendor` (idempotent grâce à `payouts.reference`).
- **En production, un virement n'est jamais « simulé »** : sans `BAZIK_SECRET_KEY`, il est refusé (503) ; `ALLOW_PAYMENT_SIMULATION=true` réservé aux tests.

Variables d'environnement à définir sur Render : `BAZIK_SECRET_KEY`, `BAZIK_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET` (si Stripe).

Tests : `npm test` (20 tests de la logique ci-dessus avec une base simulée en mémoire).

## Annulation et remboursement
- Un acheteur ne peut annuler qu'AVANT livraison (`attente` / `payee`). `completed`, `livree`, `annulee`, `disputed` sont des états finaux (la base refuse tout retour en arrière depuis le navigateur).
- Frais d'annulation 7,5 % : la base refuse tout montant de remboursement qui ne respecte pas cette règle (`montant_rembourse`, `frais_annulation`).
- À l'annulation d'une commande payée : une ligne est créée dans `refunds` (statut `pending`, à rembourser manuellement par MonCash puis marquer `paid`)
  et l'escrow du vendeur est annulé une seule fois (`vendor_wallets` + transaction `escrow_reversal`).

## Plans et vérification
- Un client ne peut pas s'attribuer un plan payant, un `boost_score`, `is_featured`, un statut « vérifié » ni modifier `revenus_bloques` (triggers `*_guard_plan`).
  Il peut seulement repasser à `gratuit`, demander la vérification (`en_attente`) et résilier un abonnement.
- Les vrais upgrades passent par le paiement -> webhook -> `activerAbonnement()` (service_role).

## Portefeuilles
- Rapprochés le 2026-10-15 à partir des commandes (instantané : `_backup_vendor_wallets_20261015`, lignes d'audit `reconciliation`).
  `pending_balance` = escrow net (commandes `payee` + `disputed`) ; `total_earned` = escrow + commandes terminées.
