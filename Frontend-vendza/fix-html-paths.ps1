$root = Get-Location
Get-ChildItem -Path $root -Recurse -Filter *.html | ForEach-Object {
    $relativePath = $_.DirectoryName.Substring($root.Path.Length).TrimStart('\','/')
    $depth = if ($relativePath) { ($relativePath -split '[\\/]').Length } else { 0 }
    $prefix = ('../' * $depth)
    $content = Get-Content -Raw -LiteralPath $_.FullName

    $updated = $content -replace '<base\s+href="[^"]*"\s*/?>\s*', ''
    $updated = $updated -replace '<script\s+src="/vendza-fix-assets\.js"\s*>\s*</script>', '<script src="' + $prefix + 'vendza-fix-assets.js"></script>'
    $updated = $updated -replace '<script\s+src="/vendza-urls\.js"\s*>\s*</script>', '<script src="' + $prefix + 'vendza-urls.js"></script>'

    if ($updated -ne $content) {
        Set-Content -LiteralPath $_.FullName -Value $updated
        Write-Host "Updated: $($_.FullName)"
    }
}
