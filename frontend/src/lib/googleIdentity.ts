import { GOOGLE_CLIENT_ID } from '../config/app'

// Login com o Google (Google Identity Services). O script do Google só é carregado nas telas que
// mostram o botão, nunca no resto do app. O Google pede um único initialize() por página: o
// callback dele entrega o comprovante (ID token) ao botão que foi clicado, identificado pelo
// state de cada botão.

export const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client'

interface CredentialResponse {
  credential?: string
  state?: string
}

export interface GoogleButtonOptions {
  type: 'standard'
  theme: 'outline' | 'filled_black' | 'outline_dark'
  size: 'large' | 'medium' | 'small'
  text: 'signin_with' | 'signup_with' | 'continue_with'
  shape: 'rectangular' | 'pill'
  logo_alignment: 'left' | 'center'
  width: number
  locale: string
  state: string
}

interface GoogleIdentityApi {
  initialize: (config: {
    client_id: string
    callback: (response: CredentialResponse) => void
    auto_select: boolean
    cancel_on_tap_outside: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void
  disableAutoSelect: () => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentityApi } }
  }
}

export const isGoogleEnabled = GOOGLE_CLIENT_ID !== ''

const handlers = new Map<string, (credential: string) => void>()
let loading: Promise<GoogleIdentityApi> | null = null

function dispatch(response: CredentialResponse) {
  if (!response.credential || !response.state) return
  handlers.get(response.state)?.(response.credential)
}

// Carrega o script uma vez e inicializa o cliente. Se falhar (sem rede, bloqueador), a próxima
// chamada tenta de novo.
export function loadGoogleIdentity(): Promise<GoogleIdentityApi> {
  loading ??= new Promise<GoogleIdentityApi>((resolve, reject) => {
    const ready = () => {
      const api = window.google?.accounts?.id
      if (!api) {
        reject(new Error('Google Identity Services indisponível.'))
        return
      }
      api.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: dispatch,
        // Nunca entra sozinho: sempre pelo clique da pessoa.
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      resolve(api)
    }
    if (window.google?.accounts?.id) {
      ready()
      return
    }
    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT
    script.async = true
    script.onload = ready
    script.onerror = () => {
      script.remove()
      reject(new Error('Não foi possível carregar o script do Google.'))
    }
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

// Liga o botão (pelo state) a quem trata o comprovante. Devolve a função que desliga.
export function registerGoogleHandler(state: string, handler: (credential: string) => void): () => void {
  handlers.set(state, handler)
  return () => {
    if (handlers.get(state) === handler) handlers.delete(state)
  }
}

// Ao sair do Kliny, o Google não deve oferecer a mesma conta automaticamente.
export function disableGoogleAutoSelect() {
  window.google?.accounts?.id?.disableAutoSelect()
}
