interface ChoiceChipProps {
  name: string
  value: string
  checked: boolean
  disabled?: boolean
  // Altura menor, para ficar ao lado de um título (Gastos/Receitas nos Relatórios).
  compact?: boolean
  label: string
  // Idioma do rótulo, quando difere do da página (nomes de idioma em Configurações).
  lang?: string
  // Id do <input>, para devolver o foco a ele (troca de idioma).
  id?: string
  onChange: () => void
}

// Opção de radio com aparência de botão: o <input> é de verdade (sr-only), a <label> é o alvo.
// Radios com o mesmo name formam um grupo, e as setas trocam a opção.
export function ChoiceChip({ name, value, checked, disabled = false, compact = false, label, lang, id, onChange }: ChoiceChipProps) {
  return (
    <label
      lang={lang}
      className={`inline-flex items-center rounded-lg border px-3 text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${
        compact ? 'py-1.5' : 'py-2'
      } ${
        disabled
          ? 'cursor-not-allowed border-border text-muted opacity-60'
          : 'cursor-pointer border-border text-muted hover:bg-background has-checked:border-primary has-checked:bg-primary has-checked:text-on-primary'
      }`}
    >
      <input type="radio" id={id} name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} className="sr-only" />
      {label}
    </label>
  )
}
