# Cria, uma vez só, o par de chaves que cifra os backups (deploy/README.md, "Chave dos backups").
# A pública fica em deploy\chave-backup\publica.asc; a privada, protegida por uma frase-senha, vai
# para uma pasta em outro disco e é a única forma de abrir os backups.
#   powershell -ExecutionPolicy Bypass -File deploy\criar-chave-backup.ps1 -Pasta D:\Kliny-chave
param(
    [Parameter(Mandatory = $true)][string]$Pasta
)
$ErrorActionPreference = 'Stop'

$saida = Join-Path $PSScriptRoot 'chave-backup'
$publica = Join-Path $saida 'publica.asc'

try {
    $Pasta = [System.IO.Path]::GetFullPath($Pasta)
    $root = [System.IO.Path]::GetPathRoot($Pasta)
    if (-not (Test-Path $root)) { throw "o disco $root não está disponível: conecte o pen drive e, se ele tiver BitLocker, destranque (dois cliques nele no Explorador)" }
    # A privada no mesmo disco do Kliny não protege nada: quem levasse o disco levaria as duas.
    if ($root -eq [System.IO.Path]::GetPathRoot($PSScriptRoot)) {
        throw "a chave privada precisa ficar em outro disco (o pen drive), e não em $root"
    }
    $privada = Join-Path $Pasta 'kliny-backup-chave-privada.asc'
    # Trocar a chave deixaria os backups antigos só com a privada antiga.
    if (Test-Path $publica) { throw "já existe uma chave em $publica. Para trocar, veja deploy/README.md." }
    if (Test-Path $privada) { throw "já existe $privada" }
    New-Item -ItemType Directory -Force -Path $Pasta | Out-Null

    $primeira = Read-Host 'Frase-senha da chave privada (pelo menos 12 caracteres)' -AsSecureString
    $segunda = Read-Host 'Repita a frase-senha' -AsSecureString
    $frase = [System.Net.NetworkCredential]::new('', $primeira).Password
    if ($frase -ne [System.Net.NetworkCredential]::new('', $segunda).Password) { throw 'as duas frases-senha não são iguais' }
    if ($frase.Length -lt 12) { throw 'a frase-senha precisa ter pelo menos 12 caracteres' }

    # UTF-8 sem BOM: o padrão do PowerShell 5.1 trocaria acentos por "?".
    $OutputEncoding = New-Object System.Text.UTF8Encoding $false
    $linhas = @($frase | & docker run --rm -i --network none `
        -v "${PSScriptRoot}\chave-backup.sh:/kliny/chave-backup.sh:ro" `
        -v "${saida}:/saida" `
        --entrypoint sh mysql:8.4 /kliny/chave-backup.sh)
    $code = $LASTEXITCODE
    Remove-Variable frase
    $chave = ($linhas -join "`n") + "`n"
    Remove-Variable linhas
    if ($code -ne 0 -or $chave -notmatch '-----BEGIN PGP PRIVATE KEY BLOCK-----' -or $chave -notmatch '-----END PGP PRIVATE KEY BLOCK-----') {
        # Sem a privada, a pública não serve.
        Remove-Item $publica -ErrorAction SilentlyContinue
        throw 'a criação da chave falhou'
    }
    [System.IO.File]::WriteAllText($privada, $chave, (New-Object System.Text.ASCIIEncoding))
    Remove-Variable chave
    if (-not (Test-Path $privada -PathType Leaf)) {
        Remove-Item $publica -ErrorAction SilentlyContinue
        throw "a chave privada não foi gravada em $privada"
    }

    Write-Output ''
    Write-Output "Chave pública: $publica"
    Write-Output "Chave privada: $privada"
    Write-Output 'Guarde uma segunda cópia da chave privada e a frase-senha longe do PC: sem as duas, os backups não abrem.'
} catch {
    Write-Output "FALHA  $_"
    exit 1
}
