import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { Recurrence } from '../../api/types'
import { useDeleteRecurrence, useRecurrences, useUpdateRecurrence } from '../../hooks/useRecurrences'
import { formatDate } from '../../lib/dates'
import { formatSigned } from '../../lib/money'
import { recurrenceStatus } from '../../lib/recurrences'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { FormAlert } from '../ui/FormAlert'
import { IconButton } from '../ui/IconButton'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { InstallmentSection } from './InstallmentSection'
import { TransactionFormModal } from './TransactionFormModal'

// Lançamentos recorrentes (8.5a: editar, pausar, retomar e apagar) e compras parceladas (8.5b:
// apagar todas as parcelas ou só as futuras). Os já lançados ficam em Movimentações e se editam lá, um a um.
export function RecurrenceManagerModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['transactions', 'common'])
  const recurrences = useRecurrences()
  const toggle = useUpdateRecurrence()
  const [editing, setEditing] = useState<Recurrence | null>(null)
  const [deleting, setDeleting] = useState<Recurrence | null>(null)

  function togglePaused(recurrence: Recurrence) {
    toggle.mutate({
      id: recurrence.id,
      request: {
        description: recurrence.description,
        amount: recurrence.amount,
        categoryId: recurrence.categoryId,
        endDate: recurrence.endDate,
        paused: !recurrence.paused,
      },
    })
  }

  function renderList() {
    if (recurrences.isPending) {
      return (
        <div className="flex justify-center py-6 text-primary" role="status">
          <Spinner />
          <span className="sr-only">{t('recurring.manager.loading')}</span>
        </div>
      )
    }
    if (recurrences.isError) {
      return (
        <div className="space-y-3">
          <FormAlert>{recurrences.error.message}</FormAlert>
          <Button variant="secondary" onClick={() => recurrences.refetch()}>{t('common:actions.tryAgain')}</Button>
        </div>
      )
    }
    if (recurrences.data.length === 0) {
      return (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          {t('recurring.manager.empty')}
        </p>
      )
    }
    return (
      <ul className="divide-y divide-border rounded-lg border border-border">
        {recurrences.data.map((recurrence) => (
          <RecurrenceItem
            key={recurrence.id}
            recurrence={recurrence}
            isToggling={toggle.isPending && toggle.variables?.id === recurrence.id}
            onToggle={() => togglePaused(recurrence)}
            onEdit={() => setEditing(recurrence)}
            onDelete={() => setDeleting(recurrence)}
          />
        ))}
      </ul>
    )
  }

  return (
    <Modal title={t('recurring.manager.title')} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-muted">{t('recurring.manager.note')}</p>
        <section aria-labelledby="recorrentes-titulo" className="space-y-2">
          <h3 id="recorrentes-titulo" className="text-sm font-medium text-foreground">{t('recurring.manager.recurringTitle')}</h3>
          {toggle.isError && <FormAlert>{toggle.error.message}</FormAlert>}
          {renderList()}
        </section>
        <InstallmentSection />
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>{t('common:actions.close')}</Button>
        </div>
      </div>

      {editing && <TransactionFormModal recurrence={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteRecurrenceDialog recurrence={deleting} onClose={() => setDeleting(null)} />}
    </Modal>
  )
}

function RecurrenceItem({ recurrence, isToggling, onToggle, onEdit, onDelete }: {
  recurrence: Recurrence
  isToggling: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation(['transactions', 'common'])
  const status = recurrenceStatus(recurrence)
  const kind = recurrence.amount > 0 ? 'income' : 'expense'
  const details = [
    t('recurring.everyMonth', { day: recurrence.dayOfMonth }),
    recurrence.categoryName ?? t('common:uncategorized'),
    status === 'paused' ? t('recurring.manager.paused')
      : status === 'ended' ? t('recurring.manager.ended', { date: formatDate(recurrence.endDate!) })
        : t('recurring.manager.next', { date: formatDate(recurrence.nextDate) }),
    status === 'active' && recurrence.endDate ? t('recurring.manager.until', { date: formatDate(recurrence.endDate) }) : '',
  ].filter(Boolean).join(' · ')

  return (
    // No celular, os botões ficam numa linha própria: ao lado, apertariam a descrição até sumir.
    <li className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className={`min-w-0 truncate font-medium ${status === 'active' ? 'text-foreground' : 'text-muted'}`} title={recurrence.description}>
            {recurrence.description}
          </p>
          <span className={`font-semibold tabular-nums whitespace-nowrap ${kind === 'income' ? 'text-income' : 'text-expense'}`}>
            <span className="sr-only">{t('amountKind', { kind: t(`kind.${kind}`) })}{' '}</span>
            {formatSigned(recurrence.amount)}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted">{details}</p>
      </div>
      <div className="flex items-center justify-end gap-1">
        {status !== 'ended' && (
          <Button
            variant="ghost"
            className="min-h-11 px-3 md:min-h-8 md:py-1"
            onClick={onToggle}
            isLoading={isToggling}
            aria-label={recurrence.paused
              ? t('recurring.manager.resumeLabel', { description: recurrence.description })
              : t('recurring.manager.pauseLabel', { description: recurrence.description })}
          >
            {recurrence.paused ? t('recurring.manager.resume') : t('recurring.manager.pause')}
          </Button>
        )}
        <IconButton icon="edit" label={t('recurring.manager.edit', { description: recurrence.description })} onClick={onEdit} />
        <IconButton icon="trash" label={t('recurring.manager.delete', { description: recurrence.description })} onClick={onDelete} />
      </div>
    </li>
  )
}

function DeleteRecurrenceDialog({ recurrence, onClose }: { recurrence: Recurrence; onClose: () => void }) {
  const { t } = useTranslation('transactions')
  const mutation = useDeleteRecurrence()

  return (
    <ConfirmDialog
      title={t('recurring.delete.title')}
      confirmLabel={t('recurring.delete.confirm')}
      isLoading={mutation.isPending}
      error={mutation.error?.message}
      onCancel={onClose}
      onConfirm={() => mutation.mutate(recurrence.id, { onSuccess: onClose })}
    >
      <p>
        <Trans t={t} i18nKey="recurring.delete.question" components={{ name: <strong className="font-semibold text-foreground">{recurrence.description}</strong> }} />
      </p>
      <p className="mt-2">{t('recurring.delete.note')}</p>
    </ConfirmDialog>
  )
}
