// Nome exibido na interface. Usar sempre esta constante, nunca o nome escrito direto.
export const APP_NAME = 'Kliny'

// Login com o Google: o ID do cliente OAuth do Kliny no Google Cloud (público; o mesmo da seção
// Google do appsettings.json da API). Vazio, o botão do Google não aparece em lugar nenhum.
export const GOOGLE_CLIENT_ID: string = '282663062881-tu50f85sjh7qdht6m64afqmmtsltchgb.apps.googleusercontent.com'

// Política de privacidade (/privacidade). PREENCHER ANTES DE PUBLICAR: quem responde pelos dados
// (nome ou empresa), o e-mail para pedidos sobre os dados e por quanto tempo as cópias de segurança
// do banco ficam guardadas (depende da hospedagem). Vazio, a página mostra "[a definir antes da publicação]".
export const PRIVACY = {
  controller: '',
  contact: '',
  backupRetention: '',
}
