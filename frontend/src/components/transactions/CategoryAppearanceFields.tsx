import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CATEGORY_COLORS, CATEGORY_ICONS, categoryColorVar, type CategoryColor, type CategoryIconName, type CategoryLook,
} from '../../lib/categoryAppearance'
import { CategoryGlyph } from '../ui/CategoryIcon'

// Opção de radio: o <input> é de verdade (sr-only, setas trocam a opção), e a <label> é o alvo.
const OPTION = 'flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-transparent '
  + 'transition-colors has-checked:border-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 '
  + 'has-focus-visible:outline-primary'

interface CategoryAppearanceFieldsProps {
  value: CategoryLook
  onChange: (value: CategoryLook) => void
}

// Cor e ícone de uma categoria, escolhidos nas listas fechadas (as mesmas do backend).
export function CategoryAppearanceFields({ value, onChange }: CategoryAppearanceFieldsProps) {
  const { t } = useTranslation('categories')
  const id = useId()

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-foreground">{t('appearance.color')}</legend>
        <div className="flex flex-wrap gap-1">
          {CATEGORY_COLORS.map((color: CategoryColor) => (
            <label key={color} className={OPTION} title={t(`appearance.colors.${color}`)}>
              <input
                type="radio"
                name={`${id}-cor`}
                value={color}
                checked={value.color === color}
                onChange={() => onChange({ ...value, color })}
                className="sr-only"
              />
              <span className="sr-only">{t(`appearance.colors.${color}`)}</span>
              <span aria-hidden="true" className="size-6 rounded-full" style={{ backgroundColor: categoryColorVar(color) }} />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-foreground">{t('appearance.icon')}</legend>
        <div className="flex flex-wrap gap-1" style={{ color: categoryColorVar(value.color) }}>
          {CATEGORY_ICONS.map((icon: CategoryIconName) => (
            <label key={icon} className={OPTION} title={t(`appearance.icons.${icon}`)}>
              <input
                type="radio"
                name={`${id}-icone`}
                value={icon}
                checked={value.icon === icon}
                onChange={() => onChange({ ...value, icon })}
                className="sr-only"
              />
              <span className="sr-only">{t(`appearance.icons.${icon}`)}</span>
              <CategoryGlyph icon={icon} className="size-5" />
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
