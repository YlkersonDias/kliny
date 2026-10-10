#!/bin/sh
# Roda dentro do container do MySQL (montado em /kliny/backup.sh), chamado pelo deploy/backup.ps1.
# mysqldump compactado com o kliny_backup (só leitura), na pasta /backups (o BACKUP_DIR do .env).
# Confere o arquivo antes de dá-lo por pronto e apaga os backups com mais de 14 dias, o prazo dito
# na política de privacidade.
set -eu
file="/backups/kliny-$(date +%Y%m%d-%H%M%S).sql.gz"
tmp="$file.tmp"
raw="/backups/.kliny-dump.sql"
trap 'rm -f "$tmp" "$raw"' EXIT

# A senha vai por variável de ambiente, e não na linha de comando. Sem LOCK TABLES no arquivo
# (--skip-add-locks): a restauração roda com o kliny_migrator, que não tem esse privilégio.
# Primeiro para um arquivo e depois o gzip: num pipe, o sh perde o código de saída do mysqldump.
if ! MYSQL_PWD="$KLINY_BACKUP_PASSWORD" mysqldump -ukliny_backup --single-transaction --no-tablespaces --skip-add-locks kliny > "$raw"; then
  echo "O mysqldump falhou." >&2
  exit 1
fi
gzip -c "$raw" > "$tmp"
rm -f "$raw"

# Um backup quebrado ou vazio passaria em silêncio: confere que o gzip está inteiro, que as tabelas
# principais estão lá e que o dump chegou ao fim (o mysqldump escreve "Dump completed" na última linha).
gunzip -t "$tmp"
for table in __EFMigrationsHistory Users Transactions; do
  if ! gunzip -c "$tmp" | grep -q "CREATE TABLE \`$table\`"; then
    echo "O backup não tem a tabela $table." >&2
    exit 1
  fi
done
if ! gunzip -c "$tmp" | tail -n 1 | grep -q "Dump completed"; then
  echo "O backup está incompleto." >&2
  exit 1
fi

mv "$tmp" "$file"
find /backups -name 'kliny-*.sql.gz' -mtime +14 -delete
echo "Backup criado: $(basename "$file") ($(wc -c < "$file") bytes)"
