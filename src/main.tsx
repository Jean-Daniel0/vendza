import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeSupabaseConfig } from './lib/supabaseClient';
import { isSellerexHost } from './lib/host';

async function init() {
  await initializeSupabaseConfig();
  // Sous-domaine Sellerex : code chargé à part (chunk séparé), les autres noms d'hôte restent inchangés.
  const Root = isSellerexHost() ? (await import('./sellerex/SellerexApp')).default : App;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

init();
