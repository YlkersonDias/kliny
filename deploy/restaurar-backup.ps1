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
    [string]$EnvFile = (Join-Path $PSScriptRoot '.env')
)
$ErrorActionPreference = 'Stop'

function Read-EnvValue([string]$name) {
    $line = Get-Content $EnvFile | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if ($line) { return $line.Substring($name.Length + 1).Trim() }
    return ''
}

try {
    if (-not (Split-Path $Arquivo -IsAbsolute)) {
        $backupDir = Read-EnvValue 'BACKUP_DIR'
        if (-not $backupDir) { throw "BACKUP_DIR não está no $EnvFile" }
        $Arquivo = Join-Path $backupDir $Arquivo
    }
    if (-not (Test-Path $Arquivo -PathType Leaf)) { throw "não achei o backup $Arquivo" }
    if (-not (Test-Path $Chave -PathType Leaf)) { throw "não achei a chave privada $Chave" }
    $Arquivo = (Resolve-Path $Arquivo).Path
    $Chave = (Resolve-Path $Chave).Path

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
        '-v', "$(Split-Path $Arquivo -Parent):/backups:ro",
        '-v', "$(Split-Path $Chave -Parent):/chave:ro",
        '--entrypoint', 'sh', 'mysql:8.4', '/kliny/restaurar-backup.sh',
        $mode, (Split-Path $Arquivo -Leaf), (Split-Path $Chave -Leaf))
    $frase | & docker @docker
    $code = $LASTEXITCODE
    Remove-Variable frase
    if ($code -ne 0) { throw 'não deu certo (mensagem acima)' }
} catch {
    Write-Output "FALHA  $_"
    exit 1
} finally {
    Remove-Item Env:KLINY_MIGRATOR_PASSWORD -ErrorAction SilentlyContinue
}
