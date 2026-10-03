import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatEuro, type LocaleFormato } from '@/lib/format'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { CATEGORIE } from '@/lib/categorie'
import { CardMetrica } from '@/components/card-metrica'
import { BarreDivergenti, type VoceBarra } from '@/components/barre-divergenti'
import { GraficoBarre, type PuntoBarra } from '@/components/grafico-barre'
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
    { data: premiPolizzeRaw },
    { data: eventiCostoRaw },
    { data: movimentiCostoRaw },
  ] = await Promise.all([
    supabase.from('v_costo_per_contenitore').select('contenitore_id, costo_totale').returns<CostoPerContenitore[]>(),
    supabase.from('v_costo_per_strumento').select('strumento_id, contenitore_id, categoria, costo_totale').returns<CostoPerStrumento[]>(),
    supabase.from('v_costo_liquidita').select('strumento_id, contenitore_id, costo_totale').returns<CostoLiquidita[]>(),
    supabase.from('v_interessi_liquidita').select('strumento_id, contenitore_id, interessi_totali').returns<InteressiLiquidita[]>(),
    supabase.from('v_saldo_liquidita').select('strumento_id, contenitore_id, saldo_corrente').returns<SaldoLiquidita[]>(),
    supabase.from('v_riepilogo_posizione').select('strumento_id, contenitore_id, quantita_posseduta, capitale_investito, valore').returns<RiepilogoPosizione[]>(),
    supabase.from('strumenti').select('id, nome, categoria, tipo, provider').returns<Strumento[]>(),
    supabase.from('contenitori').select('id, nome').returns<Contenitore[]>(),
    supabase.from('v_premi_residui_polizza').select('contenitore_id, non_realizzato_fiscale'),
    // Una riga per evento di costo (stessa fonte dei totali per gruppo e per asset),
    // letta a blocchi per non fermarsi a 1000 righe; transazione_id è univoco.
    tutteLeRighe((da, a) =>
      supabase
        .from('v_eventi_costo')
        .select('transazione_id, categoria, contenitore_id, data, importo_costo')
        .order('data', { ascending: true })
        .order('transazione_id', { ascending: true })
        .range(da, a)
    ),
    tutteLeRighe((da, a) =>
      supabase
        .from('movimenti_liquidita')
        .select('id, contenitore_id, data, importo')
        .eq('tipo_movimento', 'Costo')
        .order('data', { ascending: true })
        .order('id', { ascending: true })
        .range(da, a)
    ),
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

  // Guadagno di un gruppo: per una polizza il non realizzato fiscale del
  // contratto (valore − premi residui), per gli altri valore − costo dei lotti.
  const nonRealizzatoPolizza = new Map(
    (premiPolizzeRaw ?? [])
      .filter((p) => p.contenitore_id !== null)
      .map((p) => [p.contenitore_id as string, Number(p.non_realizzato_fiscale ?? 0)])
  )
  for (const r of riepilogo) {
    if (r.valore == null || (r.contenitore_id && nonRealizzatoPolizza.has(r.contenitore_id))) continue
    getRiga(r.contenitore_id).guadagno += Number(r.valore) - Number(r.capitale_investito)
  }
  for (const [id, guadagno] of nonRealizzatoPolizza) getRiga(id).guadagno += guadagno
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

  // Costi per anno: eventi di costo di mercato più i costi dei conti di
  // liquidità. Per l'anno corrente anche il dettaglio per categoria e per gruppo.
  const annoCorrente = new Date().getFullYear()
  const costiPerAnno = new Map<number, number>()
  const costiAnnoPerCategoria = new Map<string, number>()
  const costiAnnoPerGruppo = new Map<string, number>() // '' = nessun gruppo

  function aggiungiCosto(data: string | null, importo: number | null, categoria: string, contenitoreId: string | null) {
    if (!data) return
    const anno = Number(data.slice(0, 4))
    const valore = Number(importo ?? 0)
    costiPerAnno.set(anno, (costiPerAnno.get(anno) ?? 0) + valore)
    if (anno !== annoCorrente) return
    costiAnnoPerCategoria.set(categoria, (costiAnnoPerCategoria.get(categoria) ?? 0) + valore)
    costiAnnoPerGruppo.set(contenitoreId ?? '', (costiAnnoPerGruppo.get(contenitoreId ?? '') ?? 0) + valore)
  }
  for (const e of eventiCostoRaw ?? []) aggiungiCosto(e.data, e.importo_costo, e.categoria ?? '', e.contenitore_id)
  for (const m of movimentiCostoRaw ?? []) aggiungiCosto(m.data, m.importo, 'Liquidita', m.contenitore_id)

  const costoAnnoCorrente = costiPerAnno.get(annoCorrente) ?? 0

  const categorieOrdinate = [
    ...CATEGORIE,
    ...Array.from(costiAnnoPerCategoria.keys()).filter((c) => !CATEGORIE.includes(c)),
  ]
  const vociCategoria: VoceBarra[] = categorieOrdinate.map((cat) => ({
    etichetta: traduciCategoria(tCategorie, cat),
    valore: costiAnnoPerCategoria.get(cat) ?? 0,
  }))
  const vociGruppo: VoceBarra[] = Array.from(costiAnnoPerGruppo.entries())
    .filter(([, valore]) => valore > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, valore]) => ({
      etichetta: id ? contenitoreMap.get(id) ?? '—' : tContenitori('nessunGruppo'),
      valore,
    }))

  // Un punto per anno dal primo con costi a oggi, anche se un anno è a zero.
  const anniConCosti = Array.from(costiPerAnno.keys())
  const primoAnno = anniConCosti.length > 0 ? Math.min(...anniConCosti) : annoCorrente
  const puntiAnnuali: PuntoBarra[] = []
  for (let anno = primoAnno; anno <= annoCorrente; anno++) {
    puntiAnnuali.push({ etichetta: String(anno), valore: costiPerAnno.get(anno) ?? 0 })
  }

  const tuttiGliAsset: RigaTabella[] = [...assetMercato, ...assetLiquidita].sort(
    (a, b) => (b.costo as number) - (a.costo as number)
  )

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('analisi')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tMenu('costi')}</h1>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{t('titoloAnnoCorrente', { anno: annoCorrente })}</h2>
        <Sezione>
          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginBottom: 4 }}>{t('titoloCostiSostenuti')}</h3>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>{t('paragrafoAnnoCorrente')}</p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <CardMetrica label={t('labelTotaleAnno', { anno: annoCorrente })} minWidth={220}>
              {formatEuro(costoAnnoCorrente, locale)}
            </CardMetrica>
          </div>

          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginTop: 24, marginBottom: 4 }}>{t('labelPerCategoria')}</div>
          <BarreDivergenti voci={vociCategoria} variante="positivo" />

          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginTop: 20, marginBottom: 4 }}>{t('labelPerGruppo')}</div>
          {vociGruppo.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>{t('alertNessunCostoAnno')}</p>
          ) : (
            <BarreDivergenti voci={vociGruppo} variante="positivo" />
          )}
        </Sezione>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginBottom: 12 }}>{t('titoloStorico')}</h2>
        <Sezione>
          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginBottom: 4 }}>{t('titoloTotaleCosti')}</h3>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>{t('notaTotaleCosti')}</p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <CardMetrica label={t('labelTotaleDaSempre')} minWidth={220}>
              {formatEuro(totaleCosti, locale)}
            </CardMetrica>
          </div>

          <p style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginTop: 24, marginBottom: 4 }}>{t('labelAndamento')}</p>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>{t('paragrafoStorico')}</p>
          <GraficoBarre punti={puntiAnnuali} coloreUnico="#4C5FE0" />

          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 32, marginBottom: 12 }}>{t('titoloPerContenitore')}</h3>
          <TabellaOrdinabile colonne={COLONNE_CONTENITORE} righe={righeContenitore} />

          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 32, marginBottom: 12 }}>{t('titoloTuttiGliAsset')}</h3>
          <TabellaOrdinabile colonne={COLONNE_ASSET} righe={tuttiGliAsset} />
        </Sezione>
      </section>
    </div>
  )
}
