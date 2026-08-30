Add-Type -AssemblyName System.Drawing
$bmp = new-object System.Drawing.Bitmap("e:\slot-game-fixed-v2\frontend\public\assets\themes\egypt\bg_mini.png")
$w = $bmp.Width; $h = $bmp.Height
Write-Host "Image: $w x $h"
$midY = [int]($h/2)
Write-Host "=== Row Y=$midY (horizontal scan) ==="
for ($x = 0; $x -lt $w; $x++) { if ($bmp.GetPixel($x, $midY).A -gt 128) { Write-Host "Opaque starts at X=$x"; break } }
$inOpaque = $false
for ($x = 0; $x -lt $w; $x++) { if ($bmp.GetPixel($x, $midY).A -gt 128 -and -not $inOpaque) { $inOpaque = $true }; if ($bmp.GetPixel($x, $midY).A -le 128 -and $inOpaque) { Write-Host "Window starts at X=$x"; break } }
for ($x = $w-1; $x -ge 0; $x--) { if ($bmp.GetPixel($x, $midY).A -gt 128) { Write-Host "Opaque ends at X=$x"; break } }
$inOpaqueR = $false
for ($x = $w-1; $x -ge 0; $x--) { if ($bmp.GetPixel($x, $midY).A -gt 128 -and -not $inOpaqueR) { $inOpaqueR = $true }; if ($bmp.GetPixel($x, $midY).A -le 128 -and $inOpaqueR) { Write-Host "Window ends at X=$x"; break } }
$midX = [int]($w/2)
Write-Host "=== Column X=$midX (vertical scan) ==="
for ($y = 0; $y -lt $h; $y++) { if ($bmp.GetPixel($midX, $y).A -gt 128) { Write-Host "Opaque starts at Y=$y"; break } }
$inOpaqueV = $false
for ($y = 0; $y -lt $h; $y++) { if ($bmp.GetPixel($midX, $y).A -gt 128 -and -not $inOpaqueV) { $inOpaqueV = $true }; if ($bmp.GetPixel($midX, $y).A -le 128 -and $inOpaqueV) { Write-Host "Window starts at Y=$y"; break } }
for ($y = $h-1; $y -ge 0; $y--) { if ($bmp.GetPixel($midX, $y).A -gt 128) { Write-Host "Opaque ends at Y=$y"; break } }
$inOpaqueVR = $false
for ($y = $h-1; $y -ge 0; $y--) { if ($bmp.GetPixel($midX, $y).A -gt 128 -and -not $inOpaqueVR) { $inOpaqueVR = $true }; if ($bmp.GetPixel($midX, $y).A -le 128 -and $inOpaqueVR) { Write-Host "Window ends at Y=$y"; break } }
$bmp.Dispose()
