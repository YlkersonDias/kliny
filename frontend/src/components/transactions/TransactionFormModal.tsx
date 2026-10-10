import { useRef, useState, type FormEvent } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import type { Category, Recurrence, Transaction } from '../../api/types'
import { useCategories } from '../../hooks/useCategories'
import { useCreateInstallment } from '../../hooks/useInstallments'
import { useCreateRecurrence, useUpdateRecurrence } from '../../hooks/useRecurrences'
import { useCreateTransaction, useUpdateTransaction } from '../../hooks/useTransactions'
import { formatDate, isValidIsoDate, today } from '../../lib/dates'
import { firstInvalidField, splitApiError, type FieldErrors } from '../../lib/forms'
import {
  INSTALLMENT_DESCRIPTION_MAX, INSTALLMENT_MAX, INSTALLMENT_MIN, lastInstallmentDate, parseInstallmentCount, splitInstallments,
} from '../../lib/installments'
import { formatMoney, parseMoneyInput, toInputText } from '../../lib/money'
import { dayOfMonth } from '../../lib/recurrences'
import { Button } from '../ui/Button'
import { ChoiceChip } from '../ui/ChoiceChip'
import { FormAlert } from '../ui/FormAlert'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { MoneyInput } from '../ui/MoneyInput'
import { Select } from '../ui/Select'
import { NewCategoryModal } from './NewCategoryModal'

const FIELDS = ['description', 'amount', 'date', 'count', 'endDate', 'categoryId'] as const
type Field = (typeof FIELDS)[number]

type Kind = 'income' | 'expense'

// Só em nova movimentação: lançar uma vez, todo mês (8.5a) ou em parcelas (8.5b, só gasto).
type Repeat = 'none' | 'monthly' | 'installments'

interface Values {
  kind: Kind
  description: string
  amount: string
  date: string
  categoryId: string // '' = sem categoria
  repeat: Repeat
  endDate: string // '' = sem data final
  count: string // número de parcelas digitado
}

// Mesma regra do TransactionRequest da API (StringLength(255), conferido no backend).
const DESCRIPTION_MAX = 255

interface Rules {
  // A primeira data da recorrência, quando há data final no formulário; senão, null.
  startDate: string | null
  installments: boolean
}

function validate(values: Values, rules: Rules, t: TFunction<['transactions', 'common']>): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  const description = values.description.trim()
  const descriptionMax = rules.installments ? INSTALLMENT_DESCRIPTION_MAX : DESCRIPTION_MAX

  if (!description) errors.description = t('form.descriptionRequired')
  else if (description.length > descriptionMax) errors.description = t('common:validation.descriptionMax', { max: descriptionMax })

  const amount = parseMoneyInput(values.amount)
  if (!values.amount.trim()) errors.amount = t('common:validation.amountRequired')
  else if (amount === null) errors.amount = t('common:validation.amountInvalid')
  else if (amount === 0) errors.amount = t('common:validation.amountPositive')

  if (!values.date) errors.date = t('common:validation.dateRequired')
  else if (!isValidIsoDate(values.date)) errors.date = t('common:validation.dateInvalid')

  if (rules.installments) {
    const count = parseInstallmentCount(values.count)
    if (count === null) errors.count = t('installments.countRange', { min: INSTALLMENT_MIN, max: INSTALLMENT_MAX })
    else if (amount !== null && amount > 0 && Math.round(amount * 100) < count) errors.amount = t('installments.totalTooSmall')
  }

  if (rules.startDate !== null && values.endDate) {
    if (!isValidIsoDate(values.endDate)) errors.endDate = t('common:validation.dateInvalid')
    else if (isValidIsoDate(rules.startDate) && values.endDate < rules.startDate) errors.endDate = t('recurring.endBeforeStart')
  }

  return errors
}

// Nova movimentação já preenchida (como o "Saldo inicial" da conta nova).
export interface TransactionPreset {
  kind: Kind
  description: string
}

