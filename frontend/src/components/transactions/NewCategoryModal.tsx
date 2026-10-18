import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category } from '../../api/types'
import { useCreateCategory } from '../../hooks/useCategories'
import { categoryNameError, validateCategoryName } from '../../lib/categories'
import { Button } from '../ui/Button'
import { FormAlert } from '../ui/FormAlert'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

interface NewCategoryModalProps {
  onCreated: (category: Category) => void
  onClose: () => void
}

// Abre por cima do formulário de movimentação, sem desmontá-lo: o que foi digitado lá continua.
export function NewCategoryModal({ onCreated, onClose }: NewCategoryModalProps) {
  const { t } = useTranslation(['categories', 'common'])
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mutation = useCreateCategory()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const validation = validateCategoryName(name)
    if (validation) {
      setError(validation)
      inputRef.current?.focus()
      return
    }

    mutation.mutate({ name: name.trim() }, {
      onSuccess: onCreated,
      onError: (apiError) => {
        const { field, form } = categoryNameError(apiError)
        setError(field)
        setFormError(form)
        if (field) inputRef.current?.focus()
      },
    })
  }

  return (
    <Modal title={t('newModal.title')} size="sm" initialFocusRef={inputRef} onClose={() => { if (!mutation.isPending) onClose() }}>
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input
          ref={inputRef}
          label={t('newModal.name')}
          autoComplete="off"
          value={name}
          onChange={(event) => { setName(event.target.value); setError(undefined) }}
          error={error}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>{t('common:actions.cancel')}</Button>
          <Button type="submit" isLoading={mutation.isPending}>{t('newModal.submit')}</Button>
        </div>
      </form>
    </Modal>
  )
}
