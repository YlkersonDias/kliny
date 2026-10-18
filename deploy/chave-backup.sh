#!/bin/sh
# Chamado pelo deploy/criar-chave-backup.ps1, num container descartável. A pública vai para /saida;
# a privada sai pela saída padrão. O disco removível nunca é montado no container: o Docker Desktop
# não enxerga um disco destrancado depois de subir e gravaria dentro da própria VM, em silêncio.
# A frase-senha chega pela entrada padrão, nunca pela linha de comando.
set -eu
IFS= read -r phrase || true
phrase="$(printf '%s' "$phrase" | tr -d '\r')"
if [ "${#phrase}" -lt 12 ]; then
  echo "A frase-senha precisa ter pelo menos 12 caracteres." >&2
  exit 1
fi

export GNUPGHOME="$(mktemp -d)"
trap 'rm -rf "$GNUPGHOME"' EXIT

printf '%s' "$phrase" | gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 0 \
  --quick-gen-key "Kliny backups" rsa4096 encr never
fingerprint="$(gpg --batch --with-colons --list-keys | awk -F: '/^fpr:/ { print $10; exit }')"

gpg --batch --armor --export "$fingerprint" > /saida/publica.asc
echo "Chave criada: $fingerprint" >&2
# Só a chave privada na saída padrão: o PowerShell grava tudo o que sair aqui.
printf '%s' "$phrase" | gpg --batch --armor --pinentry-mode loopback --passphrase-fd 0 \
  --export-secret-keys "$fingerprint"
