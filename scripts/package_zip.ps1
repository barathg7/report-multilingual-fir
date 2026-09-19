$zipPath = "report-multilingual-fir.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$excludeDirs = @('node_modules', 'dist', '.git', '.gemini')
$excludeFiles = @('report-multilingual-fir.zip')

Add-Type -AssemblyName System.IO.Compression.FileSystem
$compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')

$baseDir = (Get-Location).Path

Get-ChildItem -Recurse | ForEach-Object {
    $item = $_
    $relPath = $item.FullName.Substring($baseDir.Length + 1)
    
    $skip = $false
    foreach ($d in $excludeDirs) {
        if ($relPath -like "$d\*" -or $relPath -eq $d) {
            $skip = $true
            break
        }
    }
    
    if (-not $skip -and ($excludeFiles -contains $item.Name)) {
        $skip = $true
    }
    
    if (-not $skip -and -not $item.PSIsContainer) {
        $entryName = $relPath.Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $item.FullName, $entryName, $compressionLevel) | Out-Null
    }
}

$zip.Dispose()
$zipItem = Get-Item $zipPath
Write-Host "Created $zipPath : $([math]::Round($zipItem.Length / 1MB, 2)) MB"
