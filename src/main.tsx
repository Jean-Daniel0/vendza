import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeSupabaseConfig } from './lib/supabaseClient';
import { isSellerexHost } from './lib/host';

async function init() {
  await initializeSupabaseConfig();
  // Sous-domaine Sellerex : code chargé à part (chunk séparé), les autres noms d'hôte restent inchangés.
  // Page admin des paiements : /admin/paiements (chunk séparé, aucun impact sur le reste du site ; l'accès est vérifié par le serveur).
  const isAdminPayments = window.location.pathname.replace(/\/+$/, '') === '/admin/paiements';
  const Root = isSellerexHost()
    ? (await import('./sellerex/SellerexApp')).default
    : isAdminPayments ? (await import('./components/AdminPaymentsPage')).default : App;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

init();
