import { getTranslations } from 'next-intl/server'
import { Sezione } from '@/components/sezione'
import { EsportaTransazioniFinanziarie, EsportaTransazioniLiquidita } from './esporta-transazioni'
import { EsportaFiscalita } from './esporta-fiscalita'

const stileBlocco: React.CSSProperties = {
  marginTop: 32,
  paddingTop: 32,
  borderTop: '1px solid var(--border-default)',
}

const stileTitoloBlocco: React.CSSProperties = { fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 0, marginBottom: 12 }

export default async function EsportaPage() {
  const tMenu = await getTranslations('Menu')
  const tGestioneTransazioni = await getTranslations('PaginaGestioneTransazioni')
  const tGestioneFiscalita = await getTranslations('PaginaGestioneFiscalita')
  const tPaginaStorico = await getTranslations('PaginaStorico')

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('account')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tGestioneTransazioni('titoloEsporta')}</h1>

      <section>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{tMenu('transazioni')}</h2>
        <Sezione>
          <div>
            <h3 style={stileTitoloBlocco}>{tMenu('transazioniFinanziarie')}</h3>
            <EsportaTransazioniFinanziarie />
          </div>

          <div style={stileBlocco}>
            <h3 style={stileTitoloBlocco}>{tPaginaStorico('titoloTransazioniLiquidita')}</h3>
            <EsportaTransazioniLiquidita />
          </div>
        </Sezione>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{tMenu('fiscalita')}</h2>
        <Sezione>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
            {tGestioneFiscalita('paragrafoEsportazione')}
          </p>
          <EsportaFiscalita />
        </Sezione>
      </section>
    </div>
  )
}
