import { useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import type { Category, CategoryRule } from '../../api/types'
import { useCategories } from '../../hooks/useCategories'
import {
  useApplyCategoryRule, useCategoryRulePreview, useCategoryRules, useCreateCategoryRule, useDeleteCategoryRule,
  useUpdateCategoryRule,
} from '../../hooks/useCategoryRules'
import { RULE_PATTERN_MAX } from '../../lib/categoryRules'
import { splitApiError } from '../../lib/forms'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { FormAlert } from '../ui/FormAlert'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Spinner } from '../ui/Spinner'

type RuleField = 'pattern' | 'categoryId'

// O 409 (texto repetido) vem só em detail, mas pertence ao campo do texto.
function ruleErrors(error: unknown): { pattern?: string; categoryId?: string; form: string | null } {
  if (error instanceof ApiError && error.status === 409) return { pattern: error.detail, form: null }
  const { fieldErrors, formError } = splitApiError<RuleField>(error, ['pattern', 'categoryId'])
  return { ...fieldErrors, form: formError }
}

function RuleForm({ rule, categories, onDone, submitLabel }: {
  rule?: CategoryRule
  categories: Category[]
  onDone?: () => void
  submitLabel: string
}) {
  const { t } = useTranslation(['categories', 'common'])
  const [pattern, setPattern] = useState(rule?.pattern ?? '')
  const [categoryId, setCategoryId] = useState(rule ? String(rule.categoryId) : '')
  const [errors, setErrors] = useState<{ pattern?: string; categoryId?: string; form: string | null }>({ form: null })
  const create = useCreateCategoryRule()
  const update = useUpdateCategoryRule()
  const isPending = create.isPending || update.isPending

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = {
      pattern: !pattern.trim() ? t('rules.patternRequired') : pattern.trim().length > RULE_PATTERN_MAX ? t('rules.patternMax', { max: RULE_PATTERN_MAX }) : undefined,
      categoryId: categoryId ? undefined : t('rules.categoryRequired'),
      form: null,
    }
    setErrors(next)
    if (next.pattern || next.categoryId) return

    const request = { pattern: pattern.trim(), categoryId: Number(categoryId) }
    const options = {
      onSuccess: () => {
        if (!rule) { setPattern(''); setCategoryId('') }
        onDone?.()
      },
      onError: (error: unknown) => setErrors(ruleErrors(error)),
    }
    if (rule) update.mutate({ id: rule.id, request }, options)
    else create.mutate(request, options)
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-3">
      {errors.form && <FormAlert>{errors.form}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Input
          label={t('rules.pattern')}
          placeholder={t('rules.patternPlaceholder')}
          autoComplete="off"
          maxLength={RULE_PATTERN_MAX}
          value={pattern}
          onChange={(event) => { setPattern(event.target.value); setErrors((current) => ({ ...current, pattern: undefined })) }}
          error={errors.pattern}
        />
        <Select
          label={t('rules.category')}
          value={categoryId}
          onChange={(event) => { setCategoryId(event.target.value); setErrors((current) => ({ ...current, categoryId: undefined })) }}
          error={errors.categoryId}
        >
          <option value="">{t('rules.choose')}</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        {onDone && rule && <Button variant="ghost" onClick={onDone} disabled={isPending}>{t('common:actions.cancel')}</Button>}
        <Button type="submit" isLoading={isPending}>{submitLabel}</Button>
      </div>
    </form>
  )
}

