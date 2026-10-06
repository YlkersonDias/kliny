import { useRef, useState, type FormEvent } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import type { Vault } from '../../api/types'
import { useSummary } from '../../hooks/useReports'
import { useDepositToVault, useWithdrawFromVault } from '../../hooks/useVaults'
import { formatDate, isValidIsoDate, today } from '../../lib/dates'
import { firstInvalidField, splitApiError, type FieldErrors } from '../../lib/forms'
import { formatMoney, parseMoneyInput, toInputText } from '../../lib/money'
import { depositShortfallMessage, exceedsAccountBalance, formatAccountBalance, vaultOperationDateError } from '../../lib/vaults'
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

// accountAvailable: saldo da conta na data do depósito; undefined enquanto carrega (ou se a consulta
// falhar): aí só a API confere.
function validate(
  values: Values, operation: VaultOperation, balance: number, accountAvailable: number | undefined, t: TFunction<['vaults', 'common']>,
): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}

  if (!values.amount.trim()) errors.amount = t('common:validation.amountRequired')
  else {
    const amount = parseMoneyInput(values.amount)
    if (amount === null) errors.amount = t('common:validation.amountInvalid')
    else if (amount === 0) errors.amount = t('common:validation.amountPositive')
    // A API confere de novo, com o saldo travado; aqui é só para avisar antes.
    else if (operation === 'withdraw' && toCents(amount) > toCents(balance)) {
      errors.amount = t('operation.insufficientVault', { balance: formatMoney(balance) })
    }
    // Depósito só com saldo na conta na data escolhida (a API confere de novo, com a conta travada).
    else if (operation === 'deposit' && accountAvailable !== undefined && exceedsAccountBalance(amount, accountAvailable)) {
      errors.amount = depositShortfallMessage(accountAvailable, values.date)
    }
  }

  if (!values.date) errors.date = t('common:validation.dateRequired')
  else if (!isValidIsoDate(values.date)) errors.date = t('common:validation.dateInvalid')
  else errors.date = vaultOperationDateError(values.date, today())

  if (values.description.trim().length > DESCRIPTION_MAX) {
    errors.description = t('common:validation.descriptionMax', { max: DESCRIPTION_MAX })
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
  const { t } = useTranslation(['vaults', 'common'])
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

  // Saldo da conta na data do depósito (summary com from = to = data: o accountBalance soma tudo
  // até esse dia). Só consulta com uma data válida; ao trocar a data, a anterior fica até a nova chegar.
  const dateOk = isValidIsoDate(values.date) && !vaultOperationDateError(values.date, today())
  const account = useSummary({ from: values.date, to: values.date }, { enabled: !isWithdraw && dateOk, keepPrevious: true })
  const accountAvailable = !isWithdraw && dateOk && account.data && !account.isPlaceholderData
    ? account.data.accountBalance
    : undefined
  // Dica do valor no depósito: sempre visível, com o disponível na data escolhida.
  const depositHint = !dateOk
    ? t('operation.pickDateFirst')
    : accountAvailable !== undefined
      ? values.date === today()
        ? t('operation.availableToday', { balance: formatAccountBalance(accountAvailable) })
        : t('operation.availableOn', { date: formatDate(values.date), balance: formatAccountBalance(accountAvailable) })
      : account.isError
        ? t('operation.accountError')
        : t('operation.accountLoading')

  const title = isWithdraw ? t('operation.withdrawTitle', { name: vault.name }) : t('operation.depositTitle', { name: vault.name })

  function showErrors(fieldErrors: FieldErrors<Field>) {
    setErrors(fieldErrors)
    const refs = { amount: amountRef, date: dateRef, description: descriptionRef }
    const first = firstInvalidField(fieldErrors, FIELDS)
    if (first) refs[first].current?.focus()
  }

  function change(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    // O saldo disponível depende da data: trocar a data também limpa o erro do valor, que ficaria
    // falando da data anterior (e escondendo a dica com o disponível da nova).
    setErrors((current) => ({ ...current, [field]: undefined, ...(field === 'date' ? { amount: undefined } : {}) }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const fieldErrors = validate(values, operation, vault.balance, accountAvailable, t)
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
        <p className="text-sm text-muted">{t('operation.emptyVault')}</p>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={onClose}>{t('common:actions.close')}</Button>
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
            label={t('common:fields.amount')}
            placeholder={t('common:amountPlaceholder')}
            hint={isWithdraw ? t('operation.availableInVault', { balance: formatMoney(vault.balance) }) : depositHint}
            value={values.amount}
            onChange={(text) => change('amount', text)}
            error={errors.amount}
          />
          <Input
            ref={dateRef}
            label={t('common:fields.date')}
            type="date"
            min="0001-01-01"
            max={today()}
            hint={t('operation.dateHint')}
            value={values.date}
            onChange={(event) => change('date', event.target.value)}
            error={errors.date}
          />
        </div>
        <Input
          ref={descriptionRef}
          label={t('operation.description')}
          autoComplete="off"
          maxLength={DESCRIPTION_MAX}
          placeholder={isWithdraw ? t('operation.withdrawPlaceholder', { name: vault.name }) : t('operation.depositPlaceholder', { name: vault.name })}
          value={values.description}
          onChange={(event) => change('description', event.target.value)}
          error={errors.description}
        />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>{t('common:actions.cancel')}</Button>
          <Button type="submit" isLoading={mutation.isPending}>{isWithdraw ? t('common:actions.withdraw') : t('common:actions.deposit')}</Button>
        </div>
      </form>
    </Modal>
  )
}
