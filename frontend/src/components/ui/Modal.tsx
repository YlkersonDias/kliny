import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  // Campo que recebe o foco ao abrir. Sem ele, o navegador foca o primeiro elemento.
  initialFocusRef?: RefObject<HTMLElement | null>
  size?: 'sm' | 'md'
}

// <dialog> nativo com showModal(): o navegador cuida da camada superior, do fundo,
// do Esc e de prender o foco. Fica aberto enquanto estiver montado; para fechar,
// quem usa deixa de renderizar. Clicar fora não fecha, para não perder o que foi digitado.
export function Modal({ title, onClose, children, initialFocusRef, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  // Lido no efeito: um onClose novo a cada render não deve reabrir o dialog.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    // Devolve o foco ao botão que abriu, mesmo com o dialog desmontado pelo React.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

    dialog.showModal()
    initialFocusRef?.current?.focus()

    // Esc: quem decide fechar é o onClose (que pode recusar durante um envio).
    function handleCancel(event: Event) {
      event.preventDefault()
      onCloseRef.current()
    }
    dialog.addEventListener('cancel', handleCancel)

    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      if (dialog.open) dialog.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [initialFocusRef])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl bg-surface p-0 text-foreground shadow-xl backdrop:bg-overlay ${
        size === 'sm' ? 'max-w-sm' : 'max-w-lg'
      }`}
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
        <h2 id={titleId} className="text-lg font-semibold text-foreground">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          // 44 px no celular, 36 px a partir do md (como os outros botões só de ícone).
          className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary md:-mt-1 md:size-9"
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">{children}</div>
    </dialog>
  )
}