function initialValues(transaction?: Transaction, preset?: TransactionPreset, recurrence?: Recurrence): Values {
  // Na edição, o tipo vem do sinal gravado e o valor aparece sempre positivo.
  const saved = transaction ?? recurrence
  if (!saved) {
    return {
      kind: preset?.kind ?? 'expense', description: preset?.description ?? '', amount: '', date: today(), categoryId: '',
      repeat: 'none', endDate: '', count: '',
    }
  }
  return {
    kind: saved.amount > 0 ? 'income' : 'expense',
    description: saved.description,
    amount: toInputText(saved.amount),
    date: transaction?.date ?? recurrence!.startDate,
    categoryId: saved.categoryId === null ? '' : String(saved.categoryId),
    repeat: 'none',
    endDate: recurrence?.endDate ?? '',
    count: '',
  }
}

// Nomes da API que no formulário são outro campo: a primeira data é "date", e o total é "amount".
const API_FIELDS: Record<string, Field> = { startDate: 'date', firstDate: 'date', total: 'amount' }

function withFormFields(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error
  const fieldErrors: Record<string, string> = {}
  for (const [field, message] of Object.entries(error.fieldErrors)) fieldErrors[API_FIELDS[field] ?? field] = message
  return new ApiError(error.status, error.detail, fieldErrors)
}

interface TransactionFormModalProps {
  // Sem transaction nem recurrence: nova movimentação.
  transaction?: Transaction
  // Edição de um lançamento recorrente (8.5a): sem a data, que não muda, e com a data final.
  recurrence?: Recurrence
  // Só para nova movimentação. Com preset, o foco começa no valor.
  preset?: TransactionPreset
  onClose: () => void
}

