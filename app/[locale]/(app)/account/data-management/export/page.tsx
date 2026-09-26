import { getTranslations } from 'next-intl/server'
import { SezioneImpostazioni } from '../../settings/sezione-impostazioni'
import { EsportaTransazioniFinanziarie, EsportaTransazioniLiquidita } from './esporta-transazioni'
import { EsportaFiscalita } from './esporta-fiscalita'

export default async function ExportPage() {
  const tMenu = await getTranslations('Menu')
  const tGestioneFiscalita = await getTranslations('PaginaGestioneFiscalita')
  const tPaginaStorico = await getTranslations('PaginaStorico')

  return (
    <>
      <SezioneImpostazioni titolo={tMenu('transazioniFinanziarie')}>
        <EsportaTransazioniFinanziarie />
      </SezioneImpostazioni>

      <SezioneImpostazioni titolo={tPaginaStorico('titoloTransazioniLiquidita')}>
        <EsportaTransazioniLiquidita />
      </SezioneImpostazioni>

      <SezioneImpostazioni titolo={tMenu('fiscalita')}>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
          {tGestioneFiscalita('paragrafoEsportazione')}
        </p>
        <EsportaFiscalita />
      </SezioneImpostazioni>
    </>
  )
}
