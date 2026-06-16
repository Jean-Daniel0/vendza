import { Product, Review } from './types';

export const HAITIAN_ZONES: Record<string, string[]> = {
  'Ouest': ['Port-au-Prince', 'Pétion-Ville', 'Delmas', 'Croix-des-Bouquets', 'Léogâne', 'Carrefour'],
  'Nord': ['Cap-Haïtien', 'Limbé', 'Plaisance', 'Grande-Rivière du Nord'],
  'Sud': ['Les Cayes', 'Aquin', 'Saint-Louis du Sud'],
  'Artibonite': ['Gonaïves', 'Saint-Marc', 'Gros-Morne'],
  'Centre': ['Hinche', 'Mirebalais'],
  'Nord-Est': ['Fort-Liberté', 'Ouanaminthe'],
  'Nord-Ouest': ['Port-de-Paix', 'Saint-Louis du Nord'],
  'Nippes': ['Miragoâne', 'Petit-Goâve'],
  'Sud-Est': ['Jacmel', 'Bainet'],
  "Grand'Anse": ['Jérémie', 'Moron']
};

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_REVIEWS: Review[] = [];
