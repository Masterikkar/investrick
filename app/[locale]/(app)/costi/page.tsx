import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatEuro, type LocaleFormato } from '@/lib/format'
import { TabellaOrdinabile, type ColonnaTabella, type RigaTabella } from '@/components/tabella-ordinabile'
import { Sezione } from '@/components/sezione'
import { traduciCategoria } from '@/lib/i18n-categorie'

type CostoPerContenitore = { contenitore_id: string; costo_totale: number }
type CostoPerStrumento = { strumento_id: string; contenitore_id: string | null; categoria: string; costo_totale: number }
type CostoLiquidita = { strumento_id: string; contenitore_id: string | null; costo_totale: number }
type InteressiLiquidita = { strumento_id: string; contenitore_id: string | null; interessi_totali: number }
type SaldoLiquidita = { strumento_id: string; contenitore_id: string | null; saldo_corrente: number }
type RiepilogoPosizione = {
  strumento_id: string
  contenitore_id: string | null
  quantita_posseduta: number
  capitale_investito: number
  valore: number | null
}
type Strumento = { id: string; nome: string; categoria: string; tipo: string; provider: string | null }
type Contenitore = { id: string; nome: string }

// null quando non c'è guadagno: la tabella mostra "—" e lo ordina in fondo.
function costoPerEuro(costo: number, guadagno: number): number | null {
  return guadagno > 0 ? costo / guadagno : null
}

