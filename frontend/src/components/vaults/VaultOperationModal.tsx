import { useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import type { Vault } from '../../api/types'
import { useDepositToVault, useWithdrawFromVault } from '../../hooks/useVaults'
import { isValidIsoDate, today } from '../../lib/dates'
import { firstInvalidField, splitApiError, type FieldErrors } from '../../lib/forms'
import { formatMoney, parseMoneyInput, toInputText } from '../../lib/money'
import { vaultOperationDateError } from '../../lib/vaults'
import { Button } from '../ui/Button'
import { FormAlert } from '../ui/FormAlert'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { MoneyInput } from '../ui/MoneyInput'

const FIELDS = ['amount', 'date', 'description'] as const
type Field = (typeof FIELDS)[number]

// Mesma regra do VaultOperationRequest da API.
const DESCRIPTION_MAX = 255

export type VaultOperation = 'deposit' | 'withdraw'

interface Values {
  amount: string
  date: string
  description: string
}

const toCents = (value: number) => Math.round(value * 100)

function validate(values: Values, operation: VaultOperation, balance: number): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}

  if (!values.amount.trim()) errors.amount = 'Informe o valor.'
  else {
    const amount = parseMoneyInput(values.amount)
    if (amount === null) errors.amount = 'Valor inválido. Use o formato 1.234,56, com até 2 casas decimais.'
    else if (amount === 0) errors.amount = 'O valor deve ser maior que zero.'
    // A API confere de novo, com o saldo travado; aqui é só para avisar antes.
    else if (operation === 'withdraw' && toCents(amount) > toCents(balance)) {
      errors.amount = `Saldo insuficiente no cofre. Disponível: ${formatMoney(balance)}.`
    }
  }

  if (!values.date) errors.date = 'Informe a data.'
  else if (!isValidIsoDate(values.date)) errors.date = 'Data inválida.'
  else errors.date = vaultOperationDateError(values.date, today())

  if (values.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `A descrição deve ter no máximo ${DESCRIPTION_MAX} caracteres.`
  }
  return errors
}

interface VaultOperationModalProps {
  vault: Vault
  operation: VaultOperation
  // "Retirar saldo" (antes de apagar o cofre) já abre com o saldo inteiro.
  initialAmount?: number
  onClose: () => void
}

export function VaultOperationModal({ vault, operation, initialAmount, onClose }: VaultOperationModalProps) {
  const isWithdraw = operation === 'withdraw'
  const [values, setValues] = useState<Values>({
    amount: initialAmount ? toInputText(initialAmount) : '',
    date: today(),
    description: '',
  })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const deposit = useDepositToVault()
  const withdraw = useWithdrawFromVault()
  const mutation = isWithdraw ? withdraw : deposit

  const title = isWithdraw ? `Retirar de ${vault.name}` : `Depositar em ${vault.name}`

  function showErrors(fieldErrors: FieldErrors<Field>) {
    setErrors(fieldErrors)
    const refs = { amount: amountRef, date: dateRef, description: descriptionRef }
    const first = firstInvalidField(fieldErrors, FIELDS)
    if (first) refs[first].current?.focus()
  }

  function change(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const fieldErrors = validate(values, operation, vault.balance)
    showErrors(fieldErrors)
    if (firstInvalidField(fieldErrors, FIELDS)) return

    const description = values.description.trim()
    const request = {
      amount: parseMoneyInput(values.amount)!,
      date: values.date,
      // Sem descrição, a API usa "Depósito no cofre X" ou "Retirada do cofre X".
      ...(description ? { description } : {}),
    }
    mutation.mutate({ id: vault.id, request }, {
      onSuccess: onClose,
      onError: (error) => {
        // Saldo insuficiente (400 sem campo) pertence ao valor.
        if (error instanceof ApiError && error.status === 400 && Object.keys(error.fieldErrors).length === 0) {
          showErrors({ amount: error.detail })
          return
        }
        const result = splitApiError(error, FIELDS)
        showErrors(result.fieldErrors)
        setFormError(result.formError)
      },
    })
  }

  // Retirada de cofre sem saldo: nada a preencher.
  if (isWithdraw && vault.balance <= 0) {
    return (
      <Modal title={title} size="sm" onClose={onClose}>
        <p className="text-sm text-muted">Este cofre está sem saldo, então não há o que retirar.</p>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={title} initialFocusRef={amountRef} onClose={() => { if (!mutation.isPending) onClose() }}>
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput
            ref={amountRef}
            label="Valor"
            placeholder="0,00"
            hint={isWithdraw
              ? `Disponível: ${formatMoney(vault.balance)}.`
              : 'Não precisa ter o valor lançado na conta.'}
            value={values.amount}
            onChange={(text) => change('amount', text)}
            error={errors.amount}
          />
          <Input
            ref={dateRef}
            label="Data"
            type="date"
            min="0001-01-01"
            max={today()}
            hint="Hoje ou uma data passada."
            value={values.date}
            onChange={(event) => change('date', event.target.value)}
            error={errors.date}
          />
        </div>
        <Input
          ref={descriptionRef}
          label="Descrição (opcional)"
          autoComplete="off"
          maxLength={DESCRIPTION_MAX}
          placeholder={isWithdraw ? `Retirada do cofre ${vault.name}` : `Depósito no cofre ${vault.name}`}
          value={values.description}
          onChange={(event) => change('description', event.target.value)}
          error={errors.description}
        />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button type="submit" isLoading={mutation.isPending}>{isWithdraw ? 'Retirar' : 'Depositar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
