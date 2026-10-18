// Usar sempre esta constante, nunca o nome escrito direto.
export const APP_NAME = 'Kliny'

// Público (o mesmo do appsettings.json da API). Vazio, o botão do Google não aparece.
export const GOOGLE_CLIENT_ID: string = '282663062881-tu50f85sjh7qdht6m64afqmmtsltchgb.apps.googleusercontent.com'

// O prazo das cópias de segurança é o mesmo do deploy/mysql-backup.sh e do deploy/backup.ps1.
export const PRIVACY = {
  contact: 'suporte@kliny.app.br',
  backupRetentionDays: 14,
}
