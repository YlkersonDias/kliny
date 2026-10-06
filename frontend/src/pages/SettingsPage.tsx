import { useTranslation } from 'react-i18next'
import { ChoiceChip } from '../components/ui/ChoiceChip'
import { usePageTitle } from '../hooks/usePageTitle'
import type { ThemePreference } from '../lib/theme'
import { useTheme } from '../theme/useTheme'

const THEMES: ThemePreference[] = ['light', 'dark', 'system']

// Preferências deste navegador (não da conta). A seção de idioma entra na etapa 7.3.
export default function SettingsPage() {
  const { t } = useTranslation('settings')
  usePageTitle(t('title'))
  const { preference, theme, setPreference } = useTheme()

  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>

      <section aria-labelledby="aparencia" className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 id="aparencia" className="text-lg font-semibold text-foreground">{t('appearance')}</h2>
        <fieldset className="mt-4" aria-describedby="tema-dica">
          <legend className="mb-2 text-sm font-medium text-foreground">{t('theme.legend')}</legend>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((option) => (
              <ChoiceChip
                key={option}
                name="tema"
                value={option}
                checked={preference === option}
                label={t(`theme.${option}`)}
                onChange={() => setPreference(option)}
              />
            ))}
          </div>
          <p id="tema-dica" className="mt-2 text-sm text-muted">
            {preference === 'system'
              ? t('theme.systemHint', { current: theme === 'dark' ? t('theme.currentDark') : t('theme.currentLight') })
              : t('theme.choiceHint')}
          </p>
        </fieldset>
      </section>
    </>
  )
}
