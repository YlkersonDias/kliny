#!/bin/sh
# Roda dentro do container do MySQL (montado em /kliny/backup.sh), chamado pelo deploy/backup.ps1.
# mysqldump compactado com o kliny_backup (só leitura), conferido e cifrado com a chave pública
# dos backups (deploy/chave-backup/publica.asc). Na pasta /backups (o BACKUP_DIR do .env) só chega
# o arquivo cifrado: o dump em claro fica no /tmp do container e é apagado no fim. Apaga os backups
# com mais de 14 dias, o prazo dito na política de privacidade.
set -eu
key="/kliny/chave/publica.asc"
file="/backups/kliny-$(date +%Y%m%d-%H%M%S).sql.gz.gpg"
tmp="$file.tmp"
work="$(mktemp -d)"
trap 'rm -rf "$work"; rm -f "$tmp"' EXIT
raw="$work/dump.sql"
gz="$work/dump.sql.gz"

# Sem a chave pública, nada de backup: nunca cai para um arquivo em claro.
if [ ! -s "$key" ]; then
  echo "Falta a chave pública dos backups (deploy/chave-backup/publica.asc; ver deploy/README.md)." >&2
  exit 1
fi

# A senha vai por variável de ambiente, e não na linha de comando. Sem LOCK TABLES no arquivo
# (--skip-add-locks): a restauração roda com o kliny_migrator, que não tem esse privilégio.
# Primeiro para um arquivo e depois o gzip: num pipe, o sh perde o código de saída do mysqldump.
if ! MYSQL_PWD="$KLINY_BACKUP_PASSWORD" mysqldump -ukliny_backup --ssl-mode=REQUIRED --single-transaction --no-tablespaces --skip-add-locks kliny > "$raw"; then
  echo "O mysqldump falhou." >&2
  exit 1
fi
gzip -c "$raw" > "$gz"
rm -f "$raw"

# Um backup quebrado ou vazio passaria em silêncio: confere que o gzip está inteiro, que as tabelas
# principais estão lá e que o dump chegou ao fim (o mysqldump escreve "Dump completed" na última linha).
# A conferência é antes da cifra: depois, só a chave privada (fora do PC) abre o arquivo.
gunzip -t "$gz"
for table in __EFMigrationsHistory Users Transactions; do
  if ! gunzip -c "$gz" | grep -q "CREATE TABLE \`$table\`"; then
    echo "O backup não tem a tabela $table." >&2
    exit 1
  fi
done
if ! gunzip -c "$gz" | tail -n 1 | grep -q "Dump completed"; then
  echo "O backup está incompleto." >&2
  exit 1
fi

# Cifra para a chave pública, num GNUPGHOME descartável (nenhum chaveiro fica no container).
export GNUPGHOME="$work/gnupg"
mkdir -m 700 "$GNUPGHOME"
if ! gpg --batch --quiet --yes --recipient-file "$key" --output "$tmp" --encrypt "$gz"; then
  echo "A cifra do backup falhou." >&2
  exit 1
fi
if ! gpg --batch --list-packets "$tmp" 2>/dev/null | grep -q "pubkey enc packet"; then
  echo "O arquivo cifrado não parece válido." >&2
  exit 1
fi

mv "$tmp" "$file"
find /backups -name 'kliny-*.sql.gz*' -mtime +14 -delete
echo "Backup criado: $(basename "$file") ($(wc -c < "$file") bytes)"
