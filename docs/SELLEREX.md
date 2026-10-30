# Sellerex (sellerex.vendza.store)

Même dépôt, même serveur, même Supabase que Vendza. Deux parties :
1. **Fournisseurs POD** : un vendeur à l'identité vérifiée connecte un fournisseur d'impression à la demande (Dprinting en premier).
2. **Inscription grossiste** : une demande, vérifiée à la main par un admin avant activation.

## État
Fondation seulement, **éteinte par défaut** (`SELLEREX_ENABLED` ≠ `true` : les routes `/api/sellerex/*` répondent 404 sauf `/config`, le front affiche « bientôt »).

| Élément | Fichier |
|---|---|
| Logique pure + tests (validation, chiffrement AES-256-GCM, débit) | `server/sellerexCore.ts`, `tests/sellerex.test.ts` |
| Routes + en-têtes de sécurité du sous-domaine | `server/sellerexRoutes.ts` |
| Interface adaptateur POD, registre, squelette Dprinting | `server/pod/*` |
| Migration (NON appliquée) | `supabase/migrations/20261030_sellerex_foundation.sql` |
| Front (chunk séparé, chargé seulement sur `sellerex.*`) | `src/sellerex/*`, `src/lib/host.ts`, `src/main.tsx` |

Essai en local : `SELLEREX_ENABLED=true npm run dev`, puis `http://localhost:3000/?sellerex=1`.

## Pour l'ouvrir
1. Appliquer la migration sur Supabase.
2. Définir `SELLEREX_ENCRYPTION_KEY` sur Render (`openssl rand -base64 32`) puis `SELLEREX_ENABLED=true`.
3. Ajouter `https://sellerex.vendza.store/**` aux URLs de redirection autorisées de Supabase Auth.
4. Valider les demandes grossistes : `update wholesaler_applications set status='approved', reviewed_at=now() where id=…` (écran admin à faire).
5. Pour Dprinting : implémenter `server/pod/dprinting.ts`, puis `update pod_providers set status='active' where slug='dprinting'`.

## Sécurité
- Clés des fournisseurs : chiffrées côté serveur, table `pod_connections` sans aucune règle RLS (illisible depuis le navigateur), seul « ••••1234 » est renvoyé au front.
- `user_id` et `status` viennent toujours du serveur (jeton, `pending`), jamais du corps de la requête.
- Aucun CORS : le front appelle sa propre origine.
- Sous-domaine : HSTS, `frame-ancestors 'none'`, `noindex`, `robots.txt` fermé. **CSP complète non faite** (à tester contre Supabase, OneSignal, polices).
- Sans effet sur la logique d'escrow existante.

## Questions ouvertes
Dprinting a-t-il une API ? Libération des fonds à J+7 : tous ou POD seulement ? Livraison POD : vendeur ou fournisseur ? Commission sur le coût de production inclus ? Jour de coupure du règlement hebdomadaire ?

## Pas encore fait
Création de produit POD dans le dashboard, envoi des commandes au fournisseur (après `verified_payments`), webhooks signés anti-rejeu, règlement hebdomadaire, prix de gros par paliers et espace d'achat pour les grossistes, écran admin de validation, OAuth/PKCE.
