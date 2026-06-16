# Renomme les fichiers Vendza en kebab-case et met a jour les references
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path (Join-Path $root "index.html"))) {
  $root = Split-Path -Parent $PSScriptRoot
}

$renames = @{
  "a propos.html" = "a-propos.html"
  "a propos.js" = "a-propos.js"
  "a propos-v2.css" = "a-propos-v2.css"
  "detailles des produits.html" = "detail-produit.html"
  "detail des produits.js" = "detail-produit.js"
  "detailles des produits.temp.html" = "detail-produit.temp.html"
  "detail des produit.temp.css" = "detail-produit.temp.css"
  "catalogue produit.js" = "catalogue-produit.js"
  "historique des commandes.html" = "historique-commandes.html"
  "tableau de bord client.html" = "tableau-de-bord-client.html"
  "client\Panier.html" = "client\panier.html"
  "client\profil client.html" = "client\profil-client.html"
  "client\profil client.js" = "client\profil-client.js"
  "client\historique des commandes.html" = "client\historique-commandes.html"
  "client\historique des commandes.js" = "client\historique-commandes.js"
  "client\historique des commandes.css" = "client\historique-commandes.css"
  "client\tableau de bord client.html" = "client\tableau-de-bord-client.html"
  "client\tableau de bord client.js" = "client\tableau-de-bord-client.js"
  "vendeur\profil vendeur.html" = "vendeur\profil-vendeur.html"
  "vendeur\profil vendeur.js" = "vendeur\profil-vendeur.js"
  "vendeur\boite de reception vendeur.html" = "vendeur\boite-reception.html"
  "vendeur\boite de reception vendeur.js" = "vendeur\boite-reception.js"
  "vendeur\tableau de bord vendeur.html" = "vendeur\tableau-de-bord.html"
  "vendeur\tableau de bord vendeur.js" = "vendeur\tableau-de-bord.js"
  "vendeur\commande recu.html" = "vendeur\commande-recu.html"
  "vendeur\commande recu.js" = "vendeur\commande-recu.js"
  "vendeur\mes produit.html" = "vendeur\mes-produits.html"
  "vendeur\Abonnement.html" = "vendeur\abonnement.html"
  "vendeur\Abonnement.js" = "vendeur\abonnement.js"
}

foreach ($key in $renames.Keys) {
  $old = Join-Path $root $key
  $new = Join-Path $root $renames[$key]
  if (Test-Path $old) {
    $dir = Split-Path $new -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Move-Item -LiteralPath $old -Destination $new -Force
    Write-Host "OK: $key -> $($renames[$key])"
  }
}

$replacements = @{
  "a propos.html" = "a-propos"
  "a%20propos.html" = "a-propos"
  "detailles des produits.html" = "detail-produit"
  "detail des produits.js" = "detail-produit.js"
  "profil vendeur.html" = "profil-vendeur"
  "profil vendeur.js" = "profil-vendeur.js"
  "boite de reception vendeur.html" = "boite-reception"
  "boite de reception vendeur.js" = "boite-reception.js"
  "tableau de bord vendeur.html" = "tableau-de-bord"
  "tableau de bord vendeur.js" = "tableau-de-bord.js"
  "commande recu.html" = "commande-recu"
  "commande recu.js" = "commande-recu.js"
  "mes produit.html" = "mes-produits"
  "mes-produit.js" = "mes-produit.js"
  "historique des commandes.html" = "historique-commandes"
  "historique des commandes.js" = "historique-commandes.js"
  "profil client.html" = "profil-client"
  "profil client.js" = "profil-client.js"
  "tableau de bord client.html" = "tableau-de-bord-client"
  "tableau de bord client.js" = "tableau-de-bord-client.js"
  "client/Panier.html" = "client/panier"
  "client/Panier.html" = "client/panier"
  "Panier.html" = "panier"
  "Abonnement.html" = "abonnement"
  "Abonnement.js" = "abonnement.js"
  "catalogue produit.js" = "catalogue-produit.js"
  "a propos.js" = "a-propos.js"
  "a propos-v2.css" = "a-propos-v2.css"
}

$files = Get-ChildItem -Path $root -Recurse -Include *.html,*.js,*.css,*.toml,*.xml,_redirects -File |
  Where-Object { $_.FullName -notmatch '\\\.netlify\\' -and $_.FullName -notmatch '\\node_modules\\' }

foreach ($file in $files) {
  $content = [System.IO.File]::ReadAllText($file.FullName)
  $orig = $content
  foreach ($pair in $replacements.GetEnumerator()) {
    $content = $content.Replace($pair.Key, $pair.Value)
  }
  if ($content -ne $orig) {
    [System.IO.File]::WriteAllText($file.FullName, $content)
    Write-Host "Updated: $($file.Name)"
  }
}

Write-Host "Termine."
