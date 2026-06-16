# -*- coding: utf-8 -*-
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RENAMES = {
    "a propos.html": "a-propos.html",
    "a propos.js": "a-propos.js",
    "a propos-v2.css": "a-propos-v2.css",
    "detailles des produits.html": "detail-produit.html",
    "detail des produits.js": "detail-produit.js",
    "detailles des produits.temp.html": "detail-produit.temp.html",
    "detail des produit.temp.css": "detail-produit.temp.css",
    "catalogue produit.js": "catalogue-produit.js",
    "historique des commandes.html": "historique-commandes.html",
    "tableau de bord client.html": "tableau-de-bord-client.html",
    os.path.join("client", "Panier.html"): os.path.join("client", "panier.html"),
    os.path.join("client", "profil client.html"): os.path.join("client", "profil-client.html"),
    os.path.join("client", "profil client.js"): os.path.join("client", "profil-client.js"),
    os.path.join("client", "historique des commandes.html"): os.path.join("client", "historique-commandes.html"),
    os.path.join("client", "historique des commandes.js"): os.path.join("client", "historique-commandes.js"),
    os.path.join("client", "historique des commandes.css"): os.path.join("client", "historique-commandes.css"),
    os.path.join("client", "tableau de bord client.html"): os.path.join("client", "tableau-de-bord-client.html"),
    os.path.join("client", "tableau de bord client.js"): os.path.join("client", "tableau-de-bord-client.js"),
    os.path.join("vendeur", "profil vendeur.html"): os.path.join("vendeur", "profil-vendeur.html"),
    os.path.join("vendeur", "profil vendeur.js"): os.path.join("vendeur", "profil-vendeur.js"),
    os.path.join("vendeur", "boite de reception vendeur.html"): os.path.join("vendeur", "boite-reception.html"),
    os.path.join("vendeur", "boite de reception vendeur.js"): os.path.join("vendeur", "boite-reception.js"),
    os.path.join("vendeur", "tableau de bord vendeur.html"): os.path.join("vendeur", "tableau-de-bord.html"),
    os.path.join("vendeur", "tableau de bord vendeur.js"): os.path.join("vendeur", "tableau-de-bord.js"),
    os.path.join("vendeur", "commande recu.html"): os.path.join("vendeur", "commande-recu.html"),
    os.path.join("vendeur", "commande recu.js"): os.path.join("vendeur", "commande-recu.js"),
    os.path.join("vendeur", "mes produit.html"): os.path.join("vendeur", "mes-produits.html"),
    os.path.join("vendeur", "Abonnement.html"): os.path.join("vendeur", "abonnement.html"),
    os.path.join("vendeur", "Abonnement.js"): os.path.join("vendeur", "abonnement.js"),
}

REPLACEMENTS = [
    ("a propos.html", "a-propos"),
    ("a%20propos.html", "a-propos"),
    ("detailles des produits.html", "detail-produit"),
    ("detail des produits.js", "detail-produit.js"),
    ("profil vendeur.html", "profil-vendeur"),
    ("profil vendeur.js", "profil-vendeur.js"),
    ("boite de reception vendeur.html", "boite-reception"),
    ("boite de reception vendeur.js", "boite-reception.js"),
    ("tableau de bord vendeur.html", "tableau-de-bord"),
    ("tableau de bord vendeur.js", "tableau-de-bord.js"),
    ("commande recu.html", "commande-recu"),
    ("commande recu.js", "commande-recu.js"),
    ("mes produit.html", "mes-produits"),
    ("historique des commandes.html", "historique-commandes"),
    ("historique des commandes.js", "historique-commandes.js"),
    ("historique des commandes.css", "historique-commandes.css"),
    ("profil client.html", "profil-client"),
    ("profil client.js", "profil-client.js"),
    ("tableau de bord client.html", "tableau-de-bord-client"),
    ("tableau de bord client.js", "tableau-de-bord-client.js"),
    ("client/Panier.html", "client/panier"),
    ("Panier.html", "panier"),
    ("Abonnement.html", "abonnement"),
    ("Abonnement.js", "abonnement.js"),
    ("catalogue produit.js", "catalogue-produit.js"),
    ("a propos.js", "a-propos.js"),
    ("a propos-v2.css", "a-propos-v2.css"),
]


def main():
    for old_rel, new_rel in RENAMES.items():
        old = os.path.join(ROOT, old_rel)
        new = os.path.join(ROOT, new_rel)
        if os.path.isfile(old):
            os.makedirs(os.path.dirname(new), exist_ok=True)
            if os.path.isfile(new):
                os.remove(new)
            os.rename(old, new)
            print("renamed:", old_rel, "->", new_rel)

    for dirpath, _, filenames in os.walk(ROOT):
        if ".netlify" in dirpath or "node_modules" in dirpath:
            continue
        for name in filenames:
            if not name.endswith((".html", ".js", ".css", ".toml", ".xml")) and name != "_redirects":
                continue
            path = os.path.join(dirpath, name)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
            except (UnicodeDecodeError, OSError):
                continue
            orig = content
            for old, new in REPLACEMENTS:
                content = content.replace(old, new)
            if content != orig:
                with open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(content)
                print("updated:", path)

    print("done.")


if __name__ == "__main__":
    main()
