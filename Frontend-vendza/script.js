// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', function() {
    
    // Gestion du menu hamburger
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

        // Fermer le menu en cliquant sur un lien
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
            });
        });
    }
    
    // Gestion de la recherche et des filtres du catalogue
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const filterBtn = document.getElementById('filterBtn');
    const productsGrid = document.getElementById('productsGrid');
    
    if (searchInput && categoryFilter && filterBtn && productsGrid) {
        // Recherche en temps réel
        searchInput.addEventListener('input', function() {
            filterProducts();
        });
        
        // Filtre par catégorie
        categoryFilter.addEventListener('change', function() {
            filterProducts();
        });
        
        // Bouton de filtre
        filterBtn.addEventListener('click', function() {
            filterProducts();
        });
    }
    
    // Fonction de filtrage des produits
    function filterProducts() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedCategory = categoryFilter.value;
        const products = productsGrid.querySelectorAll('.product-card');
        
        products.forEach(product => {
            const productName = product.querySelector('h3')?.textContent.toLowerCase() || '';
            const productDescription = product.querySelector('.description')?.textContent.toLowerCase() || '';
            const productCategory = product.dataset.category || '';
            
            let showProduct = true;
            
            // Filtre par recherche
            if (searchTerm && !productName.includes(searchTerm) && !productDescription.includes(searchTerm)) {
                showProduct = false;
            }
            
            // Filtre par catégorie
            if (selectedCategory && productCategory !== selectedCategory) {
                showProduct = false;
            }
            
            // Afficher/masquer le produit
            product.style.display = showProduct ? 'block' : 'none';
            
            // Animation pour les produits visibles
            if (showProduct) {
                product.style.animation = 'fadeInUp 0.6s ease';
            }
        });
        
        // Afficher un message si aucun produit n'est trouvé
        const visibleProducts = productsGrid.querySelectorAll('.product-card[style*="display: block"], .product-card:not([style*="display: none"])');
        if (visibleProducts.length === 0) {
            showNoProductsMessage();
        } else {
            hideNoProductsMessage();
        }
    }
    
    // Fonction pour afficher le message "aucun produit trouvé"
    function showNoProductsMessage() {
        let noProductsMsg = productsGrid.querySelector('.no-products-message');
        if (!noProductsMsg) {
            noProductsMsg = document.createElement('div');
            noProductsMsg.className = 'no-products-message';
            noProductsMsg.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #666;">
                    <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; color: #2563eb;"></i>
                    <h3>Aucun produit trouvé</h3>
                    <p>Essayez de modifier vos critères de recherche ou de filtre.</p>
                </div>
            `;
            productsGrid.appendChild(noProductsMsg);
        }
    }
    
    // Fonction pour masquer le message "aucun produit trouvé"
    function hideNoProductsMessage() {
        const noProductsMsg = productsGrid.querySelector('.no-products-message');
        if (noProductsMsg) {
            noProductsMsg.remove();
        }
    }
    
    // Gestion des boutons "Ajouter au panier"
    const addToCartButtons = document.querySelectorAll('.add-to-cart');
    
    addToCartButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const productCard = this.closest('.product-card');
            const productData = readProductFromCard(productCard);
            if (productData) {
                addToCart({
                    id: productData.id || Date.now(),
                    name: productData.name,
                    price: productData.price,
                    image: productData.image,
                    quantity: 1
                });
            }
            
            // Animation de confirmation
            this.innerHTML = '<i class="fas fa-check"></i> Ajouté !';
            this.style.background = '#10b981';
            this.disabled = true;
            
            setTimeout(() => {
                this.innerHTML = 'Ajouter au panier';
                this.style.background = '';
                this.disabled = false;
            }, 2000);
    });
});

    // Navigation vers la page de détails en cliquant sur une carte produit ou le bouton Détails
    function attachProductNavigation(){
        const cards = document.querySelectorAll('.products-grid .product-card');
        cards.forEach(card => {
            // Certaines cartes ambiance (non-produit) peuvent ne pas être cliquables
            if (card.dataset.navigate === 'false') return;

            // Click sur la carte
            card.addEventListener('click', (e) => {
                const target = e.target;
                if (target.closest('.add-to-cart')) return; // ne pas interférer avec l'ajout au panier
                if (target.tagName === 'BUTTON' || target.tagName === 'A') return; // liens gérés séparément
                const product = readProductFromCard(card);
                if (product) openProductDetail(product);
            });

            // Bouton/Lien Détails si present
            const detailsBtn = card.querySelector('.btn.btn-secondary');
            if (detailsBtn) {
                detailsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const product = readProductFromCard(card);
                    if (product) openProductDetail(product);
                });
            }
        });
    }

    function readProductFromCard(card){
        if (!card) return null;
        const name = card.querySelector('h3')?.textContent?.trim() || '';
        const priceText = card.querySelector('.price')?.textContent?.trim() || '';
        const description = card.querySelector('.description')?.textContent?.trim() || '';
        const image = card.querySelector('img')?.getAttribute('src') || '';
        const priceNumber = parseFloat(priceText.replace(/[^0-9.,]/g,'').replace(',', '.')) || 0;
        if (!name) return null;
        return { id: `${name}-${priceNumber}`, name, price: priceNumber, description, image };
    }

    function openProductDetail(product){
        try {
            localStorage.setItem('vendza_selected_product', JSON.stringify(product));
        } catch(err) {}
        window.location.href = window.VZ ? window.VZ.url('product') : 'detail-produit.html';
    }

    attachProductNavigation();
    
    // Fonction d'ajout au panier
    function addToCart(product) {
        if (window.VendzaCartGuard && window.VendzaCartGuard.isOwnProductSync(product)) {
            window.VendzaCartGuard.notifyBlocked();
            return;
        }
        let cart = JSON.parse(localStorage.getItem('vendza_cart') || '[]');
        const id = product.id || product.product_id || product.productId || String(Date.now());
        const existingProductIndex = cart.findIndex(item => String(item.id) === String(id));

        if (existingProductIndex !== -1) {
            cart[existingProductIndex].quantity = Number(cart[existingProductIndex].quantity || 1) + 1;
        } else {
            cart.push({
                id: id,
                name: product.name || product.title || 'Produit',
                price: Number(product.price || product.prix || 0),
                image: product.image || product.imageUrl || product.image_url || '',
                quantity: 1,
                product_id: product.product_id || product.productId || product.id || null,
                vendor_id: product.vendor_id || product.vendorId || null,
                vendor_name: product.vendor_name || product.vendorName || product.shopName || 'Vendeur',
                category: product.category || product.categorie || ''
            });
        }

        localStorage.setItem('vendza_cart', JSON.stringify(cart));
        updateCartBadge();
        showNotification(`${product.name || product.title || 'Produit'} ajouté au panier !`, 'success');
    }
    
    // Fonction de mise à jour du badge du panier
    function updateCartBadge() {
        const cart = JSON.parse(localStorage.getItem('vendza_cart')) || [];
        const cartCount = cart.reduce((total, item) => total + (Number(item.quantity) || 1), 0);
        
        const cartBadge = document.getElementById('cart-count');
        if (cartBadge) {
            cartBadge.textContent = cartCount;
            cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
        }
    }

// Gestion du formulaire de contact
    const contactForm = document.getElementById('contactForm');
    
if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
            handleContactForm();
        });
    }
        
    // Fonction de gestion du formulaire de contact
    function handleContactForm() {
        const formData = new FormData(contactForm);
        const name = formData.get('name') || contactForm.querySelector('input[type="text"]').value;
        const email = formData.get('email') || contactForm.querySelector('input[type="email"]').value;
        const message = formData.get('message') || contactForm.querySelector('textarea').value;
        
        // Validation basique
        if (!name || !email || !message) {
            showNotification('Veuillez remplir tous les champs', 'error');
            return;
        }
        
        if (!isValidEmail(email)) {
            showNotification('Veuillez entrer une adresse email valide', 'error');
            return;
        }
        
        // Simuler l'envoi du message
        showNotification('Message envoyé avec succès !', 'success');
        contactForm.reset();
}

    // Fonction de validation d'email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

    // Fonction d'affichage des notifications
function showNotification(message, type = 'info') {
        // Créer le conteneur de notifications s'il n'existe pas
        let notificationsContainer = document.getElementById('notifications');
        if (!notificationsContainer) {
            notificationsContainer = document.createElement('div');
            notificationsContainer.id = 'notifications';
            notificationsContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1001;
            `;
            document.body.appendChild(notificationsContainer);
        }
        
        // Créer l'élément de notification
    const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Définir les couleurs selon le type
        let bgColor, borderColor, iconColor;
        switch(type) {
            case 'success':
                bgColor = '#10b981'; // Vert principal
                borderColor = '#059669'; // Vert secondaire
                iconColor = '#34d399'; // Vert clair
                break;
            case 'error':
                bgColor = '#ef4444'; // Rouge pour les erreurs
                borderColor = '#dc2626';
                iconColor = '#fca5a5';
                break;
            case 'info':
            default:
                bgColor = '#2563eb'; // Bleu principal
                borderColor = '#1d4ed8'; // Bleu secondaire
                iconColor = '#3b82f6'; // Bleu clair
                break;
        }
        
        // Créer le contenu de la notification
    notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}" style="color: ${iconColor};"></i>
            <span>${message}</span>
        `;
        
        // Appliquer les styles
    notification.style.cssText = `
            background: ${bgColor};
            border-left: 4px solid ${borderColor};
        color: white;
        padding: 1rem 1.5rem;
            margin-bottom: 1rem;
        border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 0.5rem;
            max-width: 300px;
        transform: translateX(400px);
        transition: transform 0.3s ease;
            z-index: 1001;
    `;
    
    // Ajouter au DOM
        notificationsContainer.appendChild(notification);
    
    // Animation d'entrée
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
        // Supprimer après 4 secondes
        setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
    setTimeout(() => {
        if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }
    
    // Animation au scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observer les éléments à animer
    const animatedElements = document.querySelectorAll('.service-card, .product-card, .contact-item, .about-content, .hero-content');
    animatedElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
    
    // Navigation smooth scroll pour les ancres internes
    const internalLinks = document.querySelectorAll('a[href^="#"]');
    internalLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const targetElement = document.querySelector(href);
                if (targetElement) {
                    const offsetTop = targetElement.offsetTop - 80; // Ajuster pour la navbar fixe
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // Mise à jour du badge du panier au chargement
    updateCartBadge();
    
    // Gestion des erreurs
    window.addEventListener('error', function(e) {
        console.error('Erreur JavaScript:', e.error);
        showNotification('Une erreur est survenue', 'error');
    });
    
    // Console log pour debug
    console.log('Page Vendza chargée avec succès !');
    
    // Performance monitoring
    if ('performance' in window) {
        window.addEventListener('load', function() {
            setTimeout(function() {
                const perfData = performance.getEntriesByType('navigation')[0];
                console.log('Temps de chargement de la page:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
            }, 0);
        });
    }
});





// Expose global add-to-cart helper for inline buttons
(function(){
if (typeof window !== 'undefined' && !window.vzAddToCart) {
    window.vzAddToCart = function(product){
        try {
            if (window.VendzaCartGuard && window.VendzaCartGuard.isOwnProductSync(product)) {
                window.VendzaCartGuard.notifyBlocked();
                return false;
            }
            var cart = [];
            try { cart = JSON.parse(localStorage.getItem('vendza_cart')) || []; } catch(e) { cart = []; }
            var index = cart.findIndex(function(it){ return it && it.id === product.id; });
            if (index !== -1) {
                cart[index].quantity = (cart[index].quantity || 1) + 1;
            } else {
                cart.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image || '',
                    quantity: 1,
                    product_id: product.product_id || product.id || null,
                    vendor_id: product.vendor_id || null,
                    vendor_name: product.vendor_name || ''
                });
            }
            localStorage.setItem('vendza_cart', JSON.stringify(cart));
        } catch(e) {}

        // Update badge if present
        try {
            var items = JSON.parse(localStorage.getItem('vendza_cart')) || [];
            var count = items.reduce(function(t, it){ return t + (it.quantity || 1); }, 0);
            var badge = document.getElementById('cart-count');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'flex' : 'none';
            }
        } catch(e) {}
    };
}
})();
