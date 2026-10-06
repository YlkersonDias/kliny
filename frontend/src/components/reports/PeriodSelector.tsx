import { useTranslation } from 'react-i18next'
import type { ReportPeriod, TimelineGrouping } from '../../api/types'
import { MAX_DAYS_BY_DAY, PRESETS, type PeriodPreset } from '../../lib/reportPeriods'
import { ChoiceChip as Choice } from '../ui/ChoiceChip'
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

export function PeriodSelector({
  preset, period, periodError, grouping, dayAllowed, onPresetChange, onPeriodChange, onGroupingChange,
}: PeriodSelectorProps) {
  const { t } = useTranslation(['reports', 'common'])
  return (
    <section aria-label={t('period.label')} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">{t('period.label')}</legend>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((option) => (
              <Choice
                key={option}
                name="periodo"
                value={option}
                checked={preset === option}
                label={t(`period.presets.${option}`)}
                onChange={() => onPresetChange(option)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">{t('period.timeline')}</legend>
          <div className="flex flex-wrap gap-2">
            <Choice name="agrupar" value="dia" checked={grouping === 'day'} disabled={!dayAllowed} label={t('period.byDay')} onChange={() => onGroupingChange('day')} />
            <Choice name="agrupar" value="mes" checked={grouping === 'month'} label={t('period.byMonth')} onChange={() => onGroupingChange('month')} />
          </div>
          {!dayAllowed && (
            <p className="mt-1.5 max-w-xs text-sm text-muted">
              {t('period.dayLimit', { max: MAX_DAYS_BY_DAY })}
            </p>
          )}
        </fieldset>
      </div>

      {preset === 'personalizado' && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:max-w-md sm:grid-cols-2">
          <Input
            label={t('common:fields.from')}
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={period.from}
            onChange={(event) => onPeriodChange({ ...period, from: event.target.value })}
          />
          <Input
            label={t('common:fields.to')}
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
