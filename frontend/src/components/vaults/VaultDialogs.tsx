import type { Vault } from '../../api/types'
import { DeleteVaultDialog } from './DeleteVaultDialog'
import { VaultFormModal } from './VaultFormModal'
import { VaultOperationModal, type VaultOperation } from './VaultOperationModal'

// Qual modal de cofre está aberto (no máximo um), usado na lista e no detalhe.
export type VaultDialog =
  | { kind: 'form'; vault?: Vault }
  | { kind: 'operation'; vault: Vault; operation: VaultOperation; initialAmount?: number }
  | { kind: 'delete'; vault: Vault }
  | null

interface VaultDialogsProps {
  dialog: VaultDialog
  onChange: (dialog: VaultDialog) => void
  onDeleted?: () => void
}

export function VaultDialogs({ dialog, onChange, onDeleted }: VaultDialogsProps) {
  if (!dialog) return null
  const close = () => onChange(null)

  switch (dialog.kind) {
    case 'form':
      return <VaultFormModal vault={dialog.vault} onClose={close} />
    case 'operation':
      return (
        <VaultOperationModal
          vault={dialog.vault}
          operation={dialog.operation}
          initialAmount={dialog.initialAmount}
          onClose={close}
        />
      )
    case 'delete':
      return (
        <DeleteVaultDialog
          vault={dialog.vault}
          onClose={close}
          onDeleted={() => {
            close()
            onDeleted?.()
          }}
          onWithdrawAll={() => onChange({
            kind: 'operation', vault: dialog.vault, operation: 'withdraw', initialAmount: dialog.vault.balance,
          })}
        />
      )
  }
}
