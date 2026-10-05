import { useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import type { Category } from '../../api/types'
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '../../hooks/useCategories'
import { CATEGORY_NAME_MAX, categoryNameError, validateCategoryName } from '../../lib/categories'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { FormAlert } from '../ui/FormAlert'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'

interface CategoryManagerModalProps {
  onClose: () => void
  // Avisa a página, que limpa o filtro se ele usava a categoria apagada.
  onDeleted?: (id: number) => void
}

export function CategoryManagerModal({ onClose, onDeleted }: CategoryManagerModalProps) {
  const categories = useCategories()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const newNameRef = useRef<HTMLInputElement>(null)

  return (
    <Modal title="Gerenciar categorias" initialFocusRef={newNameRef} onClose={onClose}>
      <div className="space-y-5">
        <NewCategoryForm inputRef={newNameRef} />

        <section aria-labelledby="categorias-existentes">
          <h3 id="categorias-existentes" className="mb-2 text-sm font-medium text-foreground">Suas categorias</h3>
          {categories.isPending ? (
            <div className="flex justify-center py-6 text-primary" role="status">
              <Spinner />
              <span className="sr-only">Carregando categorias…</span>
            </div>
          ) : categories.isError ? (
            <div className="space-y-3">
              <FormAlert>{categories.error.message}</FormAlert>
              <Button variant="secondary" onClick={() => categories.refetch()}>Tentar novamente</Button>
            </div>
          ) : categories.data.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
              Nenhuma categoria ainda. Crie a primeira acima.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {categories.data.map((category) => (
                <li key={category.id} className="px-3 py-2">
                  {editingId === category.id ? (
                    <RenameForm category={category} onDone={() => setEditingId(null)} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-foreground" title={category.name}>{category.name}</span>
                      <IconButton icon="edit" label={`Renomear ${category.name}`} onClick={() => setEditingId(category.id)} />
                      <IconButton icon="trash" label={`Apagar ${category.name}`} onClick={() => setDeleting(category)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
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
  const [name, setName] = useState('')
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
    mutation.mutate({ name: name.trim() }, {
      onSuccess: () => {
        setName('')
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
        <Input
          ref={inputRef}
          label="Nova categoria"
          autoComplete="off"
          maxLength={CATEGORY_NAME_MAX}
          className="flex-1"
          value={name}
          onChange={(event) => { setName(event.target.value); setError(undefined) }}
          error={error}
        />
        {/* Centralizado no campo: 26px do rótulo e 3px da diferença de altura. */}
        <Button type="submit" className="mt-[29px]" isLoading={mutation.isPending}>Adicionar</Button>
      </div>
    </form>
  )
}

function RenameForm({ category, onDone }: { category: Category; onDone: () => void }) {
  const [name, setName] = useState(category.name)
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
    if (name.trim() === category.name) {
      onDone()
      return
    }
    mutation.mutate({ id: category.id, request: { name: name.trim() } }, {
      onSuccess: onDone,
      onError: (apiError) => {
        const { field, form } = categoryNameError(apiError)
        setError(field ?? form ?? undefined)
        inputRef.current?.focus()
      },
    })
  }

  // Esc cancela só a edição, sem fechar o modal inteiro.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (!mutation.isPending) onDone()
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex items-start gap-2">
      <Input
        ref={inputRef}
        label={`Novo nome para ${category.name}`}
        autoFocus
        autoComplete="off"
        maxLength={CATEGORY_NAME_MAX}
        className="flex-1 [&>label]:sr-only"
        value={name}
        onChange={(event) => { setName(event.target.value); setError(undefined) }}
        onKeyDown={handleKeyDown}
        error={error}
      />
      <Button type="submit" className="mt-[3px] px-3" isLoading={mutation.isPending}>Salvar</Button>
      <Button variant="ghost" className="mt-[3px] px-3" onClick={onDone} disabled={mutation.isPending}>Cancelar</Button>
    </form>
  )
}

function DeleteCategoryDialog({ category, onClose, onDeleted }: {
  category: Category
  onClose: () => void
  onDeleted: (id: number) => void
}) {
  const mutation = useDeleteCategory()

  return (
    <ConfirmDialog
      title="Apagar categoria"
      confirmLabel="Apagar"
      isLoading={mutation.isPending}
      error={mutation.error?.message}
      onCancel={onClose}
      onConfirm={() => mutation.mutate(category.id, { onSuccess: () => onDeleted(category.id) })}
    >
      <p>Apagar a categoria <strong className="font-semibold text-foreground">{category.name}</strong>?</p>
      <p className="mt-2">As movimentações desta categoria não serão apagadas: elas ficarão sem categoria.</p>
    </ConfirmDialog>
  )
}
