-- Phase A (additive, sans effet sur l'existant) : préparer la fermeture de la lecture publique de profiles.
-- E-mail, téléphone, notifications, revenus bloqués et date d'expiration ne doivent plus être lisibles par tout le monde.
-- La phase B (migration suivante) remplace la politique « Lecture publique » une fois le nouveau code déployé.

-- 1) Vue publique : seulement les champs nécessaires à l'affichage d'un vendeur ou d'un interlocuteur.
--    (vue exécutée avec les droits de son propriétaire : elle reste lisible quand profiles sera restreinte)
create or replace view public.profiles_public as
select id, prenom, nom, type, departement, commune, boutique_nom, boutique_desc, delai_livraison,
       avatar_url, note_moyenne, total_ventes, plan, premium_depts, premiumdepts, statut_verification, created_at, updated_at
from public.profiles;
grant select on public.profiles_public to anon, authenticated;

-- 2) Le fil de produits lit le nom de boutique et le forfait : il doit passer par la vue publique.
create or replace view public.products_feed with (security_invoker = true) as
 select p.id, p.vendor_id, p.name, p.price, p.old_price, p.stock, p.category, p.colors, p.departement, p.commune, p.created_at,
        case when length(p.image_url) > 40000 then null::text else p.image_url end as image_url,
        length(p.image_url) > 40000 as has_oversized_inline_image,
        pr.boutique_nom as vendor_shop_name,
        pr.plan as vendor_plan
   from public.products p
   left join public.profiles_public pr on pr.id = p.vendor_id
  where p.is_active = true and p.status = 'published'::text;

-- 3) Contacts d'une commande : seulement l'acheteur, le vendeur de cette commande, ou l'administrateur.
create or replace function public.get_order_contacts(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare o record; uid uuid := auth.uid(); b jsonb; v jsonb; buyer uuid;
begin
  if uid is null then raise exception 'Connexion requise' using errcode = '28000'; end if;
  select id, buyer_id, client_id, vendor_id into o from public.orders where id = p_order_id;
  if not found then return null; end if;
  buyer := coalesce(o.buyer_id, o.client_id);
  if not (uid = o.vendor_id or uid = buyer or uid = o.client_id or public.is_admin()) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  select jsonb_build_object('prenom', prenom, 'nom', nom, 'telephone', telephone, 'avatar_url', avatar_url) into b from public.profiles where id = buyer;
  select jsonb_build_object('prenom', prenom, 'nom', nom, 'telephone', telephone) into v from public.profiles where id = o.vendor_id;
  return jsonb_build_object('buyer', b, 'vendor', v);
end $$;
revoke all on function public.get_order_contacts(uuid) from public, anon;
grant execute on function public.get_order_contacts(uuid) to authenticated;

-- 4) Téléphone d'un vendeur (fiche vendeur) : réservé aux utilisateurs connectés, jamais l'e-mail, jamais un client.
create or replace function public.get_vendor_contact(p_vendor_id uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select p.telephone from public.profiles p
  where auth.uid() is not null and p.id = p_vendor_id and lower(coalesce(p.type, '')) in ('vendeur', 'vendor');
$$;
revoke all on function public.get_vendor_contact(uuid) from public, anon;
grant execute on function public.get_vendor_contact(uuid) to authenticated;
