import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeSupabaseConfig } from './lib/supabaseClient';
import { isSellerexHost } from './lib/host';

async function init() {
  await initializeSupabaseConfig();
  // Sous-domaine Sellerex : code chargé à part (chunk séparé), les autres noms d'hôte restent inchangés.
  // Page d'administration unique : adresse secrète « /gestion-… » (chunk séparé). Le serveur ne sert cette adresse qu'avec la bonne valeur secrète
  // et vérifie ensuite l'identité de l'admin et sa double authentification pour chaque donnée.
  const isAdmin = /^\/gestion-[a-z0-9]+\/?$/i.test(window.location.pathname);
  const Root = isSellerexHost()
    ? (await import('./sellerex/SellerexApp')).default
    : isAdmin ? (await import('./admin/AdminApp')).default : App;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

init();
