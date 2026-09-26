import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { leggiGruppiDestinazione } from '@/lib/contenitori'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'
import { StoricoTransazioni, type RigaStoricoTransazione } from '../storico-transazioni'

export default async function TransazioniAssetPage() {
  const t = await getTranslations('PaginaStorico')
  const tMenu = await getTranslations('Menu')
  const supabase = await createClient()

  const [{ data: strumenti }, { data: contenitori }, { data: transazioniStoricoRaw }] = await Promise.all([
    supabase.from('strumenti').select('id, nome, ticker, categoria').order('categoria').order('nome'),
    leggiGruppiDestinazione(supabase),
    supabase
      .from('transazioni')
      .select(
        'id, data, operazione, contenitore_id, quantita, prezzo_unitario, commissione, tassa_trattenuta, strumento_id'
      )
      .order('data', { ascending: false }),
  ])

  const strumentoMap = new Map((strumenti ?? []).map((s) => [s.id, s]))

  const storicoTransazioni: RigaStoricoTransazione[] = (transazioniStoricoRaw ?? []).map((t) => {
    const strumento = t.strumento_id ? strumentoMap.get(t.strumento_id) : undefined
    return {
      id: t.id,
      data: t.data,
      operazione: t.operazione,
      contenitore_id: t.contenitore_id,
      quantita: Number(t.quantita),
      prezzo_unitario: Number(t.prezzo_unitario),
      commissione: Number(t.commissione),
      tassa_trattenuta: Number(t.tassa_trattenuta),
      strumento_id: t.strumento_id,
      strumento_nome: strumento?.nome ?? '—',
      strumento_ticker: strumento?.ticker ?? null,
    }
  })

  return (
    <div>
      <RippleLink href="/account/data-management/transactions" className="link-dettaglio" style={{ fontSize: 'var(--fs-card-link)' }}>
        {t('linkNuovaTransazione')}
      </RippleLink>

      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)', marginTop: 12 }}>{tMenu('analisi')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tMenu('transazioniFinanziarie')}</h1>

      <Sezione>
        <StoricoTransazioni transazioni={storicoTransazioni} contenitori={contenitori ?? []} />
      </Sezione>
    </div>
  )
}