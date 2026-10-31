-- Ferme les lectures ouvertes à tous sur orders et conversations.
-- Les règles légitimes restent : acheteur, vendeur, participants, admin (orders_select_buyer, orders_select_vendor,
-- confirm_orders_select_participants, ticket_orders_select_participants, visibilite_commandes, orders_admin_all ;
-- acces_conversations, conversations_select_participants, conversations_admin_all).
-- Le serveur (clé service) n'est pas concerné par la RLS.

drop policy if exists "Lecture publique des commandes" on public.orders;
drop policy if exists orders_select_auth on public.orders;
drop policy if exists orders_select_authenticated on public.orders;
drop policy if exists conversations_select_authenticated_temp on public.conversations;

-- Règles de test en double (les règles équivalentes existent déjà : orders_*_buyer / orders_*_vendor)
drop policy if exists orders_select_test on public.orders;
drop policy if exists orders_insert_test on public.orders;
drop policy if exists orders_update_test on public.orders;

-- Stockage : plus d'envoi libre par n'importe quel compte connecté
drop policy if exists images_authenticated_upload on storage.objects;
