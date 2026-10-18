# Backup do banco: mysqldump compactado, conferido e cifrado com a chave pública, na pasta BACKUP_DIR
# e, se houver, numa cópia em BACKUP_COPY_DIR. Apaga os backups com mais de 14 dias, o prazo da
# política de privacidade. A tarefa agendada o chama todo dia (deploy/README.md, "Backup do banco").
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

# Uma linha por execução; guarda as últimas 200.
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

# No PowerShell 5.1, com 'Stop', o stderr de um programa externo vira erro fatal.
function Invoke-Docker {
    $ErrorActionPreference = 'Continue'
    & docker @args 2>&1 | ForEach-Object { "$_" }
}

# Ao ligar o computador depois do horário da tarefa, o Docker pode ainda estar subindo.
function Wait-Database {
    $deadline = (Get-Date).AddMinutes($DockerWaitMinutes)
    while ((Get-Date) -lt $deadline) {
        # Sem Select-Object -First: com a saída cortada, o $LASTEXITCODE fica -1.
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

    # O script roda dentro do container: o PowerShell 5.1 estraga texto com várias linhas e aspas
    # passado a programas externos.
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
        Get-ChildItem -Path $copyDir -Filter 'kliny-*.sql.gz*' |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
            Remove-Item -Force
        $message += "; cópia em $copyDir"
    }
    Write-Log $message
} catch {
    Write-Log "FALHA  $_"
    exit 1
}
