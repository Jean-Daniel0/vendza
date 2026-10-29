-- Phase B : à appliquer UNIQUEMENT une fois le code de la PR #25 déployé (il lit profiles_public et les fonctions get_order_contacts / get_vendor_contact).
-- Avant : la politique « Lecture publique » (using true, tous rôles) exposait e-mails et téléphones à n'importe quel visiteur.
-- Après : chacun lit sa propre ligne complète ; l'administrateur lit tout ; les autres passent par profiles_public ou les fonctions.

drop policy if exists "Lecture publique" on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
