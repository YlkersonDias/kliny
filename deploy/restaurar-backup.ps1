# Abre um backup cifrado com a chave privada (do pen drive) e confere ou restaura (ver
# deploy/README.md, "Restaurar"). Restaurar apaga o que estiver no banco e põe o backup no lugar.
#   Só conferir:  powershell -ExecutionPolicy Bypass -File deploy\restaurar-backup.ps1 -Arquivo kliny-AAAAMMDD-HHMMSS.sql.gz.gpg -Chave D:\Kliny-chave\kliny-backup-chave-privada.asc -Conferir
#   Restaurar:    o mesmo, sem -Conferir.
# -Arquivo é o nome de um backup da pasta BACKUP_DIR do .env, ou o caminho completo de um backup
# em outra pasta (o pen drive). -Projeto e -EnvFile servem para restaurar numa pilha de teste.
param(
    [Parameter(Mandatory = $true)][string]$Arquivo,
    [Parameter(Mandatory = $true)][string]$Chave,
    [switch]$Conferir,
    [string]$Projeto = 'kliny',
    # Vazio: o deploy\.env. (No PowerShell 5.1, o $PSScriptRoot ainda está vazio no valor padrão de
    # um parâmetro: o padrão é calculado abaixo.)
    [string]$EnvFile = ''
)
$ErrorActionPreference = 'Stop'
if (-not $EnvFile) { $EnvFile = Join-Path $PSScriptRoot '.env' }

function Read-EnvValue([string]$name) {
    $line = Get-Content $EnvFile | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if ($line) { return $line.Substring($name.Length + 1).Trim() }
    return ''
}

$temp = $null
try {
    if (-not (Split-Path $Arquivo -IsAbsolute)) {
        $backupDir = Read-EnvValue 'BACKUP_DIR'
        if (-not $backupDir) { throw "BACKUP_DIR não está no $EnvFile" }
        $Arquivo = Join-Path $backupDir $Arquivo
    }
    foreach ($path in @($Arquivo, $Chave)) {
        $root = [System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($path))
        if (-not (Test-Path $root)) { throw "o disco $root não está disponível: conecte o pen drive e, se ele tiver BitLocker, destranque (dois cliques nele no Explorador)" }
    }
    if (-not (Test-Path $Arquivo -PathType Leaf)) { throw "não achei o backup $Arquivo" }
    if (-not (Test-Path $Chave -PathType Leaf)) { throw "não achei a chave privada $Chave" }

    # O pen drive não é montado no container (o Docker Desktop pode não enxergá-lo): o backup, já
    # cifrado, vai para uma pasta temporária, e a chave segue pela entrada padrão.
    $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("kliny-restaurar-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temp | Out-Null
    $nome = Split-Path $Arquivo -Leaf
    Copy-Item -LiteralPath $Arquivo -Destination (Join-Path $temp $nome)
    $textoChave = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Chave).Path)
    if ($textoChave -notmatch '-----BEGIN PGP PRIVATE KEY BLOCK-----') { throw "$Chave não é uma chave privada" }

    $mode = 'conferir'
    $docker = @('run', '--rm', '-i')
    if ($Conferir) {
        # Só abre e confere: sem rede e sem senha de banco.
        $docker += @('--network', 'none')
    } else {
        Write-Output "Isto APAGA o que estiver no banco do projeto '$Projeto' e põe o backup no lugar."
        if ((Read-Host 'Para continuar, digite RESTAURAR') -cne 'RESTAURAR') { throw 'restauração cancelada' }
        $mode = 'importar'
        # A senha do kliny_migrator vai por variável de ambiente deste processo (-e sem valor),
        # e não na linha de comando.
        $env:KLINY_MIGRATOR_PASSWORD = Read-EnvValue 'KLINY_MIGRATOR_PASSWORD'
        if (-not $env:KLINY_MIGRATOR_PASSWORD) { throw "KLINY_MIGRATOR_PASSWORD não está no $EnvFile" }
        $docker += @('--network', "${Projeto}_kliny", '-e', 'KLINY_MIGRATOR_PASSWORD')
    }

    $secure = Read-Host 'Frase-senha da chave privada' -AsSecureString
    $frase = [System.Net.NetworkCredential]::new('', $secure).Password
    $OutputEncoding = New-Object System.Text.UTF8Encoding $false

    $docker += @(
        '-v', "${PSScriptRoot}\restaurar-backup.sh:/kliny/restaurar-backup.sh:ro",
        '-v', "${temp}:/backups:ro",
        '--entrypoint', 'sh', 'mysql:8.4', '/kliny/restaurar-backup.sh', $mode, $nome)
    # Primeira linha: a frase-senha; depois, a chave privada.
    @($frase) + ($textoChave -split "`r?`n") | & docker @docker
    $code = $LASTEXITCODE
    Remove-Variable frase, textoChave
    if ($code -ne 0) { throw 'não deu certo (mensagem acima)' }
} catch {
    Write-Output "FALHA  $_"
    exit 1
} finally {
    Remove-Item Env:KLINY_MIGRATOR_PASSWORD -ErrorAction SilentlyContinue
    if ($temp) { Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue }
}
