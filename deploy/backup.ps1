# Backup do banco do Kliny (S.7): um mysqldump compactado na pasta BACKUP_DIR do deploy/.env,
# com o usuário kliny_backup (só leitura). Apaga os backups com mais de 14 dias, o prazo dito na
# política de privacidade (PRIVACY.backupRetention). Roda com o Kliny no ar.
#   powershell -ExecutionPolicy Bypass -File deploy\backup.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# O script roda dentro do container (deploy/mysql-backup.sh): o PowerShell 5.1 estraga texto com
# várias linhas e aspas passado a programas externos.
docker compose exec -T mysql sh /kliny/backup.sh
if ($LASTEXITCODE -ne 0) { throw "O backup falhou (código $LASTEXITCODE)." }
