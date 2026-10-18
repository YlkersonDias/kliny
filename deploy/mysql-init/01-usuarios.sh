#!/bin/sh
# Roda uma vez, quando o volume do MySQL é criado. "%" porque os containers conectam pela rede:
#   kliny_app       → a API, só DML.
#   kliny_migrator  → só as migrations, DML e DDL no banco kliny.
#   kliny_backup    → só leitura, para o mysqldump do backup.
# Nenhum com ALL, *.*, GRANT OPTION, FILE ou SUPER.
set -eu

mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE USER 'kliny_app'@'%' IDENTIFIED BY '${KLINY_APP_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON kliny.* TO 'kliny_app'@'%';

CREATE USER 'kliny_migrator'@'%' IDENTIFIED BY '${KLINY_MIGRATOR_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON kliny.* TO 'kliny_migrator'@'%';

CREATE USER 'kliny_backup'@'%' IDENTIFIED BY '${KLINY_BACKUP_PASSWORD}';
GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES ON kliny.* TO 'kliny_backup'@'%';
SQL
