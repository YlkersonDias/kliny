import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { APP_NAME, PRIVACY } from '../config/app'
import { usePageTitle } from '../hooks/usePageTitle'

const SECTIONS = ['use', 'browser', 'security', 'retention', 'rights', 'changes'] as const

// Política de privacidade, pública (com e sem login). Descreve o que o Kliny faz de verdade; quem
// responde pelos dados, o contato e o prazo das cópias de segurança vêm de PRIVACY (config/app.ts),
// a preencher antes de publicar.
export default function PrivacyPage() {
  const { t } = useTranslation('privacy')
  usePageTitle(t('title'))
  const fill = (value: string) => value || t('who.missing')

  return (
    <div className="min-h-dvh bg-background px-4 py-10">
      <main className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <p className="text-sm font-semibold text-primary">{APP_NAME}</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('updated')}</p>
        <p className="mt-4 text-foreground">{t('intro')}</p>

        <section aria-labelledby="privacidade-responsavel" className="mt-6">
          <h2 id="privacidade-responsavel" className="text-lg font-semibold text-foreground">{t('who.title')}</h2>
          <p className="mt-2 text-muted">
            {t('who.body', { controller: fill(PRIVACY.controller), contact: fill(PRIVACY.contact) })}
          </p>
        </section>

        <section aria-labelledby="privacidade-dados" className="mt-6">
          <h2 id="privacidade-dados" className="text-lg font-semibold text-foreground">{t('data.title')}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>{t('data.account')}</li>
            <li>{t('data.finances')}</li>
            <li>{t('data.nothingElse')}</li>
          </ul>
        </section>

        {SECTIONS.map((section) => (
          <section key={section} aria-labelledby={`privacidade-${section}`} className="mt-6">
            <h2 id={`privacidade-${section}`} className="text-lg font-semibold text-foreground">{t(`${section}.title`)}</h2>
            <p className="mt-2 text-muted">
              {t(`${section}.body`, { backupRetention: fill(PRIVACY.backupRetention) })}
            </p>
          </section>
        ))}

        <Link
          to="/"
          className="mt-8 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('back')}
        </Link>
      </main>
    </div>
  )
}
