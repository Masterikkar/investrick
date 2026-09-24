import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'
import { NuovaTransazioneFinanziaria, NuovaTransazioneLiquidita } from './nuova-transazione'

export default async function TransazioniPage({
  searchParams,
}: {
  searchParams: Promise<{
    successo_finanziaria?: string
    errore_finanziaria?: string
    successo_liquidita?: string
    errore_liquidita?: string
  }>
}) {
  const t = await getTranslations('PaginaGestioneTransazioni')
  const tMenu = await getTranslations('Menu')
  const tPaginaStorico = await getTranslations('PaginaStorico')
  const params = await searchParams
  const supabase = await createClient()

  const { data: strumenti } = await supabase
    .from('strumenti')
    .select('id, nome, ticker, categoria, isin')
    .order('categoria')
    .order('nome')

  const { data: contenitori } = await supabase
    .from('contenitori')
    .select('id, nome')
    .order('nome')

  // I conti di liquidità hanno il loro form (movimenti di liquidità): nel form
  // delle transazioni finanziarie vanno esclusi.
  const strumentiFinanziari = (strumenti ?? []).filter((s) => s.categoria !== 'Liquidita')
  const strumentiLiquidita = (strumenti ?? []).filter((s) => s.categoria === 'Liquidita')

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('account')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 4, fontWeight: 500 }}>{tMenu('transazioni')}</h1>

      <div style={{ display: 'flex', gap: 20, fontSize: 'var(--fs-body)', marginTop: 12, marginBottom: 24 }}>
        <RippleLink href="/storico/asset" className="link-dettaglio">
          {t('linkStoricoTransazioniFinanziarie')}
        </RippleLink>
        <RippleLink href="/storico/liquidita" className="link-dettaglio">
          {t('linkStoricoTransazioniLiquidita')}
        </RippleLink>
        <RippleLink href="/gestione/importa" className="link-dettaglio">
          {t('linkImportaDaFile')}
        </RippleLink>
        <RippleLink href="/gestione/esporta" className="link-dettaglio">
          {t('linkEsporta')}
        </RippleLink>
      </div>

      <section>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{tMenu('transazioniFinanziarie')}</h2>
        <Sezione>
          <NuovaTransazioneFinanziaria
            strumenti={strumentiFinanziari}
            contenitori={contenitori ?? []}
            successo={params.successo_finanziaria === '1'}
            errore={params.errore_finanziaria === '1'}
          />
        </Sezione>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{tPaginaStorico('titoloTransazioniLiquidita')}</h2>
        <Sezione>
          <NuovaTransazioneLiquidita
            strumentiLiquidita={strumentiLiquidita.map((s) => ({ id: s.id, nome: s.nome }))}
            contenitori={contenitori ?? []}
            successo={params.successo_liquidita === '1'}
            errore={params.errore_liquidita === '1'}
          />
        </Sezione>
      </section>
    </div>
  )
}