$pixel = [System.Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
$files = @('bg.png','border.png','baraban.png','preview.png','bg_mini.png')
$dir = 'frontend/public/assets/themes/aztec'
foreach ($file in $files) {
    $path = Join-Path $dir $file
    [System.IO.File]::WriteAllBytes((Resolve-Path $path -ea 0).Path, $pixel) 2>$null
    if (-not (Test-Path $path)) {
        [System.IO.File]::WriteAllBytes((Join-Path (Get-Location).Path $path), $pixel)
    }
}
Write-Host "PNG files created in $dir"