// Mostra quantas movimentações mudam antes de confirmar.
function ApplyRuleDialog({ rule, onClose, onApplied }: { rule: CategoryRule; onClose: () => void; onApplied: (count: number) => void }) {
  const { t } = useTranslation('categories')
  const [includeCategorized, setIncludeCategorized] = useState(false)
  const preview = useCategoryRulePreview(rule.id, includeCategorized)
  const apply = useApplyCategoryRule()
  const count = preview.data?.count

  return (
    <ConfirmDialog
      title={t('rules.applyTitle')}
      confirmLabel={t('rules.applyConfirm')}
      isLoading={apply.isPending}
      error={apply.error?.message ?? preview.error?.message}
      confirmDisabled={!count}
      onCancel={onClose}
      onConfirm={() => apply.mutate({ id: rule.id, includeCategorized }, { onSuccess: (result) => onApplied(result.count) })}
    >
      <p>
        <Trans
          t={t}
          i18nKey="rules.applyQuestion"
          components={{ pattern: <strong className="font-semibold text-foreground">{rule.pattern}</strong>, category: <strong className="font-semibold text-foreground">{rule.categoryName}</strong> }}
        />
      </p>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-foreground">
        <input
          type="checkbox"
          checked={includeCategorized}
          onChange={(event) => setIncludeCategorized(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        {t('rules.includeCategorized')}
      </label>
      <p className="mt-3 font-medium text-foreground" role="status">
        {preview.isPending ? t('rules.counting') : count === undefined ? '' : t('rules.applyCount', { count })}
      </p>
    </ConfirmDialog>
  )
}

export function CategoryRulesSection() {
  const { t } = useTranslation(['categories', 'common'])
  const rules = useCategoryRules()
  const categories = useCategories()
  const remove = useDeleteCategoryRule()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [applying, setApplying] = useState<CategoryRule | null>(null)
  const [applied, setApplied] = useState<string | null>(null)
  const categoryList = categories.data ?? []

  function renderList() {
    if (rules.isPending) {
      return (
        <div className="flex justify-center py-4 text-primary" role="status">
          <Spinner />
          <span className="sr-only">{t('rules.loading')}</span>
        </div>
      )
    }
    if (rules.isError) {
      return (
        <div className="space-y-3">
          <FormAlert>{rules.error.message}</FormAlert>
          <Button variant="secondary" onClick={() => rules.refetch()}>{t('common:actions.tryAgain')}</Button>
        </div>
      )
    }
    if (rules.data.length === 0) {
      return <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted">{t('rules.empty')}</p>
    }
    return (
      <ul className="divide-y divide-border rounded-lg border border-border">
        {rules.data.map((rule) => (
          <li key={rule.id} className="px-3 py-2">
            {editingId === rule.id ? (
              <RuleForm rule={rule} categories={categoryList} submitLabel={t('common:actions.save')} onDone={() => setEditingId(null)} />
            ) : (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="min-w-0 flex-1 text-sm text-muted">
                  <Trans
                    t={t}
                    i18nKey="rules.item"
                    components={{ pattern: <strong className="font-semibold text-foreground">{rule.pattern}</strong>, category: <span className="text-foreground">{rule.categoryName}</span> }}
                  />
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    className="min-h-11 px-3 md:min-h-8 md:py-1"
                    aria-label={t('rules.applyLabel', { pattern: rule.pattern })}
                    onClick={() => { setApplied(null); setApplying(rule) }}
                  >
                    {t('rules.apply')}
                  </Button>
                  <IconButton icon="edit" label={t('rules.edit', { pattern: rule.pattern })} onClick={() => setEditingId(rule.id)} />
                  <IconButton icon="trash" label={t('rules.delete', { pattern: rule.pattern })} onClick={() => remove.mutate(rule.id)} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section aria-labelledby="regras-titulo" className="space-y-3">
      <div>
        <h3 id="regras-titulo" className="text-sm font-medium text-foreground">{t('rules.title')}</h3>
        <p className="mt-0.5 text-sm text-muted">{t('rules.intro')}</p>
      </div>
      {categoryList.length === 0 && !categories.isPending
        ? <p className="text-sm text-muted">{t('rules.needCategory')}</p>
        : <RuleForm categories={categoryList} submitLabel={t('rules.add')} />}
      {remove.isError && <FormAlert>{remove.error.message}</FormAlert>}
      {applied && <p className="text-sm font-medium text-foreground" role="status">{applied}</p>}
      {renderList()}
      {applying && (
        <ApplyRuleDialog
          rule={applying}
          onClose={() => setApplying(null)}
          onApplied={(count) => { setApplying(null); setApplied(t('rules.applied', { count })) }}
        />
      )}
    </section>
  )
}
