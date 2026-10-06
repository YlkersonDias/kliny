import { ChoiceChip } from '../components/ui/ChoiceChip'
import { usePageTitle } from '../hooks/usePageTitle'
import type { ThemePreference } from '../lib/theme'
import { useTheme } from '../theme/useTheme'

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
]

// Preferências deste navegador (não da conta). A seção de idioma entra na etapa 7.3.
export default function SettingsPage() {
  usePageTitle('Configurações')
  const { preference, theme, setPreference } = useTheme()

  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>

      <section aria-labelledby="aparencia" className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 id="aparencia" className="text-lg font-semibold text-foreground">Aparência</h2>
        <fieldset className="mt-4" aria-describedby="tema-dica">
          <legend className="mb-2 text-sm font-medium text-foreground">Tema</legend>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((option) => (
              <ChoiceChip
                key={option.value}
                name="tema"
                value={option.value}
                checked={preference === option.value}
                label={option.label}
                onChange={() => setPreference(option.value)}
              />
            ))}
          </div>
          <p id="tema-dica" className="mt-2 text-sm text-muted">
            {preference === 'system'
              ? `Segue o tema do sistema operacional, agora ${theme === 'dark' ? 'escuro' : 'claro'}.`
              : 'A escolha vale para este navegador.'}
          </p>
        </fieldset>
      </section>
    </>
  )
}
