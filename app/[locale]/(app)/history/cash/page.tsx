import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { leggiGruppiDestinazione } from '@/lib/contenitori'
import { RippleLink } from '@/components/ripple-link'
import { Sezione } from '@/components/sezione'
import { StoricoMovimentiLiquidita, type RigaStoricoMovimentoLiquidita } from '../storico-movimenti-liquidita'

export default async function TransazioniLiquiditaPage() {
  const t = await getTranslations('PaginaStorico')
  const tMenu = await getTranslations('Menu')
  const supabase = await createClient()

  const [{ data: strumenti }, { data: contenitori }, { data: movimentiLiquiditaStoricoRaw }] = await Promise.all([
    supabase.from('strumenti').select('id, nome, categoria').order('nome'),
    leggiGruppiDestinazione(supabase),
    supabase
      .from('movimenti_liquidita')
      .select('id, data, tipo_movimento, contenitore_id, importo, tassa_trattenuta, strumento_id')
      .order('data', { ascending: false }),
  ])

  const strumentoMap = new Map((strumenti ?? []).map((s) => [s.id, s]))

  const storicoMovimentiLiquidita: RigaStoricoMovimentoLiquidita[] = (movimentiLiquiditaStoricoRaw ?? []).map((m) => {
    const strumento = strumentoMap.get(m.strumento_id)
    return {
      id: m.id,
      data: m.data,
      tipo_movimento: m.tipo_movimento,
      contenitore_id: m.contenitore_id,
      importo: Number(m.importo),
      tassa_trattenuta: Number(m.tassa_trattenuta),
      strumento_id: m.strumento_id,
      strumento_nome: strumento?.nome ?? '—',
    }
  })

  return (
    <div>
      <RippleLink href="/gestione/transazioni" className="link-dettaglio" style={{ fontSize: 'var(--fs-card-link)' }}>
        {t('linkNuovaTransazione')}
      </RippleLink>

      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)', marginTop: 12 }}>{tMenu('analisi')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{t('titoloTransazioniLiquidita')}</h1>

      <Sezione>
        <StoricoMovimentiLiquidita movimenti={storicoMovimentiLiquidita} contenitori={contenitori ?? []} />
      </Sezione>
    </div>
  )
}