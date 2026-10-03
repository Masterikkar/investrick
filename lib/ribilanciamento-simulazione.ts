// Orchestrazione delle simulazioni di ribilanciamento (portafoglio intero e
// singolo gruppo): query Supabase + motore puro di lib/ribilanciamento.ts.
// Parametrizzato esplicitamente (niente searchParams): usato sia dalle
// Server Action del wizard sia, se serve, da altre pagine.

import { createClient } from '@/lib/supabase/server'
import { tutteLeRighe } from '@/lib/supabase-tutte-le-righe'
import { CATEGORIE } from '@/lib/categorie'
import {
  calcolaRibilanciamentoConVersamento,
  calcolaRibilanciamentoPortafoglio,
  calcolaAlternativeStrutturali,
  distribuisciAcquisto,
  simulaVenditaStrumento,
  aliquotaPerStrumento,
  type CompartoTarget,
  type RigaAllocazione,
  type EsitoVenditaStrumento,
  type BloccoPac,
  type CategoriaPortafoglio,
  type RisultatoPortafoglio,
  type AlternativaStrutturale,
} from '@/lib/ribilanciamento'

type ClientSupabase = Awaited<ReturnType<typeof createClient>>

// Nome della simulazione salvata (step "Esecuzione" del wizard): solo
// lettere, numeri e spazi — niente accenti né simboli — così un nome scelto
// male non può mai rompere l'export o un futuro filtro testuale. Un solo
// punto di validazione, usato sia lato client (filtro live mentre si scrive)
// sia lato server (controllo prima di salvare) — mai duplicato.
export const NOME_SIMULAZIONE_MAX = 40
const REGEX_NOME_SIMULAZIONE_VALIDO = /^[A-Za-z0-9 ]+$/

// Quante simulazioni si tengono nello storico (mini card + tetto DB): un solo
// punto, riusato da actions-simulazione.ts (lettura e pulizia) e dai due
// simulatori (avviso "stai per sovrascrivere" allo step 1 del wizard).
export const MAX_SIMULAZIONI_STORICO = 3

// Rimuove i caratteri non ammessi e tronca alla lunghezza massima: usata
// dal campo di input mentre l'utente digita, per un filtro "live".
export function pulisciNomeSimulazione(nome: string): string {
  return nome.replace(/[^A-Za-z0-9 ]/g, '').slice(0, NOME_SIMULAZIONE_MAX)
}

// Vero solo se il nome è già pulito, non vuoto (dopo trim) e nei limiti:
// usata dal server prima di salvare, per non fidarsi del solo filtro client.
export function nomeSimulazioneValido(nome: string): boolean {
  const pulito = nome.trim()
  return pulito.length > 0 && pulito.length <= NOME_SIMULAZIONE_MAX && REGEX_NOME_SIMULAZIONE_VALIDO.test(pulito)
}

