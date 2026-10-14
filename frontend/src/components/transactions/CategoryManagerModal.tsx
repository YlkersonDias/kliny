import { useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { Category } from '../../api/types'
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '../../hooks/useCategories'
import { CATEGORY_NAME_MAX, categoryNameError, validateCategoryName } from '../../lib/categories'
import { categoryLook, DEFAULT_COLOR, DEFAULT_ICON, type CategoryLook } from '../../lib/categoryAppearance'
import { CategoryIcon } from '../ui/CategoryIcon'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { FormAlert } from '../ui/FormAlert'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { CategoryAppearanceFields } from './CategoryAppearanceFields'
import { CategoryRulesSection } from './CategoryRulesSection'

interface CategoryManagerModalProps {
  onClose: () => void
  // Avisa a página, que limpa o filtro se ele usava a categoria apagada.
  onDeleted?: (id: number) => void
}

export function CategoryManagerModal({ onClose, onDeleted }: CategoryManagerModalProps) {
  const { t } = useTranslation(['categories', 'common'])
  const categories = useCategories()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const newNameRef = useRef<HTMLInputElement>(null)

  return (
    <Modal title={t('manager.title')} initialFocusRef={newNameRef} onClose={onClose}>
      <div className="space-y-5">
        <NewCategoryForm inputRef={newNameRef} />

        <section aria-labelledby="categorias-existentes">
          <h3 id="categorias-existentes" className="mb-2 text-sm font-medium text-foreground">{t('manager.yours')}</h3>
          {categories.isPending ? (
            <div className="flex justify-center py-6 text-primary" role="status">
              <Spinner />
              <span className="sr-only">{t('manager.loading')}</span>
            </div>
          ) : categories.isError ? (
            <div className="space-y-3">
              <FormAlert>{categories.error.message}</FormAlert>
              <Button variant="secondary" onClick={() => categories.refetch()}>{t('common:actions.tryAgain')}</Button>
            </div>
          ) : categories.data.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
              {t('manager.empty')}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {categories.data.map((category) => (
                <li key={category.id} className="px-3 py-2">
                  {editingId === category.id ? (
                    <EditForm category={category} onDone={() => setEditingId(null)} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <CategoryIcon category={category} size="size-8" />
                      <span className="min-w-0 flex-1 truncate text-foreground" title={category.name}>{category.name}</span>
                      <IconButton icon="edit" label={t('manager.rename', { name: category.name })} onClick={() => setEditingId(category.id)} />
                      <IconButton icon="trash" label={t('manager.delete', { name: category.name })} onClick={() => setDeleting(category)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <CategoryRulesSection />

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>{t('common:actions.close')}</Button>
        </div>
      </div>

      {deleting && (
        <DeleteCategoryDialog
          category={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setDeleting(null)
            onDeleted?.(id)
          }}
        />
      )}
    </Modal>
  )
}

function NewCategoryForm({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const { t } = useTranslation(['categories', 'common'])
  const [name, setName] = useState('')
  const [look, setLook] = useState<CategoryLook>({ color: DEFAULT_COLOR, icon: DEFAULT_ICON })
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState<string | null>(null)
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
    mutation.mutate({ name: name.trim(), color: look.color, icon: look.icon }, {
      onSuccess: () => {
        setName('')
        setLook({ color: DEFAULT_COLOR, icon: DEFAULT_ICON })
        inputRef.current?.focus()
      },
      onError: (apiError) => {
        const { field, form } = categoryNameError(apiError)
        setError(field)
        setFormError(form)
        inputRef.current?.focus()
      },
    })
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-3">
      {formError && <FormAlert>{formError}</FormAlert>}
      <div className="flex items-start gap-2">
        {/* Como a categoria vai aparecer, com a cor e o ícone escolhidos abaixo. */}
        <span className="mt-[29px]"><CategoryIcon look={look} size="size-11" /></span>
        <Input
          ref={inputRef}
          label={t('manager.newLabel')}
          autoComplete="off"
          maxLength={CATEGORY_NAME_MAX}
          className="flex-1"
          value={name}
          onChange={(event) => { setName(event.target.value); setError(undefined) }}
          error={error}
        />
        {/* Centralizado no campo: 26px do rótulo e 3px da diferença de altura. */}
        <Button type="submit" className="mt-[29px]" isLoading={mutation.isPending}>{t('common:actions.add')}</Button>
      </div>
      <CategoryAppearanceFields value={look} onChange={setLook} />
    </form>
  )
}

// Edita o nome, a cor e o ícone na própria linha da lista.
function EditForm({ category, onDone }: { category: Category; onDone: () => void }) {
  const { t } = useTranslation(['categories', 'common'])
  const [name, setName] = useState(category.name)
  const [look, setLook] = useState<CategoryLook>(() => categoryLook(category))
  const [error, setError] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)
  const mutation = useUpdateCategory()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = validateCategoryName(name)
    if (validation) {
      setError(validation)
      inputRef.current?.focus()
      return
    }
    const saved = categoryLook(category)
    if (name.trim() === category.name && look.color === saved.color && look.icon === saved.icon && category.color !== null) {
      onDone()
      return
    }
    mutation.mutate({ id: category.id, request: { name: name.trim(), color: look.color, icon: look.icon } }, {
      onSuccess: onDone,
      onError: (apiError) => {
        const { field, form } = categoryNameError(apiError)
        setError(field ?? form ?? undefined)
        inputRef.current?.focus()
      },
    })
  }

  // Esc cancela só a edição, sem fechar o modal inteiro.
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (!mutation.isPending) onDone()
  }

  return (
    <form noValidate onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-3 py-1">
      <div className="flex items-start gap-2">
        <CategoryIcon look={look} size="size-11" />
        <Input
          ref={inputRef}
          label={t('manager.newName', { name: category.name })}
          autoFocus
          autoComplete="off"
          maxLength={CATEGORY_NAME_MAX}
          className="flex-1 [&>label]:sr-only"
          value={name}
          onChange={(event) => { setName(event.target.value); setError(undefined) }}
          error={error}
        />
      </div>
      <CategoryAppearanceFields value={look} onChange={setLook} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" className="px-3" onClick={onDone} disabled={mutation.isPending}>{t('common:actions.cancel')}</Button>
        <Button type="submit" className="px-3" isLoading={mutation.isPending}>{t('common:actions.save')}</Button>
      </div>
    </form>
  )
}

function DeleteCategoryDialog({ category, onClose, onDeleted }: {
  category: Category
  onClose: () => void
  onDeleted: (id: number) => void
}) {
  const { t } = useTranslation('categories')
  const mutation = useDeleteCategory()

  return (
    <ConfirmDialog
      title={t('delete.title')}
      confirmLabel={t('delete.confirm')}
      isLoading={mutation.isPending}
      error={mutation.error?.message}
      onCancel={onClose}
      onConfirm={() => mutation.mutate(category.id, { onSuccess: () => onDeleted(category.id) })}
    >
      <p>
        <Trans t={t} i18nKey="delete.question" components={{ name: <strong className="font-semibold text-foreground">{category.name}</strong> }} />
      </p>
      <p className="mt-2">{t('delete.note')}</p>
    </ConfirmDialog>
  )
}
