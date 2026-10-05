import { useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import type { Vault } from '../../api/types'
import { useCreateVault, useUpdateVault } from '../../hooks/useVaults'
import { firstInvalidField, splitApiError, type FieldErrors } from '../../lib/forms'
import { toInputText } from '../../lib/money'
import { goalReachedNotice, parseGoalInput } from '../../lib/vaults'
import { Button } from '../ui/Button'
import { FormAlert } from '../ui/FormAlert'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { MoneyInput } from '../ui/MoneyInput'

const FIELDS = ['name', 'goal'] as const
type Field = (typeof FIELDS)[number]

// Mesma regra do VaultRequest da API.
const NAME_MAX = 100

interface Values {
  name: string
  goal: string // '' = sem meta
}

function validate(values: Values): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  const name = values.name.trim()
  if (!name) errors.name = 'Informe o nome do cofre.'
  else if (name.length > NAME_MAX) errors.name = `O nome do cofre deve ter no máximo ${NAME_MAX} caracteres.`

  // Zero ou negativo não é erro: vira "sem meta", como o campo vazio (parseGoalInput).
  if (parseGoalInput(values.goal) === 'invalid') {
    errors.goal = 'Valor inválido. Use o formato 1.234,56, com até 2 casas decimais.'
  }
  return errors
}

// Meta como número, ou null (sem meta ou valor inválido).
function goalNumber(text: string): number | null {
  const goal = parseGoalInput(text)
  return typeof goal === 'number' ? goal : null
}

interface VaultFormModalProps {
  // Sem vault: novo cofre.
  vault?: Vault
  onClose: () => void
}

export function VaultFormModal({ vault, onClose }: VaultFormModalProps) {
  const isEdit = vault !== undefined
  const [values, setValues] = useState<Values>({
    name: vault?.name ?? '',
    goal: vault?.goal != null ? toInputText(vault.goal) : '',
  })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const goalRef = useRef<HTMLInputElement>(null)
  const create = useCreateVault()
  const update = useUpdateVault()
  const isPending = create.isPending || update.isPending

  function showErrors(fieldErrors: FieldErrors<Field>) {
    setErrors(fieldErrors)
    const refs = { name: nameRef, goal: goalRef }
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

    const fieldErrors = validate(values)
    showErrors(fieldErrors)
    if (firstInvalidField(fieldErrors, FIELDS)) return

    // Meta vazia, zero ou negativa: sem meta (goal: null).
    const request = { name: values.name.trim(), goal: goalNumber(values.goal) }
    const options = {
      onSuccess: onClose,
      onError: (error: unknown) => {
        // Nome repetido (409) vem só em detail, mas pertence ao campo.
        if (error instanceof ApiError && error.status === 409) {
          showErrors({ name: error.detail })
          return
        }
        const result = splitApiError(error, FIELDS)
        showErrors(result.fieldErrors)
        setFormError(result.formError)
      },
    }

    if (isEdit) update.mutate({ id: vault.id, request }, options)
    else create.mutate(request, options)
  }

  return (
    <Modal
      title={isEdit ? 'Editar cofre' : 'Novo cofre'}
      initialFocusRef={nameRef}
      onClose={() => { if (!isPending) onClose() }}
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input
          ref={nameRef}
          label="Nome"
          autoComplete="off"
          maxLength={NAME_MAX}
          placeholder="Ex.: Reserva de emergência"
          value={values.name}
          onChange={(event) => change('name', event.target.value)}
          error={errors.name}
        />
        <MoneyInput
          ref={goalRef}
          label="Meta (opcional)"
          placeholder="0,00"
          // Meta que o saldo já atinge é aceita; só avisa (na dica, ligada ao campo por aria-describedby).
          hint={isEdit
            ? [goalReachedNotice(goalNumber(values.goal), vault.balance), 'Deixe em branco para remover a meta.'].filter(Boolean).join(' ')
            : 'Quanto você quer juntar neste cofre.'}
          value={values.goal}
          onChange={(text) => change('goal', text)}
          error={errors.goal}
        />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button type="submit" isLoading={isPending}>{isEdit ? 'Salvar alterações' : 'Criar cofre'}</Button>
        </div>
      </form>
    </Modal>
  )
}
