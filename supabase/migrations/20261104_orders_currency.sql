-- Devise réellement payée par commande : carte (Stripe) = USD, MonCash = HTG.
-- Le taux et le montant en dollars sont figés au moment du paiement, pour que le ticket reste exact même si le taux change.
alter table public.orders add column if not exists payment_currency text default 'HTG';
alter table public.orders add column if not exists usd_rate numeric;
alter table public.orders add column if not exists amount_usd numeric;

-- Commandes déjà payées par carte : marquées en USD (le taux exact n'est pas connu, le ticket utilisera le taux indicatif)
update public.orders set payment_currency = 'USD' where payment_method = 'stripe' and (payment_currency is null or payment_currency = 'HTG');
