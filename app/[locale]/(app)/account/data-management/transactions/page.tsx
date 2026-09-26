import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { leggiGruppiDestinazione } from '@/lib/contenitori'
import { RippleLink } from '@/components/ripple-link'
import { NotificaDaParametro } from '@/components/notifica-da-parametro'
import { SezioneImpostazioni } from '../../settings/sezione-impostazioni'
import { NuovaTransazioneFinanziaria, NuovaTransazioneLiquidita } from './nuova-transazione'

export default async function TransactionsPage({
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

  const { data: contenitori } = await leggiGruppiDestinazione(supabase)

  // I conti di liquidità hanno il loro form (movimenti di liquidità): nel form
  // delle transazioni finanziarie vanno esclusi.
  const strumentiFinanziari = (strumenti ?? []).filter((s) => s.categoria !== 'Liquidita')
  const strumentiLiquidita = (strumenti ?? []).filter((s) => s.categoria === 'Liquidita')

  return (
    <>
      <SezioneImpostazioni titolo={tMenu('transazioniFinanziarie')}>
        {params.successo_finanziaria === '1' && <NotificaDaParametro messaggio={t('successoTransazioneSalvata')} />}
        <NuovaTransazioneFinanziaria
          strumenti={strumentiFinanziari}
          contenitori={contenitori ?? []}
          errore={params.errore_finanziaria === '1'}
        />
      </SezioneImpostazioni>

      <SezioneImpostazioni titolo={tPaginaStorico('titoloTransazioniLiquidita')}>
        {params.successo_liquidita === '1' && <NotificaDaParametro messaggio={t('successoTransazioneSalvata')} />}
        <NuovaTransazioneLiquidita
          strumentiLiquidita={strumentiLiquidita.map((s) => ({ id: s.id, nome: s.nome }))}
          contenitori={contenitori ?? []}
          errore={params.errore_liquidita === '1'}
        />
      </SezioneImpostazioni>

      <SezioneImpostazioni titolo={t('titoloImporta')}>
        <RippleLink href="/account/data-management/import" className="link-dettaglio">
          {t('linkImportaDaFile')}
        </RippleLink>
      </SezioneImpostazioni>
    </>
  )
}
