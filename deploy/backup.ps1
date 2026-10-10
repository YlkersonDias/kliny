# Backup do banco do Kliny (S.7): um mysqldump compactado e conferido na pasta BACKUP_DIR do
# deploy/.env, com o usuário kliny_backup (só leitura), e uma cópia em BACKUP_COPY_DIR (outro
# disco), se estiver no .env. Nas duas pastas, apaga os backups com mais de 14 dias, o prazo dito
# na política de privacidade (PRIVACY.backupRetention). Roda com o Kliny no ar; a tarefa agendada
# o chama todo dia (ver deploy/README.md, "Backup do banco").
#   powershell -ExecutionPolicy Bypass -File deploy\backup.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$RetentionDays = 14
$Attempts = 3
$DockerWaitMinutes = 15

function Read-EnvValue([string]$name) {
    $line = Get-Content (Join-Path $PSScriptRoot '.env') | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if ($line) { return $line.Substring($name.Length + 1).Trim() }
    return ''
}

$backupDir = Read-EnvValue 'BACKUP_DIR'
$copyDir = Read-EnvValue 'BACKUP_COPY_DIR'
$logFile = Join-Path $backupDir 'backup.log'

# Uma linha por execução, para saber se o backup de cada dia rodou; guarda as últimas 200.
function Write-Log([string]$message) {
    $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $message
    Write-Output $line
    try {
        $old = @()
        if (Test-Path $logFile) { $old = @(Get-Content $logFile | Select-Object -Last 199) }
        Set-Content -Path $logFile -Value ($old + $line) -Encoding UTF8
    } catch {
        Write-Output "Não foi possível escrever o log: $_"
    }
}

# Chama o docker sem deixar o stderr virar erro fatal (no PowerShell 5.1, com 'Stop', ele vira);
# devolve a saída como texto e o código de saída em $LASTEXITCODE.
function Invoke-Docker {
    $ErrorActionPreference = 'Continue'
    & docker @args 2>&1 | ForEach-Object { "$_" }
}

# Às 21h o Docker já está de pé; ao ligar o PC depois do horário (a tarefa roda assim que der),
# ele pode ainda estar subindo.
function Wait-Database {
    $deadline = (Get-Date).AddMinutes($DockerWaitMinutes)
    while ((Get-Date) -lt $deadline) {
        # Sem cortar a saída (Select-Object -First): cortada, o $LASTEXITCODE fica -1.
        $ids = @(Invoke-Docker compose ps -q mysql)
        if ($LASTEXITCODE -eq 0 -and $ids.Count -gt 0 -and $ids[0]) {
            $state = @(Invoke-Docker inspect --format '{{.State.Health.Status}}' $ids[0])
            if ($LASTEXITCODE -eq 0 -and "$($state[0])".Trim() -eq 'healthy') { return }
        }
        Start-Sleep -Seconds 20
    }
    throw "o banco não ficou pronto em $DockerWaitMinutes minutos (o Docker está aberto?)"
}

try {
    if (-not $backupDir) { throw 'BACKUP_DIR não está no deploy/.env' }
    Wait-Database

    # O script roda dentro do container (deploy/mysql-backup.sh): o PowerShell 5.1 estraga texto com
    # várias linhas e aspas passado a programas externos.
    $created = $null
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        $output = Invoke-Docker compose exec -T mysql sh /kliny/backup.sh
        if ($LASTEXITCODE -eq 0) {
            $created = ($output | Where-Object { $_ -like 'Backup criado:*' } | Select-Object -Last 1)
            break
        }
        Write-Log "Tentativa $attempt falhou: $($output -join ' ')"
        if ($attempt -lt $Attempts) { Start-Sleep -Seconds 60 }
    }
    if (-not $created) { throw "o backup falhou nas $Attempts tentativas" }

    $message = "OK  $created"
    if ($copyDir) {
        $name = ($created -replace '^Backup criado: ', '') -replace ' \(.*$', ''
        New-Item -ItemType Directory -Force -Path $copyDir | Out-Null
        Copy-Item -Path (Join-Path $backupDir $name) -Destination $copyDir -Force
        Get-ChildItem -Path $copyDir -Filter 'kliny-*.sql.gz' |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
            Remove-Item -Force
        $message += "; cópia em $copyDir"
    }
    Write-Log $message
} catch {
    Write-Log "FALHA  $_"
    exit 1
}