export type Scostamento = {
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

export type ScostamentoPortafoglio = {
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

export async function leggiSogliaRibilanciamento(supabase: ClientSupabase): Promise<number> {
  const { data: impostazioni } = await supabase
    .from('impostazioni_utente')
    .select('soglia_ribilanciamento_pp')
    .maybeSingle()
  return impostazioni?.soglia_ribilanciamento_pp ?? 3
}

// --- Riscatto di un'intera Polizza (solo simulazione: nessuna Vendita reale creata) ---

export type EsitoRiscattoPolizza = {
  contenitoreId: string
  nome: string
  valoreAttuale: number
  premiResidui: number
  nonRealizzatoFiscale: number
  imponibile: number
  tassa: number
  commissioneStimata: number
  proventoNetto: number
}

async function calcolaRiscattoPolizza(
  supabase: ClientSupabase,
  contenitoreId: string,
  nome: string,
  commissioneVenditaStimata: number
): Promise<EsitoRiscattoPolizza | null> {
  const { data } = await supabase
    .from('v_premi_residui_polizza')
    .select('valore_attuale, premi_residui, non_realizzato_fiscale')
    .eq('contenitore_id', contenitoreId)
    .maybeSingle()
  if (!data) return null

  const valoreAttuale = Number(data.valore_attuale)
  const nonRealizzatoFiscale = Number(data.non_realizzato_fiscale)
  const imponibile = Math.max(nonRealizzatoFiscale, 0)
  const tassa = Math.round(imponibile * 0.26 * 100) / 100
  const proventoNetto = Math.round((valoreAttuale - tassa - commissioneVenditaStimata) * 100) / 100

  return {
    contenitoreId,
    nome,
    valoreAttuale,
    premiResidui: Number(data.premi_residui),
    nonRealizzatoFiscale,
    imponibile,
    tassa,
    commissioneStimata: commissioneVenditaStimata,
    proventoNetto,
  }
}

// --- Simulazione sul portafoglio intero ---

export type ParametriSimulazionePortafoglio = {
  versamentoMassimo: number | null
  commissioneVendita: number
  forzaVendita: boolean
  valutaRiscattoPolizza: boolean
  modoRiscattoPolizza: 'manuale' | 'automatico'
  polizzeSelezionate: string[]
  valutaPac: boolean
  pacSelezionati: string[]
  // PAC da trattare come un portafoglio a parte: valore e composizione
  // spariscono da tutta la simulazione (categorie libere, blocchiPac, totali
  // per categoria), indipendentemente da pacSelezionati/valutaPac — è un
  // concetto ortogonale alla "toccabilità" (vedi pacEsclusiSet in
  // simulaPortafoglio).
  pacEsclusi: string[]
}

// Un gruppo per ciascun PAC la cui forma fissa "intrappola" almeno una
// categoria al floor (quota > 0 nella forma del PAC per quella categoria):
// causa da mostrare in "Causa del problema", indipendente dal fatto che
// esista una specifica alternativa "nuovaFormaPac" (quella richiede almeno 2
// categorie intrappolate SOLO da quel PAC — qui basta che il PAC concorra a
// spingere la categoria al floor, anche da sola o anche se la categoria è
// anche libera).
export type AvvisoStrutturale = {
  floorPp: number
  categorie: string[]
  causaPac: { pacNome: string; categorie: string[] }[]
  // Sottoinsieme di risultato.senzaVeicolo che possiede comunque un valore
  // (>0) nel portafoglio — es. tenuto in un PAC non toccabile o con una
  // forma che non lo copre: il messaggio "non esistono asset" sarebbe falso
  // per queste, serve un testo diverso (vedi testoCausaSenzaVeicolo).
  senzaVeicoloConAsset: string[]
  alternative: AlternativaStrutturale[]
}

export type RisultatoSimulazionePortafoglio = {
  risultato: RisultatoPortafoglio
  venditeProposte: EsitoVenditaStrumento[]
  riscattiProposti: EsitoRiscattoPolizza[]
  poolTotale: number | null
  versamentoMassimo: number | null
  avvisoStrutturale: AvvisoStrutturale | null
  // Soglia di scostamento impostata dall'utente (impostazioni_utente.soglia_ribilanciamento_pp,
  // default 3): serve al layout a blocchi del risultato per mostrare "Soglia
  // impostata: X%" accanto allo scostamento residuo ottenibile.
  soglia: number
  // Nomi dei PAC esclusi dai ragionamenti (params.pacEsclusi, risolti qui una
  // volta sola in nomi): usati da "Note conclusive" a schermo e nel PDF.
  // Viaggia dentro il risultato salvato, così lo storico mostra la nota
  // giusta anche riaprendo una simulazione più vecchia.
  pacEsclusi: string[]
}

export async function simulaPortafoglio(
  supabase: ClientSupabase,
  params: ParametriSimulazionePortafoglio
): Promise<RisultatoSimulazionePortafoglio> {
  const soglia = await leggiSogliaRibilanciamento(supabase)
  const { versamentoMassimo, commissioneVendita: commissioneVenditaStimata, forzaVendita } = params

  const { data: scostamentiPortafoglio } = await supabase
    .from('v_scostamento_target_portafoglio')
    .select('target_id, categoria, target_percentuale, peso_attuale_pct, scostamento_pp')
    .returns<ScostamentoPortafoglio[]>()

  const [{ data: valoriCategoria }, { data: contenitori }, { data: posizioni }, { data: saldi }, { data: targetGruppi }] =
    await Promise.all([
      supabase.from('v_valore_per_categoria').select('categoria, valore_totale'),
      supabase.from('contenitori').select('id, nome, tipo, target_attivo'),
      tutteLeRighe((da, a) =>
        supabase
          .from('v_valore_posizioni_attuale')
          .select('strumento_id, contenitore_id, categoria, quantita_corrente, valore_attuale')
          .order('strumento_id')
          .order('contenitore_id', { nullsFirst: true })
          .range(da, a)
      ),
      supabase.from('v_saldo_liquidita').select('contenitore_id, saldo_corrente'),
      supabase
        .from('target_allocazioni')
        .select('contenitore_id, categoria, target_percentuale')
        .not('contenitore_id', 'is', null)
        .eq('attivo', true),
    ])

  const tipoContenitore = new Map((contenitori ?? []).map((c) => [c.id, c.tipo]))

  // PAC trattati come un portafoglio a parte: invisibili a tutta la
  // simulazione, prima di qualunque altro controllo (toccabile o no) —
  // ortogonale a pacSelezionati/valutaPac. posizioni/saldi grezzi restano
  // disponibili qui sotto solo per calcolare quanto sottrarre da
  // valorePerCategoria (la vista v_valore_per_categoria non conosce
  // l'esclusione); ogni altro uso in questa funzione passa dalle versioni
  // filtrate.
  const pacEsclusiSet = new Set(params.pacEsclusi ?? [])
  const contenitoreEscluso = (contenitoreId: string | null) => contenitoreId !== null && pacEsclusiSet.has(contenitoreId)
  const posizioniPortafoglio = (posizioni ?? []).filter((p) => !contenitoreEscluso(p.contenitore_id))
  const saldiPortafoglio = (saldi ?? []).filter((s) => !contenitoreEscluso(s.contenitore_id))

  const direttaOPolizza = (contenitoreId: string | null) =>
    contenitoreId === null || tipoContenitore.get(contenitoreId) === 'Polizza'
  // Vendibile senza chiedere permesso: diretta, sempre. Un PAC solo se
  // l'utente lo ha esplicitamente indicato nello step 5 del wizard — "toccare"
  // un PAC attivo è un'azione nuova, non automatica come prima.
  const pacSelezionatiSet = new Set(params.valutaPac ? params.pacSelezionati : [])
  const direttaOPacSelezionato = (contenitoreId: string | null) =>
    contenitoreId === null ||
    (tipoContenitore.get(contenitoreId) === 'PAC' && pacSelezionatiSet.has(contenitoreId))

  // Un PAC entra come blocco a forma fissa nel modello di acquisto solo se ha
  // il target attivo e completo. Comprare in un PAC tramite versamento resta
  // sempre automatico: è il normale funzionamento di un piano di accumulo,
  // non un "tocco" a una posizione esistente — solo la vendita richiede
  // l'opt-in dello step 5. Calcolato prima di categorieLibere perché serve
  // anche lì: un PAC senza questa forma valida non ha un rapporto di
  // allocazione da rispettare (vedi pacToccabileSenzaForma sotto).
  const blocchiPac: BloccoPac[] = []
  for (const c of contenitori ?? []) {
    if (c.tipo !== 'PAC' || !c.target_attivo || pacEsclusiSet.has(c.id)) continue
    const righe = (targetGruppi ?? []).filter((r) => r.contenitore_id === c.id)
    const somma = righe.reduce((acc, r) => acc + Number(r.target_percentuale), 0)
    if (Math.abs(somma - 100) > 0.01) continue
    blocchiPac.push({
      id: c.id,
      nome: c.nome,
      forma: Object.fromEntries(righe.map((r) => [r.categoria, Number(r.target_percentuale) / 100])),
    })
  }
  const pacConFormaValidaIds = new Set(blocchiPac.map((k) => k.id))

  // Un PAC toccabile (selezionato al passo 5) ma senza una forma valida non
  // ha un rapporto di allocazione interno da rispettare: le sue categorie
  // sono acquistabili liberamente come una posizione diretta, non "senza
  // veicolo" — a differenza di un PAC con forma valida che semplicemente non
  // copre quella categoria, dove il rapporto dichiarato andrebbe violato e
  // resta "senza veicolo" com'è oggi.
  const pacToccabileSenzaForma = (contenitoreId: string | null) =>
    contenitoreId !== null &&
    tipoContenitore.get(contenitoreId) === 'PAC' &&
    pacSelezionatiSet.has(contenitoreId) &&
    !pacConFormaValidaIds.has(contenitoreId)

  const categorieLibere = new Set(
    posizioniPortafoglio
      .filter(
        (p) =>
          Number(p.quantita_corrente) > 0 &&
          p.categoria &&
          (direttaOPolizza(p.contenitore_id) || pacToccabileSenzaForma(p.contenitore_id))
      )
      .map((p) => p.categoria as string)
  )
  if (saldiPortafoglio.some((s) => direttaOPolizza(s.contenitore_id))) categorieLibere.add('Liquidita')

  // Un PAC escluso è un portafoglio a parte: il suo valore non conta più
  // nella baseline (sottratto sotto da valorePerCategoria), ma se possiede un
  // asset di una categoria, quell'asset resta la prova che un veicolo per
  // quella categoria esiste nell'universo investibile dell'utente — solo non
  // dentro questo PAC. Il sistema può quindi proporre di acquistarne uno
  // indipendente (posizione diretta, fuori dal PAC escluso) per arrivare al
  // target, invece di dichiarare "senza veicolo" com'era prima di questo
  // aggiustamento — l'esclusione toglie l'importo dal conteggio, non la prova
  // che l'asset esiste.
  if (pacEsclusiSet.size > 0) {
    for (const p of posizioni ?? []) {
      if (contenitoreEscluso(p.contenitore_id) && Number(p.quantita_corrente) > 0 && p.categoria) {
        categorieLibere.add(p.categoria)
      }
    }
    if ((saldi ?? []).some((s) => contenitoreEscluso(s.contenitore_id))) categorieLibere.add('Liquidita')
  }

  const targetPortafoglio = new Map(
    (scostamentiPortafoglio ?? []).map((s) => [s.categoria, Number(s.target_percentuale) / 100])
  )
  const valorePerCategoria = new Map((valoriCategoria ?? []).map((v) => [v.categoria, Number(v.valore_totale ?? 0)]))
  // v_valore_per_categoria somma l'intero portafoglio: per un PAC escluso si
  // sottrae qui il suo contributo (valore_attuale delle posizioni, saldo_corrente
  // della liquidità), stessa scomposizione della vista stessa (verificata via
  // pg_get_viewdef) — nessuna modifica allo schema.
  if (pacEsclusiSet.size > 0) {
    for (const p of posizioni ?? []) {
      if (contenitoreEscluso(p.contenitore_id) && p.categoria) {
        valorePerCategoria.set(p.categoria, (valorePerCategoria.get(p.categoria) ?? 0) - Number(p.valore_attuale ?? 0))
      }
    }
    const liquiditaEsclusa = (saldi ?? [])
      .filter((s) => contenitoreEscluso(s.contenitore_id))
      .reduce((acc, s) => acc + Number(s.saldo_corrente ?? 0), 0)
    if (liquiditaEsclusa !== 0) {
      valorePerCategoria.set('Liquidita', (valorePerCategoria.get('Liquidita') ?? 0) - liquiditaEsclusa)
    }
  }
  const categoriePortafoglioBase: CategoriaPortafoglio[] = CATEGORIE.map((categoria) => ({
    categoria,
    valoreAttuale: valorePerCategoria.get(categoria) ?? 0,
    targetPct: targetPortafoglio.get(categoria) ?? null,
    libera: categorieLibere.has(categoria),
  }))

  let categoriePortafoglio = categoriePortafoglioBase
  let risultato = calcolaRibilanciamentoPortafoglio(categoriePortafoglio, blocchiPac, soglia, versamentoMassimo)
  const venditeProposte: EsitoVenditaStrumento[] = []
  const riscattiProposti: EsitoRiscattoPolizza[] = []
  let poolTotale: number | null = null

  // Un tetto al versamento manca in questi due casi apposta: senza tetto il
  // deposito puro (LP1, budget minimo) o è raggiungibile o è irraggiungibile
  // per un vincolo strutturale (nessun veicolo) che né una vendita né un
  // riscatto risolverebbero diversamente da un versamento qualsiasi — vendite
  // e riscatti restano un modo per "completare" un budget limitato, non una
  // fonte di liquidità a sé quando i soldi sono comunque illimitati.
  const necessitaAiuto = versamentoMassimo !== null && risultato.esito !== 'raggiunto'

  if (necessitaAiuto) {
    // necessitaAiuto garantisce versamentoMassimo non nullo: una costante
    // locale tipata number evita che TypeScript continui a vederlo nullable
    // nei calcoli qui sotto.
    const capMassimo = versamentoMassimo as number
    const totaleAttuale = categoriePortafoglio.reduce((acc, c) => acc + c.valoreAttuale, 0)
    const categorieSovrappesate = categoriePortafoglio.filter(
      (c) => c.targetPct !== null && c.valoreAttuale > (c.targetPct + soglia / 100) * totaleAttuale
    )

    if (categorieSovrappesate.length > 0) {
      const { data: posizioniVendibiliRaw } = await supabase
        .from('v_valore_posizioni_attuale')
        .select('strumento_id, contenitore_id, categoria, valore_attuale, prezzo_attuale')
        .in('categoria', categorieSovrappesate.map((c) => c.categoria))
        .returns<PosizionePortafoglioVendibile[]>()

      const posizioniVendibili = (posizioniVendibiliRaw ?? []).filter((p) => direttaOPacSelezionato(p.contenitore_id))
      const strumentoIdsVendibili = posizioniVendibili.map((p) => p.strumento_id)
      const vendutoPerCategoria = new Map<string, number>()

      if (strumentoIdsVendibili.length > 0) {
        const [{ data: strumentiInfo }, { data: lottiRaw }] = await Promise.all([
          supabase.from('strumenti').select('id, nome, ticker, aliquota_tassazione').in('id', strumentoIdsVendibili).returns<StrumentoInfo[]>(),
          supabase
            .from('v_lotti_residui')
            .select('strumento_id, quantita_residua, prezzo_acquisto, commissione_residua, data_acquisto')
            .in('strumento_id', strumentoIdsVendibili)
            .order('data_acquisto', { ascending: true })
            .returns<LottoRaw[]>(),
        ])

        for (const c of categorieSovrappesate) {
          const posizioniCategoria = posizioniVendibili.filter((p) => p.categoria === c.categoria)
          const totaleCategoriaVendibile = posizioniCategoria.reduce((sum, p) => sum + Number(p.valore_attuale), 0)
          const idealeCategoria = Math.min(c.valoreAttuale - (c.targetPct ?? 0) * totaleAttuale, totaleCategoriaVendibile)
          if (totaleCategoriaVendibile <= 0 || idealeCategoria <= 0) continue

          let vendutoCategoria = 0
          for (const p of posizioniCategoria) {
            const info = strumentiInfo?.find((si) => si.id === p.strumento_id)
            if (!info) continue

            const idealeStrumento = idealeCategoria * (Number(p.valore_attuale) / totaleCategoriaVendibile)
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
              true,
              aliquota,
              forzaVendita
            )
            venditeProposte.push(esito)
            vendutoCategoria += esito.valoreVenduto
          }
          vendutoPerCategoria.set(c.categoria, vendutoCategoria)
        }
      }

      const proventoNettoVendite = venditeProposte.reduce((s, v) => s + v.proventoNetto, 0)
      if (proventoNettoVendite > 0) {
        categoriePortafoglio = categoriePortafoglio.map((c) => ({
          ...c,
          valoreAttuale: c.valoreAttuale - (vendutoPerCategoria.get(c.categoria) ?? 0),
        }))
        poolTotale = capMassimo + proventoNettoVendite
        risultato = calcolaRibilanciamentoPortafoglio(categoriePortafoglio, blocchiPac, soglia, poolTotale)
      }
    }

    // Riscatto di un'intera Polizza: fonte di liquidità aggiuntiva, valutata
    // solo se ancora fuori soglia dopo deposito ed eventuali vendite.
    if (params.valutaRiscattoPolizza && risultato.esito !== 'raggiunto') {
      const polizze = (contenitori ?? []).filter((c) => c.tipo === 'Polizza')

      if (params.modoRiscattoPolizza === 'manuale') {
        const daRiscattare = polizze.filter((p) => params.polizzeSelezionate.includes(p.id))
        if (daRiscattare.length > 0) {
          const { data: valoriPerCategoriaPolizze } = await supabase
            .from('v_valore_posizioni_attuale')
            .select('contenitore_id, categoria, valore_attuale')
            .in('contenitore_id', daRiscattare.map((p) => p.id))

          const esiti = (
            await Promise.all(
              daRiscattare.map((p) => calcolaRiscattoPolizza(supabase, p.id, p.nome, commissioneVenditaStimata))
            )
          ).filter((e): e is EsitoRiscattoPolizza => e !== null)

          riscattiProposti.push(...esiti)
          const proventoNettoRiscatti = esiti.reduce((s, e) => s + e.proventoNetto, 0)

          if (proventoNettoRiscatti !== 0) {
            for (const riga of valoriPerCategoriaPolizze ?? []) {
              categoriePortafoglio = categoriePortafoglio.map((c) =>
                c.categoria === riga.categoria ? { ...c, valoreAttuale: c.valoreAttuale - Number(riga.valore_attuale) } : c
              )
            }
            poolTotale = (poolTotale ?? capMassimo) + proventoNettoRiscatti
            risultato = calcolaRibilanciamentoPortafoglio(categoriePortafoglio, blocchiPac, soglia, poolTotale)
          }
        }
      } else {
        // Automatico: riscatta, una alla volta, la Polizza col rapporto
        // tassa/valore più basso (la più "conveniente" da smobilizzare),
        // fino a rientrare in soglia o a esaurire le Polizze disponibili.
        const candidate = (
          await Promise.all(polizze.map((p) => calcolaRiscattoPolizza(supabase, p.id, p.nome, commissioneVenditaStimata)))
        ).filter((e): e is EsitoRiscattoPolizza => e !== null && e.valoreAttuale > 0)
        candidate.sort((a, b) => a.tassa / a.valoreAttuale - b.tassa / b.valoreAttuale)

        for (const candidato of candidate) {
          if (risultato.esito === 'raggiunto') break

          const { data: valoriPerCategoriaPolizza } = await supabase
            .from('v_valore_posizioni_attuale')
            .select('categoria, valore_attuale')
            .eq('contenitore_id', candidato.contenitoreId)

          riscattiProposti.push(candidato)
          for (const riga of valoriPerCategoriaPolizza ?? []) {
            categoriePortafoglio = categoriePortafoglio.map((c) =>
              c.categoria === riga.categoria ? { ...c, valoreAttuale: c.valoreAttuale - Number(riga.valore_attuale) } : c
            )
          }
          poolTotale = (poolTotale ?? capMassimo) + candidato.proventoNetto
          risultato = calcolaRibilanciamentoPortafoglio(categoriePortafoglio, blocchiPac, soglia, poolTotale)
        }
      }
    }
  }

  // Limite strutturale: anche con un versamento enorme lo scostamento non
  // scenderebbe oltre una certa soglia (forma fissa di un PAC, per esempio).
  let avvisoStrutturale: AvvisoStrutturale | null = null
  if (risultato.esito === 'residuo') {
    const totaleFinale = categoriePortafoglio.reduce((acc, c) => acc + c.valoreAttuale, 0)
    const versamentoIllimitato = Math.max(1e10, totaleFinale * 1e6)
    const risultatoIllimitato = calcolaRibilanciamentoPortafoglio(categoriePortafoglio, blocchiPac, soglia, versamentoIllimitato)
    if (risultatoIllimitato.esito === 'residuo') {
      const floorPp = risultatoIllimitato.soluzione.scostamentoMassimoPp
      const categorieAlFloor = risultatoIllimitato.soluzione.righe
        .filter((r) => r.scostamentoFinalePp !== null && Math.abs(Math.abs(r.scostamentoFinalePp) - floorPp) <= 0.05)
        .map((r) => r.categoria)
      const alternative = calcolaAlternativeStrutturali(
        categoriePortafoglio,
        blocchiPac,
        soglia,
        categorieAlFloor,
        risultatoIllimitato.soluzione
      )
      const causaPac = blocchiPac
        .map((k) => ({
          pacNome: k.nome,
          categorie: categorieAlFloor.filter((categoria) => (k.forma[categoria] ?? 0) > 0),
        }))
        .filter((g) => g.categorie.length > 0)
      const valorePerCategoriaAttuale = new Map(categoriePortafoglio.map((c) => [c.categoria, c.valoreAttuale]))
      const senzaVeicoloConAsset = risultato.senzaVeicolo.filter(
        (categoria) => (valorePerCategoriaAttuale.get(categoria) ?? 0) > 0.01
      )
      avvisoStrutturale = { floorPp, categorie: categorieAlFloor, causaPac, senzaVeicoloConAsset, alternative }
    }
  }

  const pacEsclusiNomi = (contenitori ?? []).filter((c) => pacEsclusiSet.has(c.id)).map((c) => c.nome)

  return {
    risultato,
    venditeProposte,
    riscattiProposti,
    poolTotale,
    versamentoMassimo: poolTotale !== null ? null : versamentoMassimo,
    avvisoStrutturale,
    soglia,
    pacEsclusi: pacEsclusiNomi,
  }
}

// --- Simulazione per singolo gruppo ---

export type ParametriSimulazioneGruppo = {
  contenitoreId: string
  versamentoMassimo: number | null
  commissioneVendita: number
  forzaVendita: boolean
}

type RisultatoSimulazioneGruppoDati = {
  contenitoreId: string
  necessario: number
  versamentoUsato: number
  sufficiente: boolean
  allocazioneAcquisto: RigaAllocazione[]
  venditeProposte: EsitoVenditaStrumento[]
  poolTotale: number
  allocazioneStrumenti: {
    categoria: string
    usaTarget: boolean
    strumenti: { nome: string; ticker: string | null; importo: number }[]
  }[]
}

export type RisultatoSimulazioneGruppo = RisultatoSimulazioneGruppoDati | null

export async function simulaGruppo(
  supabase: ClientSupabase,
  params: ParametriSimulazioneGruppo
): Promise<RisultatoSimulazioneGruppo> {
  const soglia = await leggiSogliaRibilanciamento(supabase)
  const { contenitoreId, versamentoMassimo, commissioneVendita: commissioneVenditaStimata, forzaVendita } = params

  const { data: scostamenti } = await supabase.from('v_scostamento_target').select('*').returns<Scostamento[]>()
  const comparti = (scostamenti ?? []).filter((s) => s.contenitore_id === contenitoreId)
  if (comparti.length === 0) return null

  const contenitoreTipo = comparti[0].contenitore_tipo
  const valoreTotaleAttuale = comparti[0].valore_contenitore_totale

  const compartiInput: CompartoTarget[] = comparti.map((c) => ({
    categoria: c.categoria,
    valoreAttuale: c.valore_categoria,
    targetPct: c.target_percentuale / 100,
  }))

  const budgetMassimoIpotesi = Math.max(versamentoMassimo ?? 0, valoreTotaleAttuale * 20, 1000)
  const risultatoPuro = calcolaRibilanciamentoConVersamento(compartiInput, valoreTotaleAttuale, soglia, budgetMassimoIpotesi)
  const necessario = risultatoPuro.budgetNecessario

  // Nessuna soglia impostata: nessun tetto al versamento, quindi si versa
  // esattamente il necessario e non serve vendere nulla (coerente con
  // l'assenza di tetto a livello di portafoglio: budget minimo, mai vendite).
  const versamentoUsato = versamentoMassimo ?? necessario
  const sufficiente = versamentoMassimo === null || versamentoUsato >= necessario

  let allocazioneAcquisto: RigaAllocazione[] = []
  const venditeProposte: EsitoVenditaStrumento[] = []
  let poolTotale = 0

  if (sufficiente) {
    allocazioneAcquisto = distribuisciAcquisto(compartiInput, valoreTotaleAttuale, versamentoUsato)
    poolTotale = versamentoUsato
  } else {
    const comportiSovrappesati = comparti.filter((c) => c.valore_categoria > (c.target_percentuale / 100) * valoreTotaleAttuale)
    const idealeSellPerCategoria = new Map<string, number>()
    for (const c of comportiSovrappesati) {
      idealeSellPerCategoria.set(c.categoria, c.valore_categoria - (c.target_percentuale / 100) * valoreTotaleAttuale)
    }

    const vendutoPerCategoria = new Map<string, number>()

    if (comportiSovrappesati.length > 0) {
      const { data: posizioniRaw } = await supabase
        .from('v_valore_posizioni_attuale')
        .select('strumento_id, categoria, valore_attuale, prezzo_attuale')
        .eq('contenitore_id', contenitoreId)
        .in('categoria', comportiSovrappesati.map((c) => c.categoria))
        .returns<PosizioneVendibile[]>()

      const posizioni = posizioniRaw ?? []
      const strumentoIds = posizioni.map((p) => p.strumento_id)

      const [{ data: strumentiInfo }, { data: lottiRaw }] = await Promise.all([
        supabase.from('strumenti').select('id, nome, ticker, aliquota_tassazione').in('id', strumentoIds).returns<StrumentoInfo[]>(),
        supabase
          .from('v_lotti_residui')
          .select('strumento_id, quantita_residua, prezzo_acquisto, commissione_residua, data_acquisto')
          .eq('contenitore_id', contenitoreId)
          .in('strumento_id', strumentoIds)
          .order('data_acquisto', { ascending: true })
          .returns<LottoRaw[]>(),
      ])

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
    poolTotale = versamentoUsato + proventoNettoTotale

    const compartiPostVendita: CompartoTarget[] = compartiInput.map((c) => ({
      categoria: c.categoria,
      valoreAttuale: c.valoreAttuale - (vendutoPerCategoria.get(c.categoria) ?? 0),
      targetPct: c.targetPct,
    }))
    const totaleAttualePostVendita = valoreTotaleAttuale - Array.from(vendutoPerCategoria.values()).reduce((a, b) => a + b, 0)

    allocazioneAcquisto = distribuisciAcquisto(compartiPostVendita, totaleAttualePostVendita, poolTotale)
  }

  const allocazioneStrumenti: RisultatoSimulazioneGruppoDati['allocazioneStrumenti'] = []

  for (const a of allocazioneAcquisto.filter((r) => r.importo > 0)) {
    const { data: posizioni } = await supabase
      .from('v_valore_posizioni_attuale')
      .select('strumento_id, valore_attuale')
      .eq('contenitore_id', contenitoreId)
      .eq('categoria', a.categoria)
      .returns<{ strumento_id: string; valore_attuale: number }[]>()

    const righe = posizioni ?? []
    const totaleCategoria = righe.reduce((sum, r) => sum + Number(r.valore_attuale), 0)

    if (totaleCategoria > 0) {
      const [{ data: strumentiInfo }, { data: subTargetRaw }] = await Promise.all([
        supabase.from('strumenti').select('id, nome, ticker').in('id', righe.map((r) => r.strumento_id)),
        supabase
          .from('target_allocazioni_strumento')
          .select('strumento_id, target_percentuale_categoria')
          .eq('contenitore_id', contenitoreId)
          .in('strumento_id', righe.map((r) => r.strumento_id))
          .returns<SubTargetRaw[]>(),
      ])

      const subTargetMap = new Map((subTargetRaw ?? []).map((t) => [t.strumento_id, Number(t.target_percentuale_categoria)]))
      const sommaSubTarget = righe.reduce((sum, r) => sum + (subTargetMap.get(r.strumento_id) ?? 0), 0)
      const subTargetValidi =
        righe.length > 1 && righe.every((r) => subTargetMap.has(r.strumento_id)) && Math.abs(sommaSubTarget - 100) < 0.01

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
          righe.map((r) => [r.strumento_id, Math.round((Number(r.valore_attuale) / totaleCategoria) * a.importo * 100) / 100])
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

  return {
    contenitoreId,
    necessario,
    versamentoUsato,
    sufficiente,
    allocazioneAcquisto,
    venditeProposte,
    poolTotale,
    allocazioneStrumenti,
  }
}
