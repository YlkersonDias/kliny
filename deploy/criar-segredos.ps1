# Cria o deploy/.env com senhas e chave do JWT aleatórias (S.7). Não mostra nenhum valor na tela.
# Se o .env já existir, não faz nada: trocar a senha de um usuário do MySQL depois que o banco foi
# criado exige mudar no MySQL também (ver deploy/README.md).
#   powershell -ExecutionPolicy Bypass -File deploy\criar-segredos.ps1
$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot '.env'
if (Test-Path $envFile) {
    Write-Host "O arquivo $envFile já existe; nada foi mudado."
    exit 0
}

function New-Secret([int] $bytes) {
    $buffer = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    # Hex: só letras e números, sem caracteres que quebrem a connection string.
    return -join ($buffer | ForEach-Object { $_.ToString('x2') })
}

$backupDir = Join-Path $env:USERPROFILE 'Kliny-backups'
New-Item -ItemType Directory -Force $backupDir | Out-Null

$lines = @(
    "MYSQL_ROOT_PASSWORD=$(New-Secret 24)",
    "KLINY_APP_PASSWORD=$(New-Secret 24)",
    "KLINY_MIGRATOR_PASSWORD=$(New-Secret 24)",
    "KLINY_BACKUP_PASSWORD=$(New-Secret 24)",
    "JWT_KEY=$(New-Secret 48)",
    "BACKUP_DIR=$backupDir",
    "TUNNEL_TOKEN="
)
# UTF-8 sem BOM: o Docker Compose lê o arquivo como texto puro.
[System.IO.File]::WriteAllLines($envFile, $lines, (New-Object System.Text.UTF8Encoding $false))

# Só o usuário atual lê o arquivo.
icacls $envFile /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
Write-Host "Criado $envFile (só o seu usuário do Windows tem acesso)."
Write-Host "Backups em $backupDir. Falta colar o TUNNEL_TOKEN, quando criar o túnel."
