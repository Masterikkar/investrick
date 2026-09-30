import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { leggiGruppiDestinazione } from '@/lib/contenitori'
import { RippleLink } from '@/components/ripple-link'
import { NotificaDaParametro } from '@/components/notifica-da-parametro'
import { SezioneImpostazioni } from '../../settings/sezione-impostazioni'
import { NuovaTransazioneFinanziaria, NuovaTransazioneLiquidita } from './nuova-transazione'
import { SelettoreTipoTransazioni, type TipoTransazioni } from './selettore-tipo-transazioni'
import { ElencoTransazioniFinanziarie } from './elenco-transazioni-finanziarie'
import { ElencoMovimentiLiquidita } from './elenco-movimenti-liquidita'

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string
    successo_finanziaria?: string
    errore_finanziaria?: string
    successo_liquidita?: string
    errore_liquidita?: string
  }>
}) {
  const t = await getTranslations('PaginaGestioneTransazioni')
  const tMenu = await getTranslations('Menu')
  const params = await searchParams
  const supabase = await createClient()

  const tipo: TipoTransazioni = params.tipo === 'liquidita' ? 'liquidita' : 'finanziarie'

  const { data: strumenti } = await supabase
    .from('strumenti')
    .select('id, nome, ticker, categoria, isin')
    .order('categoria')
    .order('nome')

  const { data: contenitori } = await leggiGruppiDestinazione(supabase)

  // I conti di liquidità hanno il loro form (movimenti di liquidità): nel form
  // delle transazioni finanziarie vanno esclusi.
  const strumentiFinanziari = (strumenti ?? []).filter((s) => s.categoria !== 'Liquidita')
  const strumentiLiquidita = (strumenti ?? []).filter((s) => s.categoria === 'Liquidita')

  return (
    <>
      <SezioneImpostazioni titolo={tMenu('transazioni')}>
        {params.successo_finanziaria === '1' && <NotificaDaParametro messaggio={t('successoTransazioneSalvata')} />}
        {params.successo_liquidita === '1' && <NotificaDaParametro messaggio={t('successoTransazioneSalvata')} />}

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <SelettoreTipoTransazioni tipoAttivo={tipo} />
          {tipo === 'finanziarie' ? (
            <NuovaTransazioneFinanziaria
              strumenti={strumentiFinanziari}
              contenitori={contenitori ?? []}
              errore={params.errore_finanziaria === '1'}
            />
          ) : (
            <NuovaTransazioneLiquidita
              strumentiLiquidita={strumentiLiquidita.map((s) => ({ id: s.id, nome: s.nome }))}
              contenitori={contenitori ?? []}
              errore={params.errore_liquidita === '1'}
            />
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          {tipo === 'finanziarie' ? (
            <ElencoTransazioniFinanziarie strumenti={strumentiFinanziari} contenitori={contenitori ?? []} />
          ) : (
            <ElencoMovimentiLiquidita strumenti={strumentiLiquidita} contenitori={contenitori ?? []} />
          )}
        </div>
      </SezioneImpostazioni>

      <SezioneImpostazioni titolo={t('titoloImporta')}>
        <RippleLink href="/account/data-management/import" className="link-dettaglio">
          {t('linkImportaDaFile')}
        </RippleLink>
      </SezioneImpostazioni>
    </>
  )
}
