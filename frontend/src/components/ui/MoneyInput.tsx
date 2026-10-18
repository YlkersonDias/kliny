import { useLayoutEffect, useRef, type ComponentProps, type Ref } from 'react'
import { currentLanguage } from '../../i18n'
import { caretAfterTyping, formatMoneyTyping, parseMoneyInput, toInputText } from '../../lib/money'
import { Input } from './Input'

interface MoneyInputProps extends Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'prefix' | 'type'> {
  value: string
  onChange: (text: string) => void
}

const GROUP = { 'pt-BR': '.', 'en-US': ',' } as const

// Os pontos de milhar entram enquanto a pessoa digita; a vírgula dos centavos é ela quem digita.
export function MoneyInput({ value, onChange, onBlur, onKeyDown, ref, ...props }: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pendingCaret = useRef<number | null>(null)

  useLayoutEffect(() => {
    const input = inputRef.current
    if (input && pendingCaret.current !== null && document.activeElement === input) {
      input.setSelectionRange(pendingCaret.current, pendingCaret.current)
    }
    pendingCaret.current = null
  }, [value])

  function setRefs(element: HTMLInputElement | null) {
    inputRef.current = element
    if (typeof ref === 'function') ref(element)
    else if (ref) (ref as { current: HTMLInputElement | null }).current = element
  }

  return (
    <Input
      {...props}
      ref={setRefs as Ref<HTMLInputElement>}
      prefix="R$"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(event) => {
        const raw = event.target.value
        const language = currentLanguage()
        const formatted = formatMoneyTyping(raw, language)
        const caret = caretAfterTyping(raw, event.target.selectionStart ?? raw.length, formatted, language)
        if (formatted === value) {
          // Tecla ignorada: o React devolve o texto anterior, e o cursor é recolocado depois disso.
          const input = event.target
          setTimeout(() => input.setSelectionRange(caret, caret))
          return
        }
        pendingCaret.current = caret
        onChange(formatted)
      }}
      onKeyDown={(event) => {
        // O ponto de milhar voltaria na formatação: apaga o dígito ao lado.
        const input = event.currentTarget
        const start = input.selectionStart
        if (start !== null && start === input.selectionEnd) {
          const group = GROUP[currentLanguage()]
          if (event.key === 'Backspace' && input.value[start - 1] === group) input.setSelectionRange(start - 1, start - 1)
          if (event.key === 'Delete' && input.value[start] === group) input.setSelectionRange(start + 1, start + 1)
        }
        onKeyDown?.(event)
      }}
      onBlur={(event) => {
        const parsed = parseMoneyInput(value)
        if (parsed !== null && toInputText(parsed) !== value) onChange(toInputText(parsed))
        onBlur?.(event)
      }}
    />
  )
}