export function TransactionFormModal({ transaction, recurrence, preset, onClose }: TransactionFormModalProps) {
  const { t } = useTranslation(['transactions', 'common'])
  const isEdit = transaction !== undefined
  const isRecurrenceEdit = recurrence !== undefined
  const isNew = !isEdit && !isRecurrenceEdit
  const [values, setValues] = useState<Values>(() => initialValues(transaction, preset, recurrence))
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const countRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)

  const categories = useCategories()
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const createRecurrence = useCreateRecurrence()
  const updateRecurrence = useUpdateRecurrence()
  const createInstallment = useCreateInstallment()
  const isPending = create.isPending || update.isPending || createRecurrence.isPending || updateRecurrence.isPending
    || createInstallment.isPending

  // Parcelado só vale para gasto: trocar para receita volta a "Não repete" sem apagar o que foi digitado.
  const repeat: Repeat = !isNew ? 'none'
    : values.repeat === 'installments' && values.kind !== 'expense' ? 'none' : values.repeat
  const isRecurring = isRecurrenceEdit || repeat === 'monthly'
  const isInstallments = repeat === 'installments'
  const startDate = isRecurrenceEdit ? recurrence.startDate : values.date
  const day = isRecurrenceEdit ? recurrence.dayOfMonth : (isValidIsoDate(values.date) ? dayOfMonth(values.date) : null)

  // Enquanto a lista carrega, a categoria gravada já aparece no campo.
  const saved = transaction ?? recurrence
  const categoryOptions: Category[] = categories.data
    ?? (saved?.categoryId != null ? [{ id: saved.categoryId, name: saved.categoryName ?? '' }] : [])
  // Categoria apagada enquanto o formulário estava aberto vira "Sem categoria".
  const categoryValue = categoryOptions.some((category) => String(category.id) === values.categoryId) ? values.categoryId : ''

  function showErrors(fieldErrors: FieldErrors<Field>) {
    setErrors(fieldErrors)
    const refs = { description: descriptionRef, amount: amountRef, date: dateRef, count: countRef, endDate: endDateRef, categoryId: categoryRef }
    const first = firstInvalidField(fieldErrors, FIELDS)
    if (first) refs[first].current?.focus()
  }

  function change<K extends keyof Values>(field: K, value: Values[K]) {
    setValues((current) => ({ ...current, [field]: value }))
    if (field !== 'kind' && field !== 'repeat') setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleCategoryCreated(category: Category) {
    change('categoryId', String(category.id))
    setIsCreatingCategory(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const fieldErrors = validate(values, { startDate: isRecurring ? startDate : null, installments: isInstallments }, t)
    showErrors(fieldErrors)
    if (firstInvalidField(fieldErrors, FIELDS)) return

    const amount = parseMoneyInput(values.amount)!
    const request = {
      description: values.description.trim(),
      amount: values.kind === 'income' ? amount : -amount,
      date: values.date,
      categoryId: categoryValue === '' ? null : Number(categoryValue),
    }
    const endDate = values.endDate === '' ? null : values.endDate
    const options = {
      onSuccess: onClose,
      onError: (error: unknown) => {
        const result = splitApiError(withFormFields(error), FIELDS)
        showErrors(result.fieldErrors)
        setFormError(result.formError)
      },
    }

    if (isRecurrenceEdit) {
      updateRecurrence.mutate({
        id: recurrence.id,
        request: { description: request.description, amount: request.amount, categoryId: request.categoryId, endDate, paused: recurrence.paused },
      }, options)
    } else if (isEdit) {
      update.mutate({ id: transaction.id, request }, options)
    } else if (repeat === 'monthly') {
      createRecurrence.mutate({
        description: request.description, amount: request.amount, categoryId: request.categoryId, startDate: request.date, endDate,
      }, options)
    } else if (repeat === 'installments') {
      createInstallment.mutate({
        description: request.description, total: amount, count: parseInstallmentCount(values.count)!, firstDate: request.date,
        categoryId: request.categoryId,
      }, options)
    } else {
      create.mutate(request, options)
    }
  }

  const kindOption = (kind: Kind, label: string) => {
    const checked = values.kind === kind
    // Fundo branco também quando marcado: sobre um fundo tingido o gasto ficaria abaixo de 4,5:1.
    const colors = kind === 'income'
      ? 'has-checked:border-income has-checked:ring-1 has-checked:ring-income has-checked:text-income'
      : 'has-checked:border-expense has-checked:ring-1 has-checked:ring-expense has-checked:text-expense'
    return (
      <label
        className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-background has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${colors}`}
      >
        <input
          type="radio"
          name="kind"
          value={kind}
          checked={checked}
          onChange={() => change('kind', kind)}
          className="sr-only"
        />
        <Icon name={kind} className="size-4" />
        {label}
      </label>
    )
  }

  const title = isRecurrenceEdit ? t('recurring.editTitle') : isEdit ? t('form.editTitle') : t('form.newTitle')
  const shortMonth = day !== null && day > 28 ? t('recurring.shortMonthHint') : ''
  const repeatHint = day === null ? undefined : [t('recurring.repeatHint', { day }), shortMonth].filter(Boolean).join(' ')

  // Prévia das parcelas: quanto fica cada uma e quando termina.
  const total = parseMoneyInput(values.amount)
  const count = parseInstallmentCount(values.count)
  let installmentPreview: string | undefined
  if (isInstallments && total !== null && total > 0 && count !== null && Math.round(total * 100) >= count && isValidIsoDate(values.date)) {
    const { first, each } = splitInstallments(total, count)
    installmentPreview = [
      t('installments.preview', {
        count, each: formatMoney(each), from: formatDate(values.date), to: formatDate(lastInstallmentDate(values.date, count)),
      }),
      first !== each ? t('installments.previewFirst', { first: formatMoney(first) }) : '',
      shortMonth,
    ].filter(Boolean).join(' ')
  }

  const dateLabel = isInstallments ? t('installments.firstDate') : repeat === 'monthly' ? t('recurring.firstDate') : t('common:fields.date')

  const endDateField = (
    <Input
      ref={endDateRef}
      label={t('recurring.endDate')}
      hint={t('recurring.endDateHint')}
      type="date"
      min={isValidIsoDate(startDate) ? startDate : '0001-01-01'}
      max="9999-12-31"
      value={values.endDate}
      onChange={(event) => change('endDate', event.target.value)}
      error={errors.endDate}
    />
  )

  return (
    <Modal
      title={title}
      initialFocusRef={preset && isNew ? amountRef : descriptionRef}
      onClose={() => { if (!isPending) onClose() }}
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        {isRecurrenceEdit && (
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">{t('recurring.everyMonth', { day: recurrence.dayOfMonth })}</span>
            {' · '}
            {t('recurring.editHint')}
          </p>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-foreground">{t('form.type')}</legend>
          <div className="flex gap-2">
            {kindOption('income', t('kind.income'))}
            {kindOption('expense', t('kind.expense'))}
          </div>
        </fieldset>

        <Input
          ref={descriptionRef}
          label={t('form.description')}
          autoComplete="off"
          maxLength={isInstallments ? INSTALLMENT_DESCRIPTION_MAX : DESCRIPTION_MAX}
          hint={isInstallments ? t('installments.descriptionHint') : undefined}
          value={values.description}
          onChange={(event) => change('description', event.target.value)}
          error={errors.description}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput
            ref={amountRef}
            label={isInstallments ? t('installments.total') : t('common:fields.amount')}
            placeholder={t('common:amountPlaceholder')}
            hint={isInstallments ? t('installments.totalHint') : t('form.amountHint')}
            value={values.amount}
            onChange={(text) => change('amount', text)}
            error={errors.amount}
          />
          {isRecurrenceEdit ? endDateField : (
            <Input
              ref={dateRef}
              label={dateLabel}
              type="date"
              min="0001-01-01"
              max="9999-12-31"
              value={values.date}
              onChange={(event) => change('date', event.target.value)}
              error={errors.date}
            />
          )}
        </div>

        {isNew && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <fieldset>
              <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Icon name="repeat" className="size-4 text-muted" />
                {t('repeat.label')}
              </legend>
              <div className="flex flex-wrap gap-2">
                <ChoiceChip name="repetir" value="none" compact checked={repeat === 'none'} label={t('repeat.none')} onChange={() => change('repeat', 'none')} />
                <ChoiceChip name="repetir" value="monthly" compact checked={repeat === 'monthly'} label={t('repeat.monthly')} onChange={() => change('repeat', 'monthly')} />
                {values.kind === 'expense' && (
                  <ChoiceChip name="repetir" value="installments" compact checked={repeat === 'installments'} label={t('repeat.installments')} onChange={() => change('repeat', 'installments')} />
                )}
              </div>
            </fieldset>
            {repeat === 'monthly' && (
              <>
                {repeatHint && <p className="text-sm text-muted">{repeatHint}</p>}
                {endDateField}
              </>
            )}
            {isInstallments && (
              <>
                <Input
                  ref={countRef}
                  label={t('installments.count')}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={3}
                  hint={installmentPreview}
                  value={values.count}
                  onChange={(event) => change('count', event.target.value)}
                  error={errors.count}
                />
              </>
            )}
          </div>
        )}

        <div>
          <Select
            ref={categoryRef}
            label={t('form.category')}
            value={categoryValue}
            onChange={(event) => change('categoryId', event.target.value)}
            error={errors.categoryId ?? (categories.isError ? t('form.categoriesError') : undefined)}
          >
            <option value="">{t('common:uncategorized')}</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => setIsCreatingCategory(true)}
            className="mt-2 inline-flex items-center gap-1 rounded text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Icon name="plus" className="size-4" />
            {t('form.newCategory')}
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>{t('common:actions.cancel')}</Button>
          <Button type="submit" isLoading={isPending}>
            {isNew ? t('form.submitNew') : t('form.submitEdit')}
          </Button>
        </div>
      </form>

      {/* Fora do <form>: um form não pode ficar dentro de outro. */}
      {isCreatingCategory && (
        <NewCategoryModal onCreated={handleCategoryCreated} onClose={() => setIsCreatingCategory(false)} />
      )}
    </Modal>
  )
}