export default async function CostiPage() {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('PaginaCosti')
  const tMenu = await getTranslations('Menu')
  const tCategorie = await getTranslations('Categorie')
  const tContenitori = await getTranslations('Contenitori')
  const supabase = await createClient()

  const COLONNE_CONTENITORE: ColonnaTabella[] = [
    { key: 'nome', label: tContenitori('colonnaNome'), kind: 'text' },
    { key: 'costo', label: t('colonnaCosto'), kind: 'euro' },
    { key: 'costoPerEuro', label: t('colonnaCostoPerEuro'), kind: 'numero' },
  ]

  const COLONNE_ASSET: ColonnaTabella[] = [
    { key: 'nome', label: t('colonnaStrumento'), kind: 'link', linkPrefix: '/asset/', linkKey: 'strumentoId' },
    { key: 'categoria', label: t('colonnaCategoria'), kind: 'text' },
    { key: 'contenitore', label: tContenitori('colonnaGruppo'), kind: 'text' },
    { key: 'costo', label: t('colonnaCosto'), kind: 'euro' },
    { key: 'costoPerEuro', label: t('colonnaCostoPerEuro'), kind: 'numero' },
  ]

  const [
    { data: costoContenitoreRaw },
    { data: costoStrumentoRaw },
    { data: costoLiquiditaRaw },
    { data: interessiLiquiditaRaw },
    { data: saldoLiquiditaRaw },
    { data: riepilogoRaw },
    { data: strumentiRaw },
    { data: contenitoriRaw },
  ] = await Promise.all([
    supabase.from('v_costo_per_contenitore').select('contenitore_id, costo_totale').returns<CostoPerContenitore[]>(),
    supabase.from('v_costo_per_strumento').select('strumento_id, contenitore_id, categoria, costo_totale').returns<CostoPerStrumento[]>(),
    supabase.from('v_costo_liquidita').select('strumento_id, contenitore_id, costo_totale').returns<CostoLiquidita[]>(),
    supabase.from('v_interessi_liquidita').select('strumento_id, contenitore_id, interessi_totali').returns<InteressiLiquidita[]>(),
    supabase.from('v_saldo_liquidita').select('strumento_id, contenitore_id, saldo_corrente').returns<SaldoLiquidita[]>(),
    supabase.from('v_riepilogo_posizione').select('strumento_id, contenitore_id, quantita_posseduta, capitale_investito, valore').returns<RiepilogoPosizione[]>(),
    supabase.from('strumenti').select('id, nome, categoria, tipo, provider').returns<Strumento[]>(),
    supabase.from('contenitori').select('id, nome').returns<Contenitore[]>(),
  ])

  const costoContenitore = costoContenitoreRaw ?? []
  const costoStrumento = costoStrumentoRaw ?? []
  const costoLiquidita = costoLiquiditaRaw ?? []
  const interessiLiquidita = interessiLiquiditaRaw ?? []
  const saldoLiquidita = saldoLiquiditaRaw ?? []
  const riepilogo = riepilogoRaw ?? []
  const strumenti = strumentiRaw ?? []
  const contenitori = contenitoriRaw ?? []

  const strumentoMap = new Map(strumenti.map((s) => [s.id, s]))
  const contenitoreMap = new Map(contenitori.map((c) => [c.id, c.nome]))

  const totaleCostiMercato = costoStrumento.reduce((sum, c) => sum + Number(c.costo_totale), 0)
  const totaleCostiLiquidita = costoLiquidita.reduce((sum, c) => sum + Number(c.costo_totale), 0)
  const totaleCosti = totaleCostiMercato + totaleCostiLiquidita

  const perContenitore = new Map<string, { nome: string; costo: number; guadagno: number }>()

  const getRiga = (id: string | null) => {
    const chiave = id ?? 'diretto'
    if (!perContenitore.has(chiave)) {
      // Senza contenitore: una riga reale col suo totale, così la tabella somma al totale.
      perContenitore.set(chiave, { nome: id ? contenitoreMap.get(id) ?? '—' : tContenitori('nessunGruppo'), costo: 0, guadagno: 0 })
    }
    return perContenitore.get(chiave)!
  }

  for (const c of costoContenitore) getRiga(c.contenitore_id).costo += Number(c.costo_totale)
  for (const c of costoStrumento.filter((c) => c.contenitore_id === null)) getRiga(null).costo += Number(c.costo_totale)
  for (const c of costoLiquidita) getRiga(c.contenitore_id).costo += Number(c.costo_totale)

  for (const r of riepilogo) {
    if (r.valore == null) continue
    getRiga(r.contenitore_id).guadagno += Number(r.valore) - Number(r.capitale_investito)
  }
  for (const i of interessiLiquidita) getRiga(i.contenitore_id).guadagno += Number(i.interessi_totali)

  const righeContenitore: RigaTabella[] = Array.from(perContenitore.values())
    .filter((r) => r.costo > 0 || r.guadagno !== 0)
    .sort((a, b) => b.costo - a.costo)
    .map((r) => ({
      key: r.nome,
      nome: r.nome,
      costo: r.costo,
      costoPerEuro: costoPerEuro(r.costo, r.guadagno),
    }))

  const costoStrumentoMap = new Map<string, number>()
  for (const c of costoStrumento) costoStrumentoMap.set(`${c.strumento_id}|${c.contenitore_id ?? ''}`, Number(c.costo_totale))

  const assetMercato: RigaTabella[] = riepilogo
    .filter((r) => r.quantita_posseduta > 0)
    .map((r) => {
      const info = strumentoMap.get(r.strumento_id)
      const costo = costoStrumentoMap.get(`${r.strumento_id}|${r.contenitore_id ?? ''}`) ?? 0
      const guadagno = r.valore != null ? Number(r.valore) - Number(r.capitale_investito) : 0
      const categoria = info?.categoria
      return {
        key: `${r.strumento_id}|${r.contenitore_id ?? 'diretto'}`,
        strumentoId: r.strumento_id,
        nome: info?.nome ?? '—',
        categoria: categoria ? traduciCategoria(tCategorie, categoria) : '—',
        contenitore: r.contenitore_id ? contenitoreMap.get(r.contenitore_id) ?? '—' : '—',
        costo,
        costoPerEuro: costoPerEuro(costo, guadagno),
      }
    })

  const saldoMap = new Map<string, number>()
  for (const s of saldoLiquidita) saldoMap.set(`${s.strumento_id}|${s.contenitore_id ?? ''}`, Number(s.saldo_corrente))
  const costoLiquiditaMap = new Map<string, number>()
  for (const c of costoLiquidita) costoLiquiditaMap.set(`${c.strumento_id}|${c.contenitore_id ?? ''}`, Number(c.costo_totale))
  const interessiMap = new Map<string, number>()
  for (const i of interessiLiquidita) interessiMap.set(`${i.strumento_id}|${i.contenitore_id ?? ''}`, Number(i.interessi_totali))

  const chiaviLiquidita = new Set([
    ...saldoLiquidita.map((s) => `${s.strumento_id}|${s.contenitore_id ?? ''}`),
    ...costoLiquidita.map((c) => `${c.strumento_id}|${c.contenitore_id ?? ''}`),
    ...interessiLiquidita.map((i) => `${i.strumento_id}|${i.contenitore_id ?? ''}`),
  ])

  const assetLiquidita: RigaTabella[] = Array.from(chiaviLiquidita).map((chiave) => {
    const [strumentoId, contenitoreId] = chiave.split('|')
    const info = strumentoMap.get(strumentoId)
    const costo = costoLiquiditaMap.get(chiave) ?? 0
    const guadagno = interessiMap.get(chiave) ?? 0
    return {
      key: chiave,
      nome: info?.provider ? `${info.nome} (${info.provider})` : info?.nome ?? '—',
      categoria: tContenitori('liquidita'),
      contenitore: contenitoreId ? contenitoreMap.get(contenitoreId) ?? '—' : '—',
      costo,
      costoPerEuro: costoPerEuro(costo, guadagno),
    }
  })

  const tuttiGliAsset: RigaTabella[] = [...assetMercato, ...assetLiquidita].sort(
    (a, b) => (b.costo as number) - (a.costo as number)
  )

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('analisi')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tMenu('costi')}</h1>

      <section>
        <Sezione>
          <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{t('titoloTotaleCosti')}</div>
          <div
            style={{
              fontFamily: 'var(--font-zilla-slab)',
              fontWeight: 600,
              fontSize: 'var(--fs-hero)',
              marginTop: 4,
              color: 'var(--text-primary)',
            }}
          >
            {formatEuro(totaleCosti, locale)}
          </div>
          <p style={{ fontSize: 'var(--fs-form-hint)', color: 'var(--text-secondary)', margin: '8px 0 0', maxWidth: 560 }}>
            {t('notaTotaleCosti')}
          </p>
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{t('titoloPerContenitore')}</h2>
        <Sezione>
          <TabellaOrdinabile colonne={COLONNE_CONTENITORE} righe={righeContenitore} />
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{t('titoloTuttiGliAsset')}</h2>
        <Sezione>
          <TabellaOrdinabile colonne={COLONNE_ASSET} righe={tuttiGliAsset} />
        </Sezione>
      </section>
    </div>
  )
}
