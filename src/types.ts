export interface Product {
  id: string;
  nom: string;
  cat: string;
  desc: string;
  prix: number;
  oldPrice?: number;
  stock: number;
  image_url: string;
  vendeur: string;
  vendeurId: string;
  rating: number;
  tags: string[];
  couleurs: string[];
  tailles?: string[];
  capacites?: string[];
  gallery?: string[];
  caracteristiques: Record<string, string>;
  statut: 'actif' | 'brouillon';
  dateCreation: string;
  vendeurPlan?: string;
  vendeurPremiumDepts?: string[];
  departement?: string;
  commune?: string;
  delaiLivraison?: string;
  scoreReferencement?: number;
  seoWarning?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}

export type OrderStatus = 'attente' | 'payee' | 'livree' | 'annulee';

export interface Order {
  id: string;
  clientId: string;
  clientNom: string;
  clientTel: string;
  items: {
    productId: string;
    productNom: string;
    prix: number;
    qte: number;
    couleur?: string;
    taille?: string;
    vendeurId: string;
  }[];
  fraisLivraison: number;
  discount: number;
  total: number;
  status: OrderStatus;
  date: string;
  heure: string;
  departement: string;
  commune: string;
  paymentMethod?: string;
  stripeSessionId?: string;
  checkout_group_id?: string;
  vendor_id?: string;
  vendor_name?: string;
}

export interface Review {
  id: string;
  productId: string;
  clientNom: string;
  note: number;
  commentaire: string;
  date: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderNom: string;
  recipientId: string;
  text: string;
  image?: string;
  time: string;
  productId?: string;
  orderId?: string;
  createdAt?: string;
  isRead?: boolean;
}

export interface UserProfile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  tel: string;
  departement: string;
  commune: string;
  shopName?: string;
  shopDesc?: string;
  avatar?: string;
  banner?: string;
  userType: 'client' | 'vendeur';
  plan: 'Gratuit' | 'Pro Local' | 'Pro National';
  planDate?: string;
  premiumDepts?: string[];
  categories?: string[];
  moncash?: string;
  moncashNom?: string;
  banque?: string;
  compteBanque?: string;
  idType?: string;
  idNumber?: string;
  idFile?: string;
  statutVerification?: 'non_verifie' | 'en_verification' | 'verifie';
  revenusBloques?: number;
}
