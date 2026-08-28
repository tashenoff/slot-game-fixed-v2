Add-Type -AssemblyName System.Drawing
$i = [System.Drawing.Image]::FromFile('e:/slot-game-fixed-v2/frontend/public/assets/themes/egypt/bg_mini.png')
Write-Host "Width:" $i.Width "Height:" $i.Height
$i.Dispose()
