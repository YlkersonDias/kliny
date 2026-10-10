import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { InstallmentPlan } from '../../api/types'
import { useDeleteInstallment, useInstallments } from '../../hooks/useInstallments'
import { formatDate } from '../../lib/dates'
import { formatMoney, formatOutflow } from '../../lib/money'
import { Button } from '../ui/Button'
import { ChoiceChip } from '../ui/ChoiceChip'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { FormAlert } from '../ui/FormAlert'
import { IconButton } from '../ui/IconButton'
import { Spinner } from '../ui/Spinner'

// Compras parceladas (8.5b), dentro do modal "Recorrentes e parcelas". Cada parcela é uma
// movimentação e se edita em Movimentações; aqui só se apaga a compra.
export function InstallmentSection() {
  const { t } = useTranslation(['transactions', 'common'])
  const installments = useInstallments()
  const [deleting, setDeleting] = useState<InstallmentPlan | null>(null)

  function renderList() {
    if (installments.isPending) {
      return (
        <div className="flex justify-center py-6 text-primary" role="status">
          <Spinner />
          <span className="sr-only">{t('installments.manager.loading')}</span>
        </div>
      )
    }
    if (installments.isError) {
      return (
        <div className="space-y-3">
          <FormAlert>{installments.error.message}</FormAlert>
          <Button variant="secondary" onClick={() => installments.refetch()}>{t('common:actions.tryAgain')}</Button>
        </div>
      )
    }
    if (installments.data.length === 0) {
      return (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          {t('installments.manager.empty')}
        </p>
      )
    }
    return (
      <ul className="divide-y divide-border rounded-lg border border-border">
        {installments.data.map((plan) => {
          const details = [
            t('installments.manager.split', { count: plan.count }),
            plan.categoryName ?? t('common:uncategorized'),
            plan.remaining > 0
              ? t('installments.manager.remaining', { count: plan.remaining, date: formatDate(plan.lastDate) })
              : t('installments.manager.done'),
          ].join(' · ')
          return (
            <li key={plan.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={`min-w-0 truncate font-medium ${plan.remaining > 0 ? 'text-foreground' : 'text-muted'}`} title={plan.description}>
                    {plan.description}
                  </p>
                  <span className="font-semibold whitespace-nowrap text-expense tabular-nums">
                    <span className="sr-only">{t('amountKind', { kind: t('kind.expense') })}{' '}</span>
                    {formatOutflow(plan.total)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted">{details}</p>
              </div>
              <IconButton icon="trash" label={t('installments.manager.delete', { description: plan.description })} onClick={() => setDeleting(plan)} />
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section aria-labelledby="parcelados-titulo" className="space-y-2">
      <h3 id="parcelados-titulo" className="text-sm font-medium text-foreground">{t('installments.manager.title')}</h3>
      {renderList()}
      {deleting && <DeleteInstallmentDialog plan={deleting} onClose={() => setDeleting(null)} />}
    </section>
  )
}

function DeleteInstallmentDialog({ plan, onClose }: { plan: InstallmentPlan; onClose: () => void }) {
  const { t } = useTranslation('transactions')
  const mutation = useDeleteInstallment()
  // Começa no mais seguro: só as futuras (as já pagas continuam no extrato).
  const [scope, setScope] = useState<'future' | 'all'>('future')

  return (
    <ConfirmDialog
      title={t('installments.delete.title')}
      confirmLabel={t('installments.delete.confirm')}
      isLoading={mutation.isPending}
      error={mutation.error?.message}
      onCancel={onClose}
      onConfirm={() => mutation.mutate({ id: plan.id, scope }, { onSuccess: onClose })}
    >
      <p>
        <Trans t={t} i18nKey="installments.delete.question" values={{ total: formatMoney(plan.total) }} components={{ name: <strong className="font-semibold text-foreground">{plan.description}</strong> }} />
      </p>
      <fieldset className="mt-3">
        <legend className="sr-only">{t('installments.delete.which')}</legend>
        <div className="flex flex-wrap gap-2">
          <ChoiceChip name="escopo" value="future" compact checked={scope === 'future'} label={t('installments.delete.future', { count: plan.remaining })} onChange={() => setScope('future')} />
          <ChoiceChip name="escopo" value="all" compact checked={scope === 'all'} label={t('installments.delete.all')} onChange={() => setScope('all')} />
        </div>
      </fieldset>
      <p className="mt-3">{scope === 'future' ? t('installments.delete.futureNote') : t('installments.delete.allNote')}</p>
    </ConfirmDialog>
  )
}
