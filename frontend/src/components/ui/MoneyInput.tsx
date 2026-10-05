import type { ComponentProps } from 'react'
import { parseMoneyInput, toInputText } from '../../lib/money'
import { Input } from './Input'

interface MoneyInputProps extends Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'prefix' | 'type'> {
  value: string
  onChange: (text: string) => void
}

// Valor em reais digitado como texto livre no formato brasileiro (1.234,56).
// Sem máscara: ao sair do campo, um valor válido é reescrito com pontos e vírgula.
// A conversão para número fica com parseMoneyInput, no envio do formulário.
export function MoneyInput({ value, onChange, onBlur, ...props }: MoneyInputProps) {
  return (
    <Input
      {...props}
      prefix="R$"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => {
        const parsed = parseMoneyInput(value)
        if (parsed !== null && toInputText(parsed) !== value) onChange(toInputText(parsed))
        onBlur?.(event)
      }}
    />
  )
}
