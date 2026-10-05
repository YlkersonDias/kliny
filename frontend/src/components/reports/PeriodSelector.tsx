import type { ReportPeriod, TimelineGrouping } from '../../api/types'
import { MAX_DAYS_BY_DAY, PRESETS, type PeriodPreset } from '../../lib/reportPeriods'
import { Input } from '../ui/Input'

interface PeriodSelectorProps {
  preset: PeriodPreset
  period: ReportPeriod
  periodError?: string
  grouping: TimelineGrouping
  dayAllowed: boolean
  onPresetChange: (preset: PeriodPreset) => void
  onPeriodChange: (period: ReportPeriod) => void
  onGroupingChange: (grouping: TimelineGrouping) => void
}

// Opção de radio com aparência de botão: o <input> é de verdade (sr-only), a <label> é o alvo.
function Choice({ name, value, checked, disabled, label, onChange }: {
  name: string
  value: string
  checked: boolean
  disabled?: boolean
  label: string
  onChange: () => void
}) {
  return (
    <label
      className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${
        disabled
          ? 'cursor-not-allowed border-border text-muted opacity-60'
          : 'cursor-pointer border-border text-muted hover:bg-background has-checked:border-primary has-checked:bg-primary has-checked:text-white'
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} className="sr-only" />
      {label}
    </label>
  )
}

export function PeriodSelector({
  preset, period, periodError, grouping, dayAllowed, onPresetChange, onPeriodChange, onGroupingChange,
}: PeriodSelectorProps) {
  return (
    <section aria-label="Período" className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">Período</legend>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((option) => (
              <Choice
                key={option.value}
                name="periodo"
                value={option.value}
                checked={preset === option.value}
                label={option.label}
                onChange={() => onPresetChange(option.value)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">Linha do tempo</legend>
          <div className="flex flex-wrap gap-2">
            <Choice name="agrupar" value="dia" checked={grouping === 'day'} disabled={!dayAllowed} label="Por dia" onChange={() => onGroupingChange('day')} />
            <Choice name="agrupar" value="mes" checked={grouping === 'month'} label="Por mês" onChange={() => onGroupingChange('month')} />
          </div>
          {!dayAllowed && (
            <p className="mt-1.5 max-w-xs text-sm text-muted">
              Por dia só vale para períodos de até {MAX_DAYS_BY_DAY} dias.
            </p>
          )}
        </fieldset>
      </div>

      {preset === 'personalizado' && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:max-w-md sm:grid-cols-2">
          <Input
            label="De"
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={period.from}
            onChange={(event) => onPeriodChange({ ...period, from: event.target.value })}
          />
          <Input
            label="Até"
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={period.to}
            onChange={(event) => onPeriodChange({ ...period, to: event.target.value })}
            error={periodError}
          />
        </div>
      )}
    </section>
  )
}
