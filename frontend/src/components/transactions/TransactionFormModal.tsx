import { useRef, useState, type FormEvent } from 'react'
import type { Category, Transaction } from '../../api/types'
import { useCategories } from '../../hooks/useCategories'
import { useCreateTransaction, useUpdateTransaction } from '../../hooks/useTransactions'
import { isValidIsoDate, today } from '../../lib/dates'
import { firstInvalidField, splitApiError, type FieldErrors } from '../../lib/forms'
import { parseMoneyInput, toInputText } from '../../lib/money'
import { Button } from '../ui/Button'
import { FormAlert } from '../ui/FormAlert'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { MoneyInput } from '../ui/MoneyInput'
import { Select } from '../ui/Select'
import { NewCategoryModal } from './NewCategoryModal'

const FIELDS = ['description', 'amount', 'date', 'categoryId'] as const
type Field = (typeof FIELDS)[number]

type Kind = 'income' | 'expense'

interface Values {
  kind: Kind
  description: string
  amount: string
  date: string
  categoryId: string // '' = sem categoria
}

// Mesma regra do TransactionRequest da API (StringLength(255), conferido no backend).
const DESCRIPTION_MAX = 255

function validate(values: Values): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  const description = values.description.trim()

  if (!description) errors.description = 'Informe a descrição.'
  else if (description.length > DESCRIPTION_MAX) errors.description = `A descrição deve ter no máximo ${DESCRIPTION_MAX} caracteres.`

  if (!values.amount.trim()) errors.amount = 'Informe o valor.'
  else {
    const amount = parseMoneyInput(values.amount)
    if (amount === null) errors.amount = 'Valor inválido. Use o formato 1.234,56, com até 2 casas decimais.'
    else if (amount === 0) errors.amount = 'O valor deve ser maior que zero.'
  }

  if (!values.date) errors.date = 'Informe a data.'
  else if (!isValidIsoDate(values.date)) errors.date = 'Data inválida.'

  return errors
}

// Nova movimentação já preenchida (como o "Saldo inicial" da conta nova).
export interface TransactionPreset {
  kind: Kind
  description: string
}

function initialValues(transaction?: Transaction, preset?: TransactionPreset): Values {
  if (!transaction) {
    return { kind: preset?.kind ?? 'expense', description: preset?.description ?? '', amount: '', date: today(), categoryId: '' }
  }
  return {
    // Na edição, o tipo vem do sinal gravado e o valor aparece sempre positivo.
    kind: transaction.amount > 0 ? 'income' : 'expense',
    description: transaction.description,
    amount: toInputText(transaction.amount),
    date: transaction.date,
    categoryId: transaction.categoryId === null ? '' : String(transaction.categoryId),
  }
}

interface TransactionFormModalProps {
  // Sem transaction: nova movimentação.
  transaction?: Transaction
  // Só para nova movimentação. Com preset, o foco começa no valor.
  preset?: TransactionPreset
  onClose: () => void
}

export function TransactionFormModal({ transaction, preset, onClose }: TransactionFormModalProps) {
  const isEdit = transaction !== undefined
  const [values, setValues] = useState<Values>(() => initialValues(transaction, preset))
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)

  const categories = useCategories()
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const isPending = create.isPending || update.isPending

  // Enquanto a lista carrega, a categoria gravada já aparece no campo.
  const categoryOptions: Category[] = categories.data
    ?? (transaction?.categoryId != null ? [{ id: transaction.categoryId, name: transaction.categoryName ?? '' }] : [])
  // Categoria apagada enquanto o formulário estava aberto vira "Sem categoria".
  const categoryValue = categoryOptions.some((category) => String(category.id) === values.categoryId) ? values.categoryId : ''

  function showErrors(fieldErrors: FieldErrors<Field>) {
    setErrors(fieldErrors)
    const refs = { description: descriptionRef, amount: amountRef, date: dateRef, categoryId: categoryRef }
    const first = firstInvalidField(fieldErrors, FIELDS)
    if (first) refs[first].current?.focus()
  }

  function change<K extends keyof Values>(field: K, value: Values[K]) {
    setValues((current) => ({ ...current, [field]: value }))
    if (field !== 'kind') setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleCategoryCreated(category: Category) {
    change('categoryId', String(category.id))
    setIsCreatingCategory(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const fieldErrors = validate(values)
    showErrors(fieldErrors)
    if (firstInvalidField(fieldErrors, FIELDS)) return

    const amount = parseMoneyInput(values.amount)!
    const request = {
      description: values.description.trim(),
      amount: values.kind === 'income' ? amount : -amount,
      date: values.date,
      categoryId: categoryValue === '' ? null : Number(categoryValue),
    }
    const options = {
      onSuccess: onClose,
      onError: (error: unknown) => {
        const result = splitApiError(error, FIELDS)
        showErrors(result.fieldErrors)
        setFormError(result.formError)
      },
    }

    if (isEdit) update.mutate({ id: transaction.id, request }, options)
    else create.mutate(request, options)
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

  return (
    <Modal
      title={isEdit ? 'Editar movimentação' : 'Nova movimentação'}
      initialFocusRef={preset && !isEdit ? amountRef : descriptionRef}
      onClose={() => { if (!isPending) onClose() }}
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-foreground">Tipo</legend>
          <div className="flex gap-2">
            {kindOption('income', 'Receita')}
            {kindOption('expense', 'Gasto')}
          </div>
        </fieldset>

        <Input
          ref={descriptionRef}
          label="Descrição"
          autoComplete="off"
          maxLength={DESCRIPTION_MAX}
          value={values.description}
          onChange={(event) => change('description', event.target.value)}
          error={errors.description}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput
            ref={amountRef}
            label="Valor"
            placeholder="0,00"
            hint="Sempre positivo: o tipo define se entra ou sai."
            value={values.amount}
            onChange={(text) => change('amount', text)}
            error={errors.amount}
          />
          <Input
            ref={dateRef}
            label="Data"
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={values.date}
            onChange={(event) => change('date', event.target.value)}
            error={errors.date}
          />
        </div>

        <div>
          <Select
            ref={categoryRef}
            label="Categoria (opcional)"
            value={categoryValue}
            onChange={(event) => change('categoryId', event.target.value)}
            error={errors.categoryId ?? (categories.isError ? 'Não foi possível carregar as categorias.' : undefined)}
          >
            <option value="">Sem categoria</option>
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
            Nova categoria
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button type="submit" isLoading={isPending}>
            {isEdit ? 'Salvar alterações' : 'Adicionar'}
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
