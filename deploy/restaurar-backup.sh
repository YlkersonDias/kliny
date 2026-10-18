#!/bin/sh
# Chamado pelo deploy/restaurar-backup.ps1, num container descartável:
#   restaurar-backup.sh conferir|importar <backup em /backups>
# Pela entrada padrão chegam a frase-senha (primeira linha) e a chave privada (ver chave-backup.sh).
set -eu
mode="$1"
backup="/backups/$2"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
export GNUPGHOME="$work/gnupg"
mkdir -m 700 "$GNUPGHOME"
gz="$work/dump.sql.gz"

IFS= read -r phrase || true
phrase="$(printf '%s' "$phrase" | tr -d '\r')"
tr -d '\r' > "$work/chave.asc"

gpg --batch --quiet --import "$work/chave.asc" 2>/dev/null || { echo "Não foi possível ler a chave privada." >&2; exit 1; }
rm -f "$work/chave.asc"
# Tudo aberto antes de tocar no banco: um arquivo corrompido no meio não deixa o banco pela metade.
if ! printf '%s' "$phrase" | gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 0 \
    --output "$gz" --decrypt "$backup" 2>/dev/null; then
  echo "Não foi possível abrir o backup (frase-senha errada, chave de outro par ou arquivo corrompido)." >&2
  exit 1
fi

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

if [ "$mode" = "conferir" ]; then
  echo "Backup conferido: abre com esta chave e está completo."
  exit 0
fi

gunzip -c "$gz" > "$work/dump.sql"
rm -f "$gz"
MYSQL_PWD="$KLINY_MIGRATOR_PASSWORD" mysql -h mysql -ukliny_migrator --ssl-mode=REQUIRED kliny < "$work/dump.sql"
echo "Backup restaurado."
