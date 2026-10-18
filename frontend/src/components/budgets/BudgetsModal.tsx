import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Budget } from '../../api/types'
import { useCategories } from '../../hooks/useCategories'
import { useSaveBudgets, type BudgetChange } from '../../hooks/useBudgets'
import { parseMoneyInput, toInputText } from '../../lib/money'
import { Button } from '../ui/Button'
import { FormAlert } from '../ui/FormAlert'
import { Modal } from '../ui/Modal'
import { MoneyInput } from '../ui/MoneyInput'
import { Spinner } from '../ui/Spinner'

interface BudgetsModalProps {
  budgets: Budget[]
  onClose: () => void
}

// Campo vazio = sem orçamento. Só o que mudou vai para a API.
export function BudgetsModal({ budgets, onClose }: BudgetsModalProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const categories = useCategories()
  const save = useSaveBudgets()
  const current = new Map(budgets.map((budget) => [budget.categoryId, budget.limit]))
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(budgets.map((budget) => [budget.categoryId, toInputText(budget.limit)])))
  const [errors, setErrors] = useState<Record<number, string | undefined>>({})

  function close() {
    if (!save.isPending) onClose()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const list = categories.data ?? []
    const nextErrors: Record<number, string | undefined> = {}
    const changes: BudgetChange[] = []

    for (const category of list) {
      const text = (values[category.id] ?? '').trim()
      const before = current.get(category.id) ?? null
      if (text === '') {
        if (before !== null) changes.push({ categoryId: category.id, amount: null })
        continue
      }
      const amount = parseMoneyInput(text)
      if (amount === null) nextErrors[category.id] = t('common:validation.amountInvalid')
      else if (amount <= 0) nextErrors[category.id] = t('budgets.form.positive')
      else if (amount !== before) changes.push({ categoryId: category.id, amount })
    }

    setErrors(nextErrors)
    const firstError = list.find((category) => nextErrors[category.id])
    if (firstError) {
      document.getElementById(`orcamento-${firstError.id}`)?.focus()
      return
    }
    if (changes.length === 0) {
      onClose()
      return
    }
    save.mutate(changes, { onSuccess: onClose })
  }

  return (
    <Modal title={t('budgets.form.title')} onClose={close}>
      <p className="text-sm text-muted">{t('budgets.form.description')}</p>
      {categories.isPending ? (
        <div role="status" className="flex justify-center py-8 text-primary">
          <Spinner className="size-6" />
          <span className="sr-only">{t('common:loading')}</span>
        </div>
      ) : categories.isError ? (
        <div className="mt-4"><FormAlert>{categories.error.message}</FormAlert></div>
      ) : categories.data.length === 0 ? (
        <p className="mt-4 text-sm text-foreground">
          {t('budgets.form.noCategories')}{' '}
          <Link to="/movimentacoes" className="font-semibold text-primary underline-offset-2 hover:underline">
            {t('budgets.form.goToTransactions')}
          </Link>
        </p>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-4">
          {save.isError && <FormAlert>{t('budgets.form.saveError', { message: save.error.message })}</FormAlert>}
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {categories.data.map((category) => (
              <MoneyInput
                key={category.id}
                id={`orcamento-${category.id}`}
                label={category.name}
                placeholder={t('budgets.form.placeholder')}
                value={values[category.id] ?? ''}
                onChange={(text) => {
                  setValues((before) => ({ ...before, [category.id]: text }))
                  setErrors((before) => ({ ...before, [category.id]: undefined }))
                }}
                error={errors[category.id]}
                disabled={save.isPending}
              />
            ))}
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={close} disabled={save.isPending}>{t('common:actions.cancel')}</Button>
            <Button type="submit" isLoading={save.isPending}>{t('budgets.form.save')}</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
