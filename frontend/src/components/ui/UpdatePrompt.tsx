import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './Button'

// Nunca recarrega sozinho: a pessoa pode estar no meio de um formulário. Fica fora do
// LanguageProvider, que remonta a tela, para registrar o service worker uma vez só.
export function UpdatePrompt() {
  const { t } = useTranslation()
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()

  return (
    // A região existe desde o início, para o leitor de tela anunciar o aviso quando ele aparecer.
    <div role="status" aria-live="polite">
      {needRefresh && (
        <div className="fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-md flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-lg sm:flex-row sm:items-center md:bottom-6">
          <p className="flex-1 text-sm text-foreground">{t('update.available')}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setNeedRefresh(false)}>{t('update.later')}</Button>
            <Button onClick={() => void updateServiceWorker(true)}>{t('update.reload')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
