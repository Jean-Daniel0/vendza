-- Autorise les nouvelles actions du journal admin : remboursement sur carte (Stripe) réussi ou refusé.
alter table public.admin_payment_log drop constraint if exists admin_payment_log_action_check;
alter table public.admin_payment_log add constraint admin_payment_log_action_check
  check (action = any (array['refund_paid','refund_rejected','reconcile_payments','refund_card','refund_card_failed']));
