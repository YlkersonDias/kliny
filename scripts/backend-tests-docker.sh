#!/bin/sh
# Roda os testes do backend num container do SDK do .NET, com um MySQL 8.4 descartável, como no CI.
#
#   scripts/backend-tests-docker.sh                                # todos os testes
#   scripts/backend-tests-docker.sh Backend.Tests.MigrationsTests  # só uma classe
#   scripts/backend-tests-docker.sh --down                         # apaga os containers e a rede
#
# Os containers ficam ligados entre uma execução e outra. A senha do MySQL só existe dentro deles.
set -e

NETWORK=kliny-test
MYSQL=kliny-test-mysql
SDK=kliny-test-sdk
REPO="$(cd "$(dirname "$0")/.." && pwd)"
command -v cygpath >/dev/null 2>&1 && REPO="$(cygpath -m "$REPO")"
export MSYS_NO_PATHCONV=1

if [ "$1" = "--down" ]; then
  docker rm -f "$MYSQL" "$SDK" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  echo "Containers e rede de teste apagados."
  exit 0
fi

running() { docker ps --format '{{.Names}}' | grep -qx "$1"; }

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null
if ! running "$MYSQL"; then
  docker rm -f "$MYSQL" >/dev/null 2>&1 || true
  PASSWORD="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
  docker run -d --name "$MYSQL" --network "$NETWORK" -e MYSQL_ROOT_PASSWORD="$PASSWORD" mysql:8.4 >/dev/null
  docker rm -f "$SDK" >/dev/null 2>&1 || true
fi
if ! running "$SDK"; then
  docker rm -f "$SDK" >/dev/null 2>&1 || true
  PASSWORD="$(docker exec "$MYSQL" printenv MYSQL_ROOT_PASSWORD)"
  docker run -d --name "$SDK" --network "$NETWORK" -e MYSQL_ROOT_PASSWORD="$PASSWORD" \
    -v "$REPO:/repo:ro" mcr.microsoft.com/dotnet/sdk:10.0 sleep infinity >/dev/null
fi
until docker exec "$MYSQL" sh -c 'mysqladmin ping -uroot -p"$MYSQL_ROOT_PASSWORD" --silent' >/dev/null 2>&1; do :; done

docker exec -e FILTER="$1" "$SDK" sh -c '
  set -e
  rm -rf /src && mkdir -p /src && cd /repo
  tar --exclude=bin --exclude=obj -cf - backend backend.Tests Kliny.sln global.json | tar -xf - -C /src
  cd /src
  export CI=true KLINY_TEST_MYSQL="Server=kliny-test-mysql;Port=3306;User=root;Password=$MYSQL_ROOT_PASSWORD;AllowPublicKeyRetrieval=true"
  dotnet build Kliny.sln -c Release -v q -nologo
  if [ -n "$FILTER" ]; then
    dotnet test --solution Kliny.sln --no-build -c Release -- --filter-class "$FILTER"
  else
    dotnet test --solution Kliny.sln --no-build -c Release
  fi'
