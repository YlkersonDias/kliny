#!/bin/sh
# Roda uma vez, quando o volume do MySQL é criado (docker-entrypoint-initdb.d). O banco kliny já
# foi criado pelo MYSQL_DATABASE. Mesmos usuários e privilégios do banco local (S.3), aqui com
# "%" porque os outros containers conectam pela rede interna do Docker, e não por localhost:
#   kliny_app       → a API, só DML (regra 9).
#   kliny_migrator  → só as migrations, DML e DDL no banco kliny.
#   kliny_backup    → só leitura, para o mysqldump do backup.
# Nenhum com ALL, *.*, GRANT OPTION, FILE ou SUPER. As senhas vêm do .env (nunca do repositório).
set -eu

mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE USER 'kliny_app'@'%' IDENTIFIED BY '${KLINY_APP_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON kliny.* TO 'kliny_app'@'%';

CREATE USER 'kliny_migrator'@'%' IDENTIFIED BY '${KLINY_MIGRATOR_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON kliny.* TO 'kliny_migrator'@'%';

CREATE USER 'kliny_backup'@'%' IDENTIFIED BY '${KLINY_BACKUP_PASSWORD}';
GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES ON kliny.* TO 'kliny_backup'@'%';
SQL
