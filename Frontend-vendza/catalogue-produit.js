document.addEventListener('DOMContentLoaded', function() {
    function getCart() {
        try {
            return JSON.parse(localStorage.getItem('vendza_cart')) || [];
        } catch (e) {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem('vendza_cart', JSON.stringify(cart));
    }

    function updateBadge() {
        var cart = getCart();
        var count = cart.reduce(function(total, item) { return total + (item.quantity || 1); }, 0);
        var badge = document.getElementById('cart-count');
        if (badge) {
            badge.textContent = String(count);
        }
    }

    function extractProductData(cardEl) {
        var titleEl = cardEl.querySelector('h3');
        var priceEl = cardEl.querySelector('.price');
        var imgEl = cardEl.querySelector('img');
        return {
            id: (titleEl?.textContent || '') + '|' + (imgEl?.src || ''),
            title: titleEl?.textContent || 'Produit',
            price: priceEl?.textContent || '',
            image: imgEl?.src || ''
        };
    }

    function addToCartFromCard(cardEl) {
        var data = extractProductData(cardEl);
        if (window.VendzaCartGuard && window.VendzaCartGuard.isOwnProductSync(data)) {
            window.VendzaCartGuard.notifyBlocked();
            return;
        }
        var cart = getCart();
        var existing = cart.find(function(it) { return it.id === data.id; });
        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            cart.push({
              id: data.id,
              name: data.title || 'Produit',
              title: data.title || 'Produit',
              price: data.price,
              image: data.image,
              quantity: 1,
              product_id: data.id || null,
              vendor_id: data.vendor_id || null,
              vendor_name: data.vendor_name || data.vendorName || 'Vendeur',
              category: data.category || ''
            });
        }
        saveCart(cart);
        updateBadge();
    }

    var addToCartButtons = document.querySelectorAll('.add-to-cart');
    addToCartButtons.forEach(function(button) {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            var card = button.closest('.product-card');
            if (card) {
                addToCartFromCard(card);
            }
        });
    });

    updateBadge();
});

