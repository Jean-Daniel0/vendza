// Adaptateur Dprinting : squelette. L'API de Dprinting n'est pas encore spécifiée (voir docs/SELLEREX.md, question ouverte n°1).
// Chaque méthode lève PodNotImplementedError ; le fournisseur reste en statut « coming_soon » en base, donc aucune connexion n'est possible.
import { PodAdapter, PodNotImplementedError } from './types';

export const dprinting: PodAdapter = {
  slug: 'dprinting',
  async verifyCredentials() { throw new PodNotImplementedError('Dprinting'); },
  async listCatalog() { throw new PodNotImplementedError('Dprinting'); },
  async createOrder() { throw new PodNotImplementedError('Dprinting'); },
  async getOrderStatus() { throw new PodNotImplementedError('Dprinting'); },
  async handleWebhook() { throw new PodNotImplementedError('Dprinting'); },
};
