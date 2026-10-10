// Nome exibido na interface. Usar sempre esta constante, nunca o nome escrito direto.
export const APP_NAME = 'Kliny'

// Login com o Google: o ID do cliente OAuth do Kliny no Google Cloud (público; o mesmo da seção
// Google do appsettings.json da API). Vazio, o botão do Google não aparece em lugar nenhum.
export const GOOGLE_CLIENT_ID: string = '282663062881-tu50f85sjh7qdht6m64afqmmtsltchgb.apps.googleusercontent.com'

// Política de privacidade (/privacidade). O responsável é o desenvolvedor, pessoa física, sem o nome
// na página (decisão do Ylkerson, 10/10/2026): a identificação completa vai a quem pedir pelo
// contato. O contato é o Email Routing da Cloudflare, que repassa para o Gmail dele. O prazo das
// cópias de segurança é o mesmo do deploy/mysql-backup.sh e do deploy/backup.ps1: mudou um, mudar os três.
export const PRIVACY = {
  contact: 'suporte@kliny.app.br',
  backupRetentionDays: 14,
}
