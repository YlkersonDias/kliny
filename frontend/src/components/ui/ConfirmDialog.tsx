import { useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { FormAlert } from './FormAlert'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
  error?: string | null
  // Para exigir um passo a mais antes de confirmar (como marcar uma caixa).
  confirmDisabled?: boolean
}

// Confirmação de ação destrutiva. O foco começa em "Cancelar", a opção segura.
export function ConfirmDialog({
  title, children, confirmLabel, onConfirm, onCancel, isLoading = false, error, confirmDisabled = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal title={title} size="sm" initialFocusRef={cancelRef} onClose={() => { if (!isLoading) onCancel() }}>
      <div className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        <div className="text-sm text-muted">{children}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isLoading} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
