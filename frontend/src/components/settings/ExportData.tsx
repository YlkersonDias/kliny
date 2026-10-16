import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportData } from '../../api/account'
import { today } from '../../lib/dates'
import { Button } from '../ui/Button'
import { FormAlert } from '../ui/FormAlert'

// "Baixar meus dados" (LGPD, portabilidade): um .zip com o JSON completo e o CSV das movimentações.
// O arquivo vai direto para o download da pessoa e não fica guardado no navegador (regra 14).
export function ExportData() {
  const { t } = useTranslation('settings')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setLoading(true)
    setDone(false)
    setError(null)
    try {
      const blob = await exportData()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      // A data local, e não a do servidor.
      link.download = `kliny-dados-${today()}.zip`
      link.click()
      // Depois do clique o navegador já tem o arquivo; a URL temporária pode sair da memória.
      setTimeout(() => URL.revokeObjectURL(url), 0)
      setDone(true)
    } catch (caught) {
      // A API explica o motivo (muitas tentativas, sem conexão).
      setError(caught instanceof Error && caught.message ? caught.message : t('account.exportError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-muted">{t('account.exportDescription')}</p>
      <Button variant="secondary" className="mt-4" isLoading={loading} onClick={() => void handleExport()}>
        {t('account.exportButton')}
      </Button>
      {done && <div className="mt-3"><FormAlert variant="info">{t('account.exportDone')}</FormAlert></div>}
      {error && <div className="mt-3"><FormAlert>{error}</FormAlert></div>}
    </div>
  )
}
