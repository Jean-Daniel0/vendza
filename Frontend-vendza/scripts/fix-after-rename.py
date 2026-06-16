# -*- coding: utf-8 -*-
"""Corrige liens et noms de fichiers après renommage manuel."""
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FILE_RENAMES = [
    ("detailles-des-produits.html", "detail-produit.html"),
    ("client/Panier.html", "client/panier.html"),
    ("vendeur/Abonnement.html", "vendeur/abonnement.html"),
    ("vendeur/Abonnement.js", "vendeur/abonnement.js"),
    ("vendeur/Abonnement.css", "vendeur/abonnement.css"),
    ("client/tableaude-bord-client.html", "client/tableau-de-bord-client.html"),
    ("tableau-de-bordclient.html", "tableau-de-bord-client.html"),
]

REPLACEMENTS = [
    ("detailles des produits.html", "detail-produit.html"),
    ("detailles-des-produits.html", "detail-produit.html"),
    ("detail des produits.js", "detail-produit.js"),
    ("detail-des-produits.js", "detail-produit.js"),
    ("client/Panier.html", "client/panier.html"),
    ("../client/Panier.html", "../client/panier.html"),
    ("profil client.html", "profil-client.html"),
    ("profil client.css", "profil-client.css"),
    ("profil client.js", "profil-client.js"),
    ("profil vendeur.html", "profil-vendeur.html"),
    ("profil vendeur.js", "profil-vendeur.js"),
    ("tableau de bord vendeur.html", "tableau-de-bord-vendeur.html"),
    ("tableau de bord vendeur.js", "tableau-de-bord-vendeur.js"),
    ("mes produit.html", "mes-produit.html"),
    ("commande recu.html", "commande-recu.html"),
    ("commande recu.js", "commande-recu.js"),
    ("boite de reception vendeur.html", "boite-de-reception-vendeur.html"),
    ("boite de reception vendeur.js", "boite-de-reception-vendeur.js"),
    ("historique des commandes.html", "historique-des-commandes.html"),
    ("historique des commandes.js", "historique-des-commandes.js"),
    ("tableau de bord client.html", "tableau-de-bord-client.html"),
    ("tableau de bord client.js", "tableau-de-bord-client.js"),
    ("tableau de bord client.css", "tableau-de-bord-client.css"),
    ("tableaude-bord-client.html", "tableau-de-bord-client.html"),
    ("a propos.html", "a-propos.html"),
    ("a propos.js", "a-propos.js"),
    ("a propos-v2.css", "a-propos-v2.css"),
    ("vendeur/Abonnement.html", "vendeur/abonnement.html"),
    ("vendeur/Abonnement.js", "vendeur/abonnement.js"),
    ("Abonnement.html", "abonnement.html"),
    ("Abonnement.js", "abonnement.js"),
    ("encodeURIComponent('vendeur/Abonnement.html')", "encodeURIComponent('vendeur/abonnement.html')"),
    ("encodeURIComponent('vendeur/profil vendeur.html')", "encodeURIComponent('vendeur/profil-vendeur.html')"),
]

SKIP_DIRS = {".netlify", "node_modules", ".git"}


def rename_file(old_rel, new_rel):
    old = os.path.join(ROOT, old_rel.replace("/", os.sep))
    new = os.path.join(ROOT, new_rel.replace("/", os.sep))
    if os.path.isfile(old) and not os.path.isfile(new):
        os.makedirs(os.path.dirname(new), exist_ok=True)
        shutil.move(old, new)
        print("renamed:", old_rel, "->", new_rel)
    elif os.path.isfile(old) and os.path.isfile(new):
        print("skip rename (exists):", new_rel)


def merge_dashboard_js():
    src = os.path.join(ROOT, "vendeur", "tableau-de-bord-vendeur (2).js")
    dst = os.path.join(ROOT, "vendeur", "tableau-de-bord-vendeur.js")
    if os.path.isfile(src):
        shutil.copy2(src, dst)
        os.remove(src)
        print("merged: tableau-de-bord-vendeur (2).js -> tableau-de-bord-vendeur.js")


def patch_file(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except (OSError, UnicodeDecodeError):
        return
    orig = content
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)
    if content != orig:
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(content)
        print("patched:", path)


def main():
    for old_rel, new_rel in FILE_RENAMES:
        rename_file(old_rel, new_rel)
    merge_dashboard_js()

    dup = os.path.join(ROOT, "detail-des-produits.js")
    if os.path.isfile(dup):
        os.remove(dup)
        print("removed duplicate:", dup)

    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        if "scripts" in dirpath and os.path.basename(dirpath) == "scripts":
            continue
        for name in filenames:
            if not name.endswith((".html", ".js", ".css", ".xml", ".toml", ".txt", ".mjs", ".py")) and name != "_redirects":
                continue
            patch_file(os.path.join(dirpath, name))

    print("done.")


if __name__ == "__main__":
    main()
