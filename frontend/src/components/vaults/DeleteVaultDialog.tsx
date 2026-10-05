import { useState } from 'react'
import type { Vault } from '../../api/types'
import { useDeleteVault } from '../../hooks/useVaults'
import { formatMoney } from '../../lib/money'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Modal } from '../ui/Modal'

interface DeleteVaultDialogProps {
  vault: Vault
  onClose: () => void
  onDeleted: () => void
  // Com saldo, a exclusão não é oferecida: o atalho abre a retirada do saldo inteiro.
  onWithdrawAll: () => void
}

export function DeleteVaultDialog({ vault, onClose, onDeleted, onWithdrawAll }: DeleteVaultDialogProps) {
  const [understood, setUnderstood] = useState(false)
  const mutation = useDeleteVault()

  if (vault.balance > 0) {
    return (
      <Modal title="Apagar cofre" size="sm" onClose={onClose}>
        <p className="text-sm text-muted">
          <strong className="font-semibold text-foreground">{vault.name}</strong> ainda tem{' '}
          <strong className="font-semibold text-foreground">{formatMoney(vault.balance)}</strong> guardados.
          Retire todo o saldo antes de apagar o cofre.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
          <Button onClick={onWithdrawAll}>Retirar saldo</Button>
        </div>
      </Modal>
    )
  }

  return (
    <ConfirmDialog
      title="Apagar cofre"
      confirmLabel="Apagar cofre"
      isLoading={mutation.isPending}
      error={mutation.error?.message}
      confirmDisabled={!understood}
      onCancel={onClose}
      onConfirm={() => mutation.mutate(vault.id, { onSuccess: onDeleted })}
    >
      <p>Apagar o cofre <strong className="font-semibold text-foreground">{vault.name}</strong>?</p>
      <p className="mt-2">
        O histórico de depósitos e retiradas deste cofre também será apagado. Essa ação não pode ser desfeita.
        Os totais da conta não mudam, porque os depósitos e as retiradas se anulam.
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-2 text-foreground">
        <input
          type="checkbox"
          checked={understood}
          onChange={(event) => setUnderstood(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        Entendo que o histórico será perdido.
      </label>
    </ConfirmDialog>
  )
}
