// Interface commune des fournisseurs d'impression à la demande (POD). Un adaptateur par fournisseur.

export type PodOrderStatus = 'received' | 'in_production' | 'shipped' | 'delivered' | 'cancelled';

export interface PodCredentials {
  apiKey: string;
}

export interface PodCatalogItem {
  externalId: string;
  name: string;
  baseCostHtg: number; // coût de production : sert au prix plancher d'un produit POD
  imageUrl?: string;
}

export interface PodOrderInput {
  orderId: string;                 // identifiant de la commande Vendza (clé d'idempotence côté fournisseur)
  items: { externalProductId: string; quantity: number; designUrl: string }[];
  shipping: { name: string; phone: string; address: string; commune: string; departement: string };
}

export interface PodWebhookEvent {
  externalOrderId: string;
  status: PodOrderStatus;
  eventId: string;                 // sert à ignorer un webhook rejoué
}

export interface PodAdapter {
  slug: string;
  verifyCredentials(creds: PodCredentials): Promise<boolean>;
  listCatalog(creds: PodCredentials): Promise<PodCatalogItem[]>;
  createOrder(creds: PodCredentials, input: PodOrderInput): Promise<{ externalOrderId: string }>;
  getOrderStatus(creds: PodCredentials, externalOrderId: string): Promise<PodOrderStatus>;
  // Vérifie la signature, refuse un message trop ancien, renvoie null si le message n'est pas pour nous.
  handleWebhook(rawBody: Buffer, headers: Record<string, string | undefined>): Promise<PodWebhookEvent | null>;
}

// Levée tant que l'API du fournisseur n'est pas spécifiée : la route répond 501 au lieu de planter.
export class PodNotImplementedError extends Error {
  constructor(provider: string) {
    super(`L'intégration du fournisseur « ${provider} » n'est pas encore disponible.`);
    this.name = 'PodNotImplementedError';
  }
}
