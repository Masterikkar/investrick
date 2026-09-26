import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatEuro, formatEuroSigned, formatNumero, formatPercent, type LocaleFormato } from '@/lib/format'
import { Sezione } from '@/components/sezione'
import { RippleLink } from '@/components/ripple-link'
import { SogliaRibilanciamento } from '@/components/soglia-ribilanciamento'
import { FormSimulazione } from './form-simulazione'
import { FormSimulazionePortafoglio } from './form-simulazione-portafoglio'
import { RisultatoPortafoglioVista } from './risultato-portafoglio'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { CATEGORIE } from '@/lib/categorie'
import { traduciCategoria } from '@/lib/i18n-categorie'
import {
  calcolaRibilanciamentoConVersamento,
  calcolaRibilanciamentoPortafoglio,
  distribuisciAcquisto,
  simulaVenditaStrumento,
  aliquotaPerStrumento,
  type CompartoTarget,
  type RigaAllocazione,
  type EsitoVenditaStrumento,
  type BloccoPac,
  type CategoriaPortafoglio,
  type RisultatoPortafoglio,
} from '@/lib/ribilanciamento'

type Scostamento = {
  target_id: string
  contenitore_id: string
  contenitore_nome: string
  contenitore_tipo: string
  categoria: string
  target_percentuale: number
  valore_categoria: number
  valore_contenitore_totale: number
  peso_attuale_pct: number
  scostamento_pp: number
}

type ScostamentoPortafoglio = {
  target_id: string
  categoria: string
  target_percentuale: number
  peso_attuale_pct: number
  scostamento_pp: number
}

type PosizioneVendibile = {
  strumento_id: string
  categoria: string
  valore_attuale: number
  prezzo_attuale: number
}

// Come PosizioneVendibile, ma con il contenitore: a livello di portafoglio
// intero le posizioni vendibili vengono da gruppi diversi (diretti o PAC),
// mai da una Polizza.
type PosizionePortafoglioVendibile = PosizioneVendibile & { contenitore_id: string | null }

type StrumentoInfo = {
  id: string
  nome: string
  ticker: string | null
  aliquota_tassazione: number
}

type LottoRaw = {
  strumento_id: string
  quantita_residua: number
  prezzo_acquisto: number
  commissione_residua: number
}

type SubTargetRaw = {
  strumento_id: string
  target_percentuale_categoria: number
}

