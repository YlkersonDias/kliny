#!/bin/sh
# Roda dentro do container do MySQL (montado em /kliny/backup.sh), chamado pelo deploy/backup.ps1.
# mysqldump compactado com o kliny_backup (só leitura), na pasta /backups (o BACKUP_DIR do .env).
# Apaga os backups com mais de 14 dias, o prazo dito na política de privacidade.
set -eu
file="/backups/kliny-$(date +%Y%m%d-%H%M%S).sql.gz"
# A senha vai por variável de ambiente, e não na linha de comando. Sem LOCK TABLES no arquivo
# (--skip-add-locks): a restauração roda com o kliny_migrator, que não tem esse privilégio.
MYSQL_PWD="$KLINY_BACKUP_PASSWORD" mysqldump -ukliny_backup --single-transaction --no-tablespaces --skip-add-locks kliny | gzip > "$file.tmp"
mv "$file.tmp" "$file"
find /backups -name 'kliny-*.sql.gz' -mtime +14 -delete
echo "Backup criado: $(basename "$file")"
