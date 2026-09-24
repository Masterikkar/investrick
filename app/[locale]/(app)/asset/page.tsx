import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { Sezione } from '@/components/sezione'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { traduciTipoStrumento } from '@/lib/i18n-tipi-strumento'

// Tutte le posizioni aperte delle sei categorie di investimento in un'unica
// tabella (la Liquidità ha la sua pagina). Stesse colonne di PaginaCategoria
// più la Categoria; il Peso è sul totale di questa tabella, non della categoria.
export default async function TuttiAssetPage() {
  const tMenu = await getTranslations('Menu')
  const t = await getTranslations('PaginaCategoria')
  const tTuttiAsset = await getTranslations('PaginaTuttiAsset')
  const tContenitore = await getTranslations('PaginaContenitore')
  const tCategorie = await getTranslations('Categorie')
  const tTipiStrumento = await getTranslations('TipiStrumento')

  const COLONNE: ColonnaTabella[] = [
    { key: 'nome', label: t('colonnaStrumento'), kind: 'link', linkPrefix: '/asset/', linkKey: 'strumentoId' },
    { key: 'categoria', label: tContenitore('colonnaCategoria'), kind: 'text' },
    { key: 'tipo', label: t('colonnaTipo'), kind: 'text' },
    { key: 'rendimentoPct', label: t('colonnaRendimento'), kind: 'percent-signed' },
    { key: 'rendimentoAssoluto', label: t('colonnaRendimentoEuro'), kind: 'euro-signed' },
    { key: 'valore', label: t('colonnaValore'), kind: 'euro' },
    { key: 'peso', label: t('colonnaPeso'), kind: 'percent', tooltip: tTuttiAsset('tooltipPeso') },
    { key: 'nav', label: t('colonnaNav'), kind: 'euro' },
    { key: 'prezzoMedioUnitario', label: t('colonnaPrezzoMedio'), kind: 'euro' },
    { key: 'costo', label: t('colonnaCosto'), kind: 'euro' },
    { key: 'provenienza', label: t('colonnaProvenienza'), kind: 'text' },
  ]

  const supabase = await createClient()

  const { data: strumenti } = await supabase
    .from('strumenti')
    .select('id, nome, tipo, categoria')
    .neq('categoria', 'Liquidita')

  const strumentoIds = strumenti?.map((s) => s.id) ?? []

  const { data: posizioni } = strumentoIds.length
    ? await supabase
        .from('v_riepilogo_posizione')
        .select('strumento_id, contenitore_id, valore, rendimento_pct, capitale_investito, prezzo_medio_unitario, prezzo_attuale, quantita_posseduta')
        .in('strumento_id', strumentoIds)
        .gt('quantita_posseduta', 0)
    : { data: null }

  const { data: costi } = strumentoIds.length
    ? await supabase
        .from('v_costo_per_strumento')
        .select('strumento_id, contenitore_id, costo_totale')
        .in('strumento_id', strumentoIds)
    : { data: null }

  const contenitoreIds = Array.from(
    new Set((posizioni ?? []).map((p) => p.contenitore_id).filter((id): id is string => id !== null))
  )

  const { data: contenitori } = contenitoreIds.length
    ? await supabase.from('contenitori').select('id, nome').in('id', contenitoreIds)
    : { data: null }

  // Il Peso si calcola sulla somma dei valori delle righe mostrate qui, non
  // su v_valore_per_categoria (che è per singola categoria): così i pesi della
  // tabella sommano sempre a 100%.
  const valoreTotaleTabella = (posizioni ?? []).reduce((acc, p) => acc + (p.valore ?? 0), 0)

  const righe: RigaTabella[] = (posizioni ?? [])
    .map((p) => {
      const strumento = strumenti?.find((s) => s.id === p.strumento_id)
      const costo = costi?.find((c) => c.strumento_id === p.strumento_id && c.contenitore_id === p.contenitore_id)
      const contenitore = p.contenitore_id ? contenitori?.find((c) => c.id === p.contenitore_id) : null
      return {
        key: `${p.strumento_id}-${p.contenitore_id ?? 'diretto'}`,
        strumentoId: p.strumento_id,
        nome: strumento?.nome ?? '—',
        categoria: strumento?.categoria != null ? traduciCategoria(tCategorie, strumento.categoria) : '—',
        tipo: strumento?.tipo != null ? traduciTipoStrumento(tTipiStrumento, strumento.tipo) : '—',
        rendimentoPct: p.rendimento_pct ?? 0,
        rendimentoAssoluto: (p.valore ?? 0) - (p.capitale_investito ?? 0),
        valore: p.valore ?? 0,
        peso: valoreTotaleTabella > 0 ? ((p.valore ?? 0) / valoreTotaleTabella) * 100 : 0,
        nav: p.prezzo_attuale ?? 0,
        prezzoMedioUnitario: p.prezzo_medio_unitario ?? 0,
        costo: costo?.costo_totale ?? 0,
        provenienza: contenitore?.nome ?? t('provenienzaDiretto'),
      }
    })
    .sort((a, b) => (b.valore as number) - (a.valore as number))

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('portafoglio')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tMenu('tuttiAsset')}</h1>

      <section>
        <Sezione>
          <TabellaOrdinabile colonne={COLONNE} righe={righe} />
        </Sezione>
      </section>
    </div>
  )
}