export default async function RibilanciamentoPage({
  searchParams,
}: {
  searchParams: Promise<{
    contenitore_id?: string
    versamento?: string
    forza?: string
    commissione_vendita?: string
    portafoglio?: string
    versamento_portafoglio?: string
  }>
}) {
  const locale = (await getLocale()) as LocaleFormato
  const t = await getTranslations('PaginaRibilanciamento')
  const tMenu = await getTranslations('Menu')
  const tContenitori = await getTranslations('Contenitori')
  const tCategorie = await getTranslations('Categorie')
  const tPaginaCosti = await getTranslations('PaginaCosti')
  const tPaginaFiscalita = await getTranslations('PaginaFiscalita')
  const tPaginaStorico = await getTranslations('PaginaStorico')
  const tPaginaContenitore = await getTranslations('PaginaContenitore')
  const params = await searchParams
  const supabase = await createClient()

  // Condivisi fra la simulazione per gruppo e quella sul portafoglio intero.
  const forzaVendita = params.forza === '1'
  const commissioneVenditaStimata = params.commissione_vendita ? Number(params.commissione_vendita) : 0

  const { data: scostamenti } = await supabase
    .from('v_scostamento_target')
    .select('*')
    .returns<Scostamento[]>()

  const { data: scostamentiPortafoglio } = await supabase
    .from('v_scostamento_target_portafoglio')
    .select('target_id, categoria, target_percentuale, peso_attuale_pct, scostamento_pp')
    .returns<ScostamentoPortafoglio[]>()

  const { data: impostazioni } = await supabase
    .from('impostazioni_utente')
    .select('soglia_ribilanciamento_pp')
    .maybeSingle()

  const soglia = impostazioni?.soglia_ribilanciamento_pp ?? 3

  const fuoriSoglia = (scostamenti ?? [])
    .filter((s) => Math.abs(s.scostamento_pp) >= soglia)
    .sort((a, b) => Math.abs(b.scostamento_pp) - Math.abs(a.scostamento_pp))

  const fuoriSogliaPortafoglio = (scostamentiPortafoglio ?? [])
    .filter((s) => Math.abs(s.scostamento_pp) >= soglia)
    .sort((a, b) => Math.abs(b.scostamento_pp) - Math.abs(a.scostamento_pp))

  // Simulazione sul portafoglio intero (percorso a parte da quella per gruppo).
  const versamentoPortafoglioNumero = params.versamento_portafoglio ? Number(params.versamento_portafoglio) : NaN
  const versamentoPortafoglio =
    Number.isFinite(versamentoPortafoglioNumero) && versamentoPortafoglioNumero >= 0 ? versamentoPortafoglioNumero : null
  let risultatoPortafoglio: RisultatoPortafoglio | null = null
  const venditePortafoglioProposte: EsitoVenditaStrumento[] = []
  let poolPortafoglioTotale: number | null = null

  if (params.portafoglio === '1' && (scostamentiPortafoglio ?? []).length > 0) {
    const [{ data: valoriCategoria }, { data: contenitori }, { data: posizioni }, { data: saldi }, { data: targetGruppi }] =
      await Promise.all([
        supabase.from('v_valore_per_categoria').select('categoria, valore_totale'),
        supabase.from('contenitori').select('id, nome, tipo, target_attivo'),
        tutteLeRighe((da, a) =>
          supabase
            .from('v_valore_posizioni_attuale')
            .select('strumento_id, contenitore_id, categoria, quantita_corrente')
            .order('strumento_id')
            .order('contenitore_id', { nullsFirst: true })
            .range(da, a)
        ),
        supabase.from('v_saldo_liquidita').select('contenitore_id'),
        supabase
          .from('target_allocazioni')
          .select('contenitore_id, categoria, target_percentuale')
          .not('contenitore_id', 'is', null)
          .eq('attivo', true),
      ])

    const tipoContenitore = new Map((contenitori ?? []).map((c) => [c.id, c.tipo]))
    const direttaOPolizza = (contenitoreId: string | null) =>
      contenitoreId === null || tipoContenitore.get(contenitoreId) === 'Polizza'
    // Vendibile a livello di portafoglio: diretta o in un PAC. Mai in Polizza —
    // resta un compartimento separato, ribilanciabile solo al suo interno
    // (switch fiscalmente neutri) con lo strumento per singolo gruppo.
    const direttaOPac = (contenitoreId: string | null) =>
      contenitoreId === null || tipoContenitore.get(contenitoreId) === 'PAC'

    // Libera = esiste già una posizione diretta o in una Polizza in quella
    // categoria; per la Liquidità, un conto diretto o in una Polizza.
    const categorieLibere = new Set(
      (posizioni ?? [])
        .filter((p) => Number(p.quantita_corrente) > 0 && p.categoria && direttaOPolizza(p.contenitore_id))
        .map((p) => p.categoria as string)
    )
    if ((saldi ?? []).some((s) => direttaOPolizza(s.contenitore_id))) categorieLibere.add('Liquidita')

    const targetPortafoglio = new Map(
      (scostamentiPortafoglio ?? []).map((s) => [s.categoria, Number(s.target_percentuale) / 100])
    )
    const valorePerCategoria = new Map(
      (valoriCategoria ?? []).map((v) => [v.categoria, Number(v.valore_totale ?? 0)])
    )
    const categoriePortafoglio: CategoriaPortafoglio[] = CATEGORIE.map((categoria) => ({
      categoria,
      valoreAttuale: valorePerCategoria.get(categoria) ?? 0,
      targetPct: targetPortafoglio.get(categoria) ?? null,
      libera: categorieLibere.has(categoria),
    }))

    // Un PAC è un blocco solo con il target attivo e completo (somma 100).
    const blocchiPac: BloccoPac[] = []
    for (const c of contenitori ?? []) {
      if (c.tipo !== 'PAC' || !c.target_attivo) continue
      const righe = (targetGruppi ?? []).filter((r) => r.contenitore_id === c.id)
      const somma = righe.reduce((acc, r) => acc + Number(r.target_percentuale), 0)
      if (Math.abs(somma - 100) > 0.01) continue
      blocchiPac.push({
        id: c.id,
        nome: c.nome,
        forma: Object.fromEntries(righe.map((r) => [r.categoria, Number(r.target_percentuale) / 100])),
      })
    }

    const risultatoSoloDeposito = calcolaRibilanciamentoPortafoglio(categoriePortafoglio, blocchiPac, soglia, versamentoPortafoglio)
    risultatoPortafoglio = risultatoSoloDeposito

    // Se il versamento indicato non basta a comprare soltanto, prima di
    // accontentarsi si prova a vendere dalle categorie oggi sovrappesate
    // (solo posizioni dirette o in un PAC — vedi direttaOPac) e a reinvestire
    // il ricavato netto insieme al versamento, con lo stesso motore usato per
    // il versamento puro.
    const necessitaVendita =
      versamentoPortafoglio !== null &&
      (risultatoSoloDeposito.esito === 'residuo' || risultatoSoloDeposito.esito === 'irraggiungibile')

    if (necessitaVendita) {
      const totaleAttualePortafoglio = categoriePortafoglio.reduce((acc, c) => acc + c.valoreAttuale, 0)
      const categorieSovrappesate = categoriePortafoglio.filter(
        (c) => c.targetPct !== null && c.valoreAttuale > (c.targetPct + soglia / 100) * totaleAttualePortafoglio
      )

      if (categorieSovrappesate.length > 0) {
        const { data: posizioniVendibiliRaw } = await supabase
          .from('v_valore_posizioni_attuale')
          .select('strumento_id, contenitore_id, categoria, valore_attuale, prezzo_attuale')
          .in('categoria', categorieSovrappesate.map((c) => c.categoria))
          .returns<PosizionePortafoglioVendibile[]>()

        const posizioniVendibili = (posizioniVendibiliRaw ?? []).filter((p) => direttaOPac(p.contenitore_id))
        const strumentoIdsVendibili = posizioniVendibili.map((p) => p.strumento_id)
        const vendutoPerCategoriaPortafoglio = new Map<string, number>()

        if (strumentoIdsVendibili.length > 0) {
          const { data: strumentiInfoPortafoglio } = await supabase
            .from('strumenti')
            .select('id, nome, ticker, aliquota_tassazione')
            .in('id', strumentoIdsVendibili)
            .returns<StrumentoInfo[]>()

          const { data: lottiPortafoglioRaw } = await supabase
            .from('v_lotti_residui')
            .select('strumento_id, quantita_residua, prezzo_acquisto, commissione_residua, data_acquisto')
            .in('strumento_id', strumentoIdsVendibili)
            .order('data_acquisto', { ascending: true })
            .returns<LottoRaw[]>()

          for (const c of categorieSovrappesate) {
            const posizioniCategoria = posizioniVendibili.filter((p) => p.categoria === c.categoria)
            const totaleCategoriaVendibile = posizioniCategoria.reduce((sum, p) => sum + Number(p.valore_attuale), 0)
            const idealeCategoria = Math.min(
              c.valoreAttuale - (c.targetPct ?? 0) * totaleAttualePortafoglio,
              totaleCategoriaVendibile
            )
            if (totaleCategoriaVendibile <= 0 || idealeCategoria <= 0) continue

            let vendutoCategoria = 0

            for (const p of posizioniCategoria) {
              const info = strumentiInfoPortafoglio?.find((si) => si.id === p.strumento_id)
              if (!info) continue

              const idealeStrumento = idealeCategoria * (Number(p.valore_attuale) / totaleCategoriaVendibile)
              const quantitaIdeale = idealeStrumento / Number(p.prezzo_attuale)
              if (quantitaIdeale <= 0) continue

              const lottiStrumento = (lottiPortafoglioRaw ?? [])
                .filter((l) => l.strumento_id === p.strumento_id)
                .map((l) => ({
                  quantitaResidua: Number(l.quantita_residua),
                  prezzoAcquisto: Number(l.prezzo_acquisto),
                  commissioneResidua: Number(l.commissione_residua),
                }))

              // Mai in Polizza in questo insieme: sempre una vendita reale imponibile.
              const aliquota = aliquotaPerStrumento({ aliquotaTassazione: info.aliquota_tassazione })

              const esito = simulaVenditaStrumento(
                p.strumento_id,
                info.nome,
                lottiStrumento,
                quantitaIdeale,
                Number(p.prezzo_attuale),
                commissioneVenditaStimata,
                true,
                aliquota,
                forzaVendita
              )

              venditePortafoglioProposte.push(esito)
              vendutoCategoria += esito.valoreVenduto
            }

            vendutoPerCategoriaPortafoglio.set(c.categoria, vendutoCategoria)
          }
        }

        const proventoNettoTotalePortafoglio = venditePortafoglioProposte.reduce((s, v) => s + v.proventoNetto, 0)

        if (proventoNettoTotalePortafoglio > 0) {
          poolPortafoglioTotale = versamentoPortafoglio + proventoNettoTotalePortafoglio

          const categoriePortafoglioPostVendita: CategoriaPortafoglio[] = categoriePortafoglio.map((c) => ({
            ...c,
            valoreAttuale: c.valoreAttuale - (vendutoPerCategoriaPortafoglio.get(c.categoria) ?? 0),
          }))

          risultatoPortafoglio = calcolaRibilanciamentoPortafoglio(
            categoriePortafoglioPostVendita,
            blocchiPac,
            soglia,
            poolPortafoglioTotale
          )
        }
      }
    }
  }

  // I gruppi Personalizzati compaiono negli scostamenti ma non si simulano:
  // non contengono posizioni proprie da comprare o vendere.
  const scostamentiSimulabili = (scostamenti ?? []).filter((s) => s.contenitore_tipo !== 'Personalizzato')
  const contenitoriMap = new Map<string, string>()
  for (const s of scostamentiSimulabili) contenitoriMap.set(s.contenitore_id, s.contenitore_nome)
  const contenitoriDisponibili = Array.from(contenitoriMap.entries())

  const contenitoreSelezionato = params.contenitore_id
  const versamento = params.versamento ? Number(params.versamento) : 0

  let necessario: number | null = null
  let sufficiente = false
  let allocazioneAcquisto: RigaAllocazione[] = []
  const venditeProposte: EsitoVenditaStrumento[] = []
  let poolTotale = 0
  const allocazioneStrumenti: {
    categoria: string
    usaTarget: boolean
    strumenti: { nome: string; ticker: string | null; importo: number }[]
  }[] = []

  if (contenitoreSelezionato) {
    const comparti = scostamentiSimulabili.filter((s) => s.contenitore_id === contenitoreSelezionato)

    if (comparti.length > 0) {
      const contenitoreTipo = comparti[0].contenitore_tipo
      const valoreTotaleAttuale = comparti[0].valore_contenitore_totale

      const compartiInput: CompartoTarget[] = comparti.map((c) => ({
        categoria: c.categoria,
        valoreAttuale: c.valore_categoria,
        targetPct: c.target_percentuale / 100,
      }))

      const risultatoPuro = calcolaRibilanciamentoConVersamento(
        compartiInput,
        valoreTotaleAttuale,
        soglia,
        Math.max(versamento, valoreTotaleAttuale * 20, 1000)
      )
      necessario = risultatoPuro.budgetNecessario
      sufficiente = versamento >= necessario

      if (sufficiente) {
        allocazioneAcquisto = distribuisciAcquisto(compartiInput, valoreTotaleAttuale, versamento)
        poolTotale = versamento
      } else {
        const comportiSovrappesati = comparti.filter(
          (c) => c.valore_categoria > (c.target_percentuale / 100) * valoreTotaleAttuale
        )

        const idealeSellPerCategoria = new Map<string, number>()
        for (const c of comportiSovrappesati) {
          idealeSellPerCategoria.set(
            c.categoria,
            c.valore_categoria - (c.target_percentuale / 100) * valoreTotaleAttuale
          )
        }

        const vendutoPerCategoria = new Map<string, number>()

        if (comportiSovrappesati.length > 0) {
          const { data: posizioniRaw } = await supabase
            .from('v_valore_posizioni_attuale')
            .select('strumento_id, categoria, valore_attuale, prezzo_attuale')
            .eq('contenitore_id', contenitoreSelezionato)
            .in('categoria', comportiSovrappesati.map((c) => c.categoria))
            .returns<PosizioneVendibile[]>()

          const posizioni = posizioniRaw ?? []
          const strumentoIds = posizioni.map((p) => p.strumento_id)

          const { data: strumentiInfo } = await supabase
            .from('strumenti')
            .select('id, nome, ticker, aliquota_tassazione')
            .in('id', strumentoIds)
            .returns<StrumentoInfo[]>()

          const { data: lottiRaw } = await supabase
            .from('v_lotti_residui')
            .select('strumento_id, quantita_residua, prezzo_acquisto, commissione_residua, data_acquisto')
            .eq('contenitore_id', contenitoreSelezionato)
            .in('strumento_id', strumentoIds)
            .order('data_acquisto', { ascending: true })
            .returns<LottoRaw[]>()

          const imponibile = contenitoreTipo !== 'Polizza'

          for (const c of comportiSovrappesati) {
            const idealeCategoria = idealeSellPerCategoria.get(c.categoria) ?? 0
            const posizioniCategoria = posizioni.filter((p) => p.categoria === c.categoria)
            const totaleCategoria = posizioniCategoria.reduce((sum, p) => sum + Number(p.valore_attuale), 0)
            if (totaleCategoria <= 0) continue

            let vendutoCategoria = 0

            for (const p of posizioniCategoria) {
              const info = strumentiInfo?.find((si) => si.id === p.strumento_id)
              if (!info) continue

              const idealeStrumento = idealeCategoria * (Number(p.valore_attuale) / totaleCategoria)
              const quantitaIdeale = idealeStrumento / Number(p.prezzo_attuale)
              if (quantitaIdeale <= 0) continue

              const lottiStrumento = (lottiRaw ?? [])
                .filter((l) => l.strumento_id === p.strumento_id)
                .map((l) => ({
                  quantitaResidua: Number(l.quantita_residua),
                  prezzoAcquisto: Number(l.prezzo_acquisto),
                  commissioneResidua: Number(l.commissione_residua),
                }))

              const aliquota = aliquotaPerStrumento({ aliquotaTassazione: info.aliquota_tassazione })

              const esito = simulaVenditaStrumento(
                p.strumento_id,
                info.nome,
                lottiStrumento,
                quantitaIdeale,
                Number(p.prezzo_attuale),
                commissioneVenditaStimata,
                imponibile,
                aliquota,
                forzaVendita
              )

              venditeProposte.push(esito)
              vendutoCategoria += esito.valoreVenduto
            }

            vendutoPerCategoria.set(c.categoria, vendutoCategoria)
          }
        }

        const proventoNettoTotale = venditeProposte.reduce((s, v) => s + v.proventoNetto, 0)
        poolTotale = versamento + proventoNettoTotale

        const compartiPostVendita: CompartoTarget[] = compartiInput.map((c) => ({
          categoria: c.categoria,
          valoreAttuale: c.valoreAttuale - (vendutoPerCategoria.get(c.categoria) ?? 0),
          targetPct: c.targetPct,
        }))
        const totaleAttualePostVendita =
          valoreTotaleAttuale - Array.from(vendutoPerCategoria.values()).reduce((a, b) => a + b, 0)

        allocazioneAcquisto = distribuisciAcquisto(compartiPostVendita, totaleAttualePostVendita, poolTotale)
      }

      for (const a of allocazioneAcquisto.filter((r) => r.importo > 0)) {
        const { data: posizioni } = await supabase
          .from('v_valore_posizioni_attuale')
          .select('strumento_id, valore_attuale')
          .eq('contenitore_id', contenitoreSelezionato)
          .eq('categoria', a.categoria)
          .returns<{ strumento_id: string; valore_attuale: number }[]>()

        const righe = posizioni ?? []
        const totaleCategoria = righe.reduce((sum, r) => sum + Number(r.valore_attuale), 0)

        if (totaleCategoria > 0) {
          const { data: strumentiInfo } = await supabase
            .from('strumenti')
            .select('id, nome, ticker')
            .in('id', righe.map((r) => r.strumento_id))

          const { data: subTargetRaw } = await supabase
            .from('target_allocazioni_strumento')
            .select('strumento_id, target_percentuale_categoria')
            .eq('contenitore_id', contenitoreSelezionato)
            .in('strumento_id', righe.map((r) => r.strumento_id))
            .returns<SubTargetRaw[]>()

          const subTargetMap = new Map(
            (subTargetRaw ?? []).map((t) => [t.strumento_id, Number(t.target_percentuale_categoria)])
          )
          const sommaSubTarget = righe.reduce((sum, r) => sum + (subTargetMap.get(r.strumento_id) ?? 0), 0)
          const subTargetValidi =
            righe.length > 1 &&
            righe.every((r) => subTargetMap.has(r.strumento_id)) &&
            Math.abs(sommaSubTarget - 100) < 0.01

          let importiPerStrumento: Map<string, number>

          if (subTargetValidi) {
            const compartiStrumento: CompartoTarget[] = righe.map((r) => ({
              categoria: r.strumento_id,
              valoreAttuale: Number(r.valore_attuale),
              targetPct: (subTargetMap.get(r.strumento_id) ?? 0) / 100,
            }))
            const allocazione = distribuisciAcquisto(compartiStrumento, totaleCategoria, a.importo)
            importiPerStrumento = new Map(allocazione.map((al) => [al.categoria, al.importo]))
          } else {
            importiPerStrumento = new Map(
              righe.map((r) => [
                r.strumento_id,
                Math.round((Number(r.valore_attuale) / totaleCategoria) * a.importo * 100) / 100,
              ])
            )
          }

          allocazioneStrumenti.push({
            categoria: a.categoria,
            usaTarget: subTargetValidi,
            strumenti: righe.map((r) => {
              const info = strumentiInfo?.find((si) => si.id === r.strumento_id)
              return {
                nome: info?.nome ?? '—',
                ticker: info?.ticker ?? null,
                importo: importiPerStrumento.get(r.strumento_id) ?? 0,
              }
            }),
          })
        } else {
          allocazioneStrumenti.push({ categoria: a.categoria, usaTarget: false, strumenti: [] })
        }
      }
    }
  }

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('analisi')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{tMenu('ribilanciamento')}</h1>
      <SogliaRibilanciamento sogliaIniziale={soglia} />

      {/* Portafoglio e gruppi in due sezioni separate: i pesi si misurano su
          totali diversi (l'intero portafoglio contro il singolo gruppo), quindi
          gli scostamenti non si confrontano tra loro in un unico ordinamento. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, margin: 0 }}>{tMenu('portafoglio')}</h2>
        <RippleLink href="/target/portafoglio" className="link-dettaglio" style={{ fontSize: 'var(--fs-card-link)' }}>
          {tPaginaContenitore('linkModificaTarget')}
        </RippleLink>
      </div>

      {(scostamentiPortafoglio ?? []).length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', margin: 0, color: 'var(--text-secondary)' }}>
          {t('alertNessunTargetPortafoglio')}
        </p>
      ) : fuoriSogliaPortafoglio.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', margin: 0, color: 'var(--text-secondary)' }}>
          {t('alertPortafoglioInLinea')}
        </p>
      ) : (
        <Sezione>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaAsset')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaTarget')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaAttuale')}</th>
                <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaScostamento')}</th>
              </tr>
            </thead>
            <tbody>
              {fuoriSogliaPortafoglio.map((s) => {
                const sovrappeso = s.scostamento_pp > 0
                return (
                  <tr key={s.target_id} className="tabella-riga">
                    <td style={{ padding: 8 }}>{traduciCategoria(tCategorie, s.categoria)}</td>
                    <td style={{ padding: 8 }}>{formatPercent(s.target_percentuale, 2, false, locale)}</td>
                    <td style={{ padding: 8 }}>{formatPercent(s.peso_attuale_pct, 2, false, locale)}</td>
                    <td style={{ padding: 8, color: sovrappeso ? 'var(--warning)' : 'var(--primary-vivid)', fontWeight: 500 }}>
                      {formatNumero(s.scostamento_pp, 2, true, locale)} pp ({sovrappeso ? t('sovrappeso') : t('sottopeso')})
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Sezione>
      )}

      {(scostamentiPortafoglio ?? []).length > 0 && (
        <>
          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 24, marginBottom: 12 }}>{t('titoloSimulazione')}</h3>
          <Sezione>
            <FormSimulazionePortafoglio
              versamentoIniziale={params.versamento_portafoglio}
              commissioneIniziale={params.commissione_vendita}
              forzaIniziale={forzaVendita}
            />
          </Sezione>
          {risultatoPortafoglio && (
            <div style={{ marginTop: 16 }}>
              <Sezione>
                {venditePortafoglioProposte.length > 0 && (
                  <>
                    <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warning)', fontWeight: 500 }}>
                      {t('messaggioVersamentoInsufficiente', { importo: formatEuro(versamentoPortafoglio ?? 0, locale) })}
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                          <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaStrumento')}</th>
                          <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaStorico('colonnaQuantita')}</th>
                          <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaValore')}</th>
                          <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaPlusMinusLorda')}</th>
                          <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaAliquota')}</th>
                          <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaTassa')}</th>
                          <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaNetto')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {venditePortafoglioProposte.map((v) => (
                          <tr key={v.strumentoId} className="tabella-riga">
                            <td style={{ padding: 8 }}>{v.nome}</td>
                            <td style={{ padding: 8 }}>
                              {formatNumero(v.quantitaVenduta, 6, false, locale)}
                              {!v.vincoloRispettato && (
                                <div style={{ color: 'var(--warning)', fontSize: 'var(--fs-card-link)' }}>
                                  {t('notaQuantitaRidotta', { quantita: formatNumero(v.quantitaIdeale, 6, false, locale) })}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: 8 }}>{formatEuro(v.valoreVenduto, locale)}</td>
                            <td style={{ padding: 8, color: v.plusvalenzaLorda >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {formatEuroSigned(v.plusvalenzaLorda, locale)}
                            </td>
                            <td style={{ padding: 8 }}>{formatPercent(v.aliquota * 100, 1, false, locale)}</td>
                            <td style={{ padding: 8 }}>{formatEuro(v.tassa, locale)}</td>
                            <td style={{ padding: 8, fontWeight: 500 }}>{formatEuro(v.proventoNetto, locale)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {poolPortafoglioTotale !== null && (
                      <p style={{ fontSize: 'var(--fs-body)', marginTop: 12 }}>
                        {t.rich('messaggioPoolReinvestire', {
                          importo: formatEuro(poolPortafoglioTotale, locale),
                          strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                      </p>
                    )}
                  </>
                )}

                <p style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', marginTop: venditePortafoglioProposte.length > 0 ? 16 : 0, marginBottom: venditePortafoglioProposte.length > 0 ? 16 : 12 }}>
                  {t('notaPolizzaEsclusaDalleVendite')}
                </p>

                <RisultatoPortafoglioVista
                  risultato={risultatoPortafoglio}
                  versamentoMassimo={poolPortafoglioTotale !== null ? null : versamentoPortafoglio}
                />
              </Sezione>
            </div>
          )}
        </>
      )}

      <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginTop: 40, marginBottom: 12 }}>{tMenu('gruppi')}</h2>

      {fuoriSoglia.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', margin: 0, color: 'var(--text-secondary)' }}>
          {t('alertNessunoScostamentoSoglia')}
        </p>
      ) : (
        <div>
          <Sezione>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tContenitori('colonnaNome')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaCosti('colonnaCategoria')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaTarget')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaAttuale')}</th>
                  <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaScostamento')}</th>
                </tr>
              </thead>
              <tbody>
                {fuoriSoglia.map((s) => {
                  const sovrappeso = s.scostamento_pp > 0
                  return (
                    <tr key={s.target_id} className="tabella-riga">
                      <td style={{ padding: 8 }}>{s.contenitore_nome}</td>
                      <td style={{ padding: 8 }}>{traduciCategoria(tCategorie, s.categoria)}</td>
                      <td style={{ padding: 8 }}>{formatPercent(s.target_percentuale, 2, false, locale)}</td>
                      <td style={{ padding: 8 }}>{formatPercent(s.peso_attuale_pct, 2, false, locale)}</td>
                      <td style={{ padding: 8, color: sovrappeso ? 'var(--warning)' : 'var(--primary-vivid)', fontWeight: 500 }}>
                        {formatNumero(s.scostamento_pp, 2, true, locale)} pp ({sovrappeso ? t('sovrappeso') : t('sottopeso')})
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Sezione>
        </div>
      )}

      <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, marginTop: 40, marginBottom: 12 }}>{t('titoloSimulazione')}</h2>

      <Sezione>
        <FormSimulazione
          contenitoriDisponibili={contenitoriDisponibili}
          contenitoreSelezionato={contenitoreSelezionato}
          versamentoIniziale={params.versamento}
          commissioneIniziale={params.commissione_vendita}
          forzaIniziale={forzaVendita}
        />
      </Sezione>

      {contenitoreSelezionato && necessario !== null && (
        <div style={{ marginTop: 24 }}>
          <Sezione>
            <p style={{ fontSize: 'var(--fs-body)', margin: 0 }}>
              {t.rich('messaggioBudgetNecessario', {
                importo: formatEuro(necessario, locale),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>

            {sufficiente ? (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--success)', fontWeight: 500 }}>
                {t('messaggioVersamentoSufficiente', { importo: formatEuro(versamento, locale) })}
              </p>
            ) : (
              <>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warning)', fontWeight: 500 }}>
                  {t('messaggioVersamentoInsufficiente', { importo: formatEuro(versamento, locale) })}
                </p>

                {venditeProposte.length === 0 ? (
                  <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                    {t('alertNessunCompartoSovrappesato')}
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaStrumento')}</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaStorico('colonnaQuantita')}</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaValore')}</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaPlusMinusLorda')}</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaAliquota')}</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaTassa')}</th>
                        <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaNetto')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {venditeProposte.map((v) => (
                        <tr key={v.strumentoId} className="tabella-riga">
                          <td style={{ padding: 8 }}>{v.nome}</td>
                          <td style={{ padding: 8 }}>
                            {formatNumero(v.quantitaVenduta, 6, false, locale)}
                            {!v.vincoloRispettato && (
                              <div style={{ color: 'var(--warning)', fontSize: 'var(--fs-card-link)' }}>
                                {t('notaQuantitaRidotta', { quantita: formatNumero(v.quantitaIdeale, 6, false, locale) })}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: 8 }}>{formatEuro(v.valoreVenduto, locale)}</td>
                          <td style={{ padding: 8, color: v.plusvalenzaLorda >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {formatEuroSigned(v.plusvalenzaLorda, locale)}
                          </td>
                          <td style={{ padding: 8 }}>
                            {v.imponibile
                              ? formatPercent(v.aliquota * 100, 1, false, locale)
                              : t('esenteTipoContenitore', { tipo: tPaginaContenitore('etichettaPolizza') })}
                          </td>
                          <td style={{ padding: 8 }}>{formatEuro(v.tassa, locale)}</td>
                          <td style={{ padding: 8, fontWeight: 500 }}>{formatEuro(v.proventoNetto, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <p style={{ fontSize: 'var(--fs-body)', marginTop: 12 }}>
                  {t.rich('messaggioPoolReinvestire', {
                    importo: formatEuro(poolTotale, locale),
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
              </>
            )}

            {allocazioneAcquisto.length > 0 && (
              <>
                <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 24, marginBottom: 12 }}>{t('titoloAcquistiProposti')}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaCosti('colonnaCategoria')}</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaDaVersare')}</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaPesoFinale')}</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaScostamentoFinale')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocazioneAcquisto.map((a) => (
                      <tr key={a.categoria} className="tabella-riga">
                        <td style={{ padding: 8 }}>{traduciCategoria(tCategorie, a.categoria)}</td>
                        <td style={{ padding: 8 }}>{formatEuro(a.importo, locale)}</td>
                        <td style={{ padding: 8 }}>{formatPercent(a.pesoFinalePct, 2, false, locale)}</td>
                        <td style={{ padding: 8 }}>{formatNumero(a.scostamentoFinalePp, 2, true, locale)} pp</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {allocazioneStrumenti.map((c) => (
                  <div key={c.categoria} style={{ marginTop: 16, fontSize: 'var(--fs-body)' }}>
                    <strong>{traduciCategoria(tCategorie, c.categoria)}</strong>{' '}
                    <span style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)' }}>
                      ({c.usaTarget ? t('notaSecondoTargetStrumento') : t('notaSecondoPesiAttuali')})
                    </span>
                    {c.strumenti.length === 0 ? (
                      <p style={{ color: 'var(--warning)' }}>
                        {t('alertNessunoStrumentoPosseduto')}
                      </p>
                    ) : (
                      <ul>
                        {c.strumenti.map((s) => (
                          <li key={s.nome}>{s.nome} {s.ticker ? `(${s.ticker})` : ''}: {formatEuro(s.importo, locale)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </>
            )}
          </Sezione>
        </div>
      )}
    </div>
  )
}