/**
 * Gestionnaire de navigation pour Vendza
 * Gère le menu hamburger, l'état de connexion, et les interactions utilisateur
 */

// Gestion de la navigation
document.addEventListener('DOMContentLoaded', function() {
    // Menu hamburger
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        
        // Fermer le menu en cliquant sur un lien
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }
    
    // Gestion de l'état de connexion dans la navigation
    updateUserNavState();
    
    // Mise à jour du badge panier dans la navigation
    updateNavCartBadge();
});

/**
 * Met à jour l'état de connexion dans la navigation
 */
async function updateUserNavState() {
    const userNavItem = document.getElementById('userNavItem');
    if (!userNavItem) return;
    
    try {
        const client = window.supabaseClient || window.supabase;
        if (!client || !client.auth) {
            // Si pas de Supabase, vérifier le localStorage
            const userData = localStorage.getItem('vendza_user_data');
            if (userData) {
                const user = JSON.parse(userData);
                showUserNav(user);
            } else {
                showLoginNav();
            }
            return;
        }
        
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) {
            showLoginNav();
            return;
        }
        
        // Récupérer les données utilisateur depuis le localStorage
        let userData = null;
        try {
            userData = JSON.parse(localStorage.getItem('vendza_user_data') || 'null');
        } catch (e) {
            console.warn('Erreur parsing user data:', e);
        }
        
        if (userData) {
            showUserNav(userData);
        } else {
            // Fallback avec les données de Supabase
            const user = {
                firstName: data.user.user_metadata?.firstName || data.user.user_metadata?.first_name || '',
                lastName: data.user.user_metadata?.lastName || data.user.user_metadata?.last_name || '',
                email: data.user.email,
                userType: data.user.user_metadata?.userType || 'client'
            };
            showUserNav(user);
        }
        
    } catch (error) {
        console.error('Erreur lors de la vérification de l\'état de connexion:', error);
        showLoginNav();
    }
}

/**
 * Affiche le menu utilisateur connecté
 * @param {Object} user - Données de l'utilisateur
 */
function showUserNav(user) {
    const userNavItem = document.getElementById('userNavItem');
    if (!userNavItem) return;
    
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 
                      user.email?.split('@')[0] || 'Utilisateur';
    const initial = displayName.charAt(0).toUpperCase();
    const userType = user.userType || 'client';
    
    // Déterminer l'URL du profil selon le type d'utilisateur
    const profileUrl = userType === 'vendeur' ? 
        'vendeur/profil-vendeur.html' : 
        'client/profil-client.html';
    
    userNavItem.innerHTML = `
        <div class="nav-user-dropdown">
            <a href="${profileUrl}" class="nav-link user-profile">
                <div class="user-avatar">${initial}</div>
                <span>${displayName}</span>
                <i class="fas fa-chevron-down"></i>
            </a>
            <div class="nav-dropdown-menu">
                <a href="${profileUrl}" class="dropdown-item">
                    <i class="fas fa-user"></i>
                    <span>Mon Profil</span>
                </a>
                <a href="${userType === 'vendeur' ? 'vendeur/tableau-de-bord-vendeur.html' : 'client/tableau-de-bord-client.html'}" class="dropdown-item">
                    <i class="fas fa-tachometer-alt"></i>
                    <span>Tableau de bord</span>
                </a>
                ${userType === 'vendeur' ? `
                <a href="vendeur/Abonnement.html" class="dropdown-item">
                    <i class="fas fa-crown"></i>
                    <span>Abonnement</span>
                </a>
                ` : ''}
                <a href="client/historique-des-commandes.html" class="dropdown-item">
                    <i class="fas fa-history"></i>
                    <span>Commandes</span>
                </a>
                <div class="dropdown-divider"></div>
                <a href="#" class="dropdown-item logout-btn">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Déconnexion</span>
                </a>
            </div>
        </div>
    `;
    
    // Gestion du dropdown
    const userProfile = userNavItem.querySelector('.user-profile');
    const dropdownMenu = userNavItem.querySelector('.nav-dropdown-menu');
    
    if (userProfile && dropdownMenu) {
        userProfile.addEventListener('click', function(e) {
            e.preventDefault();
            dropdownMenu.classList.toggle('show');
        });
        
        // Fermer le dropdown en cliquant ailleurs
        document.addEventListener('click', function(e) {
            if (!userNavItem.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
    }
    
    // Gestion de la déconnexion
    const logoutBtn = userNavItem.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
}

/**
 * Affiche le lien de connexion/inscription pour les utilisateurs non connectés
 */
function showLoginNav() {
    const userNavItem = document.getElementById('userNavItem');
    if (!userNavItem) return;
    
    userNavItem.innerHTML = `
        <a href="authentification/connexion.html" class="nav-link">
            <i class="fas fa-user"></i>
            <span>Connexion / Inscription</span>
        </a>
    `;
}

/**
 * Fonction de déconnexion
 */
async function logout() {
    try {
        const client = window.supabaseClient || window.supabase;
        if (client && client.auth) {
            await client.auth.signOut();
        }
        
        // Nettoyer le localStorage
        localStorage.removeItem('vendza_user_data');
        localStorage.removeItem('vendza_auth_token');
        localStorage.removeItem('vendza_remember_email');
        
        // Mettre à jour la navigation
        updateUserNavState();
        
        // Rediriger vers la page d'accueil
        window.location.href = window.VZ ? window.VZ.url('home') : 'index.html';
        
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
    }
}

/**
 * Met à jour le badge panier dans la navigation
 */
function updateNavCartBadge() {
    try {
        const cart = JSON.parse(localStorage.getItem('vendza_cart')) || [];
        const count = cart.reduce((total, item) => total + (item.quantity || 1), 0);
        const navBadge = document.getElementById('nav-cart-count');
        if (navBadge) {
            navBadge.textContent = count;
        }
    } catch (e) {
        console.warn('Erreur lors de la mise à jour du badge panier:', e);
    }
}

// Mettre à jour le badge panier quand le panier change
window.addEventListener('storage', function(e) {
    if (e.key === 'vendza_cart') {
        updateNavCartBadge();
    }
});

/**
 * Fonction globale pour ajouter au panier (utilisée par les boutons)
 * @param {Object} product - Produit à ajouter au panier
 */
window.vzAddToCart = function(product) {
    try {
        if (window.VendzaCartGuard && window.VendzaCartGuard.isOwnProductSync(product)) {
            window.VendzaCartGuard.notifyBlocked();
            return false;
        }
        let cart = JSON.parse(localStorage.getItem('vendza_cart')) || [];
        const existing = cart.find(item => item.id === product.id);
        
        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        
        localStorage.setItem('vendza_cart', JSON.stringify(cart));
        updateNavCartBadge();
        
        // Notification de succès
        showCartNotification('Produit ajouté au panier !');
        
    } catch (e) {
        console.error('Erreur lors de l\'ajout au panier:', e);
    }
};

/**
 * Affiche une notification de panier
 * @param {string} message - Message à afficher
 */
function showCartNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Fonction utilitaire pour synchroniser l'état de navigation entre les pages
 */
window.syncNavigationState = function() {
    updateUserNavState();
    updateNavCartBadge();
};

// Exporter les fonctions pour utilisation dans d'autres fichiers
window.VendzaNavigation = {
    updateUserNavState,
    updateNavCartBadge,
    logout,
    showCartNotification
};

