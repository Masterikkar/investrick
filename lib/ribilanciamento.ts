// Calcoli puri per il tool di ribilanciamento — nessuna dipendenza da Supabase, testabili in isolamento.

import { solve, type Constraint, type Coefficients } from 'yalps'

export type CompartoTarget = {
  categoria: string
  valoreAttuale: number
  targetPct: number // frazione, es. 0.65 per 65%
}

export type RigaAllocazione = {
  categoria: string
  importo: number
  valoreFinale: number
  pesoFinalePct: number
  scostamentoFinalePp: number
}

export type RisultatoRibilanciamento = {
  budgetNecessario: number
  sufficiente: boolean
  allocazione: RigaAllocazione[]
}

/** Distribuisce un budget di acquisto tra i comparti, senza mai comprare un comparto già a target o sopra. */
export function distribuisciAcquisto(
  comparti: CompartoTarget[],
  valoreTotaleAttuale: number,
  budget: number
): RigaAllocazione[] {
  const totaleFinale = valoreTotaleAttuale + budget
  const gap = comparti.map((c) => Math.max(0, c.targetPct * totaleFinale - c.valoreAttuale))
  const gapTotale = gap.reduce((a, b) => a + b, 0)

  return comparti.map((c, i) => {
    const importo = gapTotale > 0 ? (gap[i] / gapTotale) * budget : 0
    const valoreFinale = c.valoreAttuale + importo
    const pesoFinale = totaleFinale > 0 ? valoreFinale / totaleFinale : 0
    const scostamentoFinale = pesoFinale - c.targetPct
    return {
      categoria: c.categoria,
      importo: Math.round(importo * 100) / 100,
      valoreFinale,
      pesoFinalePct: Math.round(pesoFinale * 10000) / 100,
      scostamentoFinalePp: Math.round(scostamentoFinale * 10000) / 100,
    }
  })
}

function deviazioneMassima(righe: RigaAllocazione[]) {
  return Math.max(...righe.map((r) => Math.abs(r.scostamentoFinalePp / 100)))
}

/** Trova il budget minimo (comprando soltanto) che riporta tutti i comparti entro soglia. */
export function calcolaRibilanciamentoConVersamento(
  comparti: CompartoTarget[],
  valoreTotaleAttuale: number,
  sogliaPp: number,
  budgetMassimo: number
): RisultatoRibilanciamento {
  const soglia = sogliaPp / 100

  let low = 0
  let high = Math.max(budgetMassimo, valoreTotaleAttuale * 20, 1000)
  let budgetNecessario = high

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2
    const righe = distribuisciAcquisto(comparti, valoreTotaleAttuale, mid)
    if (deviazioneMassima(righe) <= soglia) {
      budgetNecessario = mid
      high = mid
    } else {
      low = mid
    }
  }

  budgetNecessario = Math.ceil(budgetNecessario * 100) / 100
  const sufficiente = budgetNecessario <= budgetMassimo
  const budgetDaUsare = sufficiente ? budgetNecessario : budgetMassimo
  const allocazione = distribuisciAcquisto(comparti, valoreTotaleAttuale, budgetDaUsare)

  return { budgetNecessario, sufficiente, allocazione }
}

// --- Scenario B: vendita simulata con vincolo "mai minusvalenza netta" ---

export type LottoResiduo = {
  quantitaResidua: number
  prezzoAcquisto: number
  commissioneResidua: number // già prorata alla quantità residua, come da v_lotti_residui
}

export type EsitoVenditaStrumento = {
  strumentoId: string
  nome: string
  quantitaIdeale: number
  quantitaVenduta: number
  valoreVenduto: number
  plusvalenzaLorda: number
  imponibile: boolean
  aliquota: number
  tassa: number
  proventoNetto: number
  vincoloRispettato: boolean
}

/** Aliquota diretta dello strumento (aliquota_tassazione, in punti percentuali) convertita in frazione. */
export function aliquotaPerStrumento(s: { aliquotaTassazione: number }): number {
  return s.aliquotaTassazione / 100
}

/**
 * Simula la vendita FIFO (dal lotto più vecchio) di una quantità ideale di uno strumento.
 * Replica esattamente la formula di calcola_fifo_posizione (commissioni sottratte, tassa
 * trattenuta esclusa dal calcolo della plusvalenza).
 * Se la plus/minusvalenza sull'intera quantità ideale è negativa, riduce la quantità venduta
 * partendo dalla coda (i lotti inclusi più di recente) finché il cumulato torna >= 0.
 * Con forzaVendita=true ignora il vincolo e vende comunque tutta la quantità ideale.
 */
export function simulaVenditaStrumento(
  strumentoId: string,
  nome: string,
  lottiOrdinatiDalPiuVecchio: LottoResiduo[],
  quantitaIdeale: number,
  prezzoAttuale: number,
  commissioneVenditaStimata: number,
  imponibile: boolean,
  aliquota: number,
  forzaVendita: boolean
): EsitoVenditaStrumento {
  const quantitaDisponibile = lottiOrdinatiDalPiuVecchio.reduce((s, l) => s + l.quantitaResidua, 0)
  const quantitaTarget = Math.min(quantitaIdeale, quantitaDisponibile)

  const calcolaPlusvalenza = (quantita: number) => {
    let residuo = quantita
    let plusvalenza = 0
    for (const lotto of lottiOrdinatiDalPiuVecchio) {
      if (residuo <= 0) break
      const daLotto = Math.min(residuo, lotto.quantitaResidua)
      const commissioneAcquistoQuota =
        lotto.quantitaResidua > 0 ? (lotto.commissioneResidua / lotto.quantitaResidua) * daLotto : 0
      const commissioneVenditaQuota = quantita > 0 ? (commissioneVenditaStimata / quantita) * daLotto : 0
      plusvalenza +=
        daLotto * (prezzoAttuale - lotto.prezzoAcquisto) - commissioneAcquistoQuota - commissioneVenditaQuota
      residuo -= daLotto
    }
    return plusvalenza
  }

  let quantita = quantitaTarget
  let plusvalenza = calcolaPlusvalenza(quantita)
  let vincoloRispettato = true

  if (!forzaVendita && plusvalenza < 0 && quantitaTarget > 0) {
    vincoloRispettato = false
    const passo = quantitaTarget / 200
    while (quantita > 0 && plusvalenza < 0) {
      quantita = Math.max(0, quantita - passo)
      plusvalenza = calcolaPlusvalenza(quantita)
    }
  }

  const valoreVenduto = quantita * prezzoAttuale
  const tassa = imponibile ? Math.max(0, plusvalenza) * aliquota : 0

  return {
    strumentoId,
    nome,
    quantitaIdeale: Math.round(quantitaIdeale * 1e6) / 1e6,
    quantitaVenduta: Math.round(quantita * 1e6) / 1e6,
    valoreVenduto: Math.round(valoreVenduto * 100) / 100,
    plusvalenzaLorda: Math.round(plusvalenza * 100) / 100,
    imponibile,
    aliquota,
    tassa: Math.round(tassa * 100) / 100,
    proventoNetto: Math.round((valoreVenduto - tassa) * 100) / 100,
    vincoloRispettato,
  }
}

// --- Portafoglio intero: versamento minimo con i PAC come blocchi a forma fissa ---
//
// Un programma lineare (yalps) trova il versamento minimo B che porta entro
// soglia tutte le categorie con un target sul portafoglio. Le variabili sono:
// - B, il versamento;
// - P_k, quanto va nel PAC k: entra in ogni categoria nelle proporzioni del
//   suo target interno p^(k), perché correggere l'equilibrio interno di un
//   PAC richiederebbe una vendita (evento fiscale);
// - F_i, quanto si compra liberamente nella categoria i: solo per le
//   categorie con target in cui esiste già una posizione diretta o in Polizza.
// Con W = T + B, la banda di una categoria (t − s)·W ≤ X_i ≤ (t + s)·W resta
// lineare, perché t e s sono dati: W compare solo moltiplicato per costanti.

export type CategoriaPortafoglio = {
  categoria: string
  valoreAttuale: number
  targetPct: number | null // frazione (0,55 per 55%); null = nessun target attivo, nessun vincolo
  libera: boolean // esiste già una posizione diretta o in una Polizza in questa categoria
}

export type BloccoPac = {
  id: string
  nome: string
  forma: Record<string, number> // target interno del PAC per categoria, in frazioni che sommano a 1
}

export type RigaSoluzionePortafoglio = {
  categoria: string
  targetPct: number | null // in punti percentuali
  valoreAttuale: number
  acquisto: number // dai PAC più gli acquisti liberi
  valoreFinale: number
  pesoFinalePct: number
  scostamentoFinalePp: number | null
}

export type SoluzionePortafoglio = {
  versamento: number
  pac: { id: string; nome: string; importo: number }[]
  libere: { categoria: string; importo: number }[]
  righe: RigaSoluzionePortafoglio[]
  scostamentoMassimoPp: number // sulle categorie vincolate
}

export type RisultatoPortafoglio =
  | {
      esito: 'raggiunto'
      budgetMinimo: number
      // null quando senza PAC la soglia non si raggiunge con lo stesso budget
      // (una categoria si compra solo tramite un PAC), o quando non ci sono PAC.
      soloLibere: SoluzionePortafoglio | null
      massimoPac: SoluzionePortafoglio | null
      coincidono: boolean
      senzaVeicolo: string[]
    }
  | { esito: 'residuo'; soluzione: SoluzionePortafoglio; senzaVeicolo: string[] }
  | { esito: 'irraggiungibile'; senzaVeicolo: string[] }

// Margine sui vincoli B ≤ B* e ΣP ≥ Π* negli LP successivi al primo, per
// l'aritmetica in virgola mobile. Deve restare piccolo: un margine di mezzo
// centesimo lascia ai PAC budget in più e porta una categoria appena oltre la
// soglia.
const TOLLERANZA_BUDGET = 1e-6
const TOLLERANZA_COINCIDENZA = 0.01

/**
 * Divide R tra le categorie libere portando tutte quelle sottopesate allo stesso
 * scostamento λ (livellamento): F_i = max(0, (t_i + λ)·W − base_i), con λ tale
 * che ΣF = R. Minimizza lo scostamento massimo, a differenza del riparto
 * proporzionale al gap.
 */
export function livella(
  base: Map<string, number>,
  W: number,
  R: number,
  libere: { categoria: string; targetPct: number }[]
): Map<string, number> {
  const F = new Map(libere.map((c) => [c.categoria, 0]))
  if (R <= 0 || libere.length === 0 || W <= 0) return F

  const scarto = (c: { categoria: string; targetPct: number }) => (base.get(c.categoria) ?? 0) / W - c.targetPct
  const somma = (lambda: number) =>
    libere.reduce((acc, c) => acc + Math.max(0, (c.targetPct + lambda) * W - (base.get(c.categoria) ?? 0)), 0)

  // somma(lo) = 0 e somma(hi) ≥ R: ogni termine a hi vale almeno R.
  let lo = Math.min(...libere.map(scarto))
  let hi = Math.max(...libere.map(scarto)) + R / W
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (somma(mid) >= R) hi = mid
    else lo = mid
  }

  const totale = somma(hi)
  for (const c of libere) {
    const f = Math.max(0, (c.targetPct + hi) * W - (base.get(c.categoria) ?? 0))
    F.set(c.categoria, totale > 0 ? (f / totale) * R : 0)
  }
  return F
}

export function calcolaRibilanciamentoPortafoglio(
  categorie: CategoriaPortafoglio[],
  pac: BloccoPac[],
  sogliaPp: number,
  versamentoMassimo: number | null
): RisultatoPortafoglio {
  const s = sogliaPp / 100
  const T = categorie.reduce((acc, c) => acc + c.valoreAttuale, 0)
  const quota = (k: BloccoPac, categoria: string) => k.forma[categoria] ?? 0

  // Una categoria con target si può muovere solo se è libera o se un PAC la
  // contiene; le altre (senza veicolo) cambiano solo per diluizione e restano
  // fuori dai vincoli.
  const vincolate = categorie.filter(
    (c): c is CategoriaPortafoglio & { targetPct: number } =>
      c.targetPct !== null && (c.libera || pac.some((k) => quota(k, c.categoria) > 0))
  )
  const senzaVeicolo = categorie
    .filter((c) => c.targetPct !== null && !vincolate.some((v) => v.categoria === c.categoria))
    .map((c) => c.categoria)
  const libere = vincolate.filter((c) => c.libera)

  const chiaveP = (k: BloccoPac) => `P:${k.id}`
  const chiaveF = (categoria: string) => `F:${categoria}`

  // Modello a budget variabile (LP1, LP2 e gli estremi per PAC).
  const vincoliBase = (): Map<string, Constraint> => {
    const vincoli = new Map<string, Constraint>([['allocazione', { equal: 0 }]])
    for (const c of vincolate) {
      vincoli.set(`alta:${c.categoria}`, { max: (c.targetPct + s) * T - c.valoreAttuale })
      if (c.targetPct - s > 0) vincoli.set(`bassa:${c.categoria}`, { min: (c.targetPct - s) * T - c.valoreAttuale })
    }
    if (versamentoMassimo !== null) vincoli.set('tetto', { max: versamentoMassimo })
    return vincoli
  }

  const variabiliBase = (): Map<string, Record<string, number>> => {
    const variabili = new Map<string, Record<string, number>>()
    const b: Record<string, number> = { budget: 1, allocazione: 1, tetto: 1 }
    for (const c of vincolate) {
      b[`alta:${c.categoria}`] = -(c.targetPct + s)
      b[`bassa:${c.categoria}`] = -(c.targetPct - s)
    }
    variabili.set('B', b)
    for (const k of pac) {
      const coeff: Record<string, number> = { allocazione: -1, sommaPac: 1, [chiaveP(k)]: 1 }
      for (const c of vincolate) {
        const p = quota(k, c.categoria)
        if (p > 0) {
          coeff[`alta:${c.categoria}`] = p
          coeff[`bassa:${c.categoria}`] = p
        }
      }
      variabili.set(chiaveP(k), coeff)
    }
    for (const c of libere) {
      variabili.set(chiaveF(c.categoria), {
        allocazione: -1,
        [`alta:${c.categoria}`]: 1,
        [`bassa:${c.categoria}`]: 1,
      })
    }
    return variabili
  }

  const risolvi = (
    direzione: 'minimize' | 'maximize',
    obiettivo: string,
    vincoli: Map<string, Constraint>,
    variabili: Map<string, Coefficients>
  ) => {
    const soluzione = solve({ direction: direzione, objective: obiettivo, constraints: vincoli, variables: variabili })
    if (soluzione.status !== 'optimal') return null
    return { valore: soluzione.result, variabili: new Map(soluzione.variables) }
  }

  // Valuta una divisione: valori finali, pesi e scostamenti per categoria.
  const valuta = (importiPac: Map<string, number>, importiLiberi: Map<string, number>): SoluzionePortafoglio => {
    const versamento =
      [...importiPac.values()].reduce((a, b) => a + b, 0) + [...importiLiberi.values()].reduce((a, b) => a + b, 0)
    const W = T + versamento
    const righe = categorie.map((c) => {
      const acquisto =
        pac.reduce((acc, k) => acc + quota(k, c.categoria) * (importiPac.get(k.id) ?? 0), 0) +
        (importiLiberi.get(c.categoria) ?? 0)
      const valoreFinale = c.valoreAttuale + acquisto
      const peso = W > 0 ? valoreFinale / W : 0
      return {
        categoria: c.categoria,
        targetPct: c.targetPct === null ? null : c.targetPct * 100,
        valoreAttuale: c.valoreAttuale,
        acquisto,
        valoreFinale,
        pesoFinalePct: peso * 100,
        scostamentoFinalePp: c.targetPct === null ? null : (peso - c.targetPct) * 100,
      }
    })
    const scostamentoMassimoPp = Math.max(
      0,
      ...righe
        .filter((r) => vincolate.some((v) => v.categoria === r.categoria))
        .map((r) => Math.abs(r.scostamentoFinalePp ?? 0))
    )
    return {
      versamento,
      pac: pac.map((k) => ({ id: k.id, nome: k.nome, importo: importiPac.get(k.id) ?? 0 })),
      libere: libere.map((c) => ({ categoria: c.categoria, importo: importiLiberi.get(c.categoria) ?? 0 })),
      righe,
      scostamentoMassimoPp,
    }
  }

  // Dati gli importi nei PAC, il resto del versamento va alle categorie libere col livellamento.
  const completa = (importiPac: Map<string, number>, versamento: number): SoluzionePortafoglio => {
    const base = new Map(
      categorie.map((c) => [
        c.categoria,
        c.valoreAttuale + pac.reduce((acc, k) => acc + quota(k, c.categoria) * (importiPac.get(k.id) ?? 0), 0),
      ])
    )
    const residuo = Math.max(0, versamento - [...importiPac.values()].reduce((a, b) => a + b, 0))
    return valuta(importiPac, livella(base, T + versamento, residuo, libere))
  }

  // LP1: versamento minimo.
  const lp1 = risolvi('minimize', 'budget', vincoliBase(), variabiliBase())

  if (!lp1) {
    if (versamentoMassimo === null) return { esito: 'irraggiungibile', senzaVeicolo }

    // Budget fisso a versamentoMassimo: minimizza lo scostamento massimo d.
    // Con W costante, |X_i − t_i·W| ≤ d·W è lineare in d.
    const W = T + versamentoMassimo
    const vincoli = new Map<string, Constraint>([['allocazione', { equal: versamentoMassimo }]])
    const variabili = new Map<string, Record<string, number>>()
    const d: Record<string, number> = { scostamento: 1 }
    for (const c of vincolate) {
      vincoli.set(`alta:${c.categoria}`, { max: c.targetPct * W - c.valoreAttuale })
      vincoli.set(`bassa:${c.categoria}`, { min: c.targetPct * W - c.valoreAttuale })
      d[`alta:${c.categoria}`] = -W
      d[`bassa:${c.categoria}`] = W
    }
    variabili.set('d', d)
    for (const k of pac) {
      const coeff: Record<string, number> = { allocazione: 1 }
      for (const c of vincolate) {
        const p = quota(k, c.categoria)
        if (p > 0) {
          coeff[`alta:${c.categoria}`] = p
          coeff[`bassa:${c.categoria}`] = p
        }
      }
      variabili.set(chiaveP(k), coeff)
    }
    for (const c of libere) {
      variabili.set(chiaveF(c.categoria), { allocazione: 1, [`alta:${c.categoria}`]: 1, [`bassa:${c.categoria}`]: 1 })
    }
    const lpResiduo = risolvi('minimize', 'scostamento', vincoli, variabili)
    if (!lpResiduo) return { esito: 'irraggiungibile', senzaVeicolo }

    const importiPac = new Map(pac.map((k) => [k.id, lpResiduo.variabili.get(chiaveP(k)) ?? 0]))
    return { esito: 'residuo', soluzione: completa(importiPac, versamentoMassimo), senzaVeicolo }
  }

  const budgetMinimo = lp1.variabili.get('B') ?? 0

  // "Solo acquisti liberi": nessun PAC, tutto col livellamento. Il livellamento
  // minimizza lo scostamento massimo, quindi se non sta nella soglia non ci sta
  // nessun'altra divisione senza PAC: la scheda non esiste.
  const soloLibereCandidata = completa(new Map(pac.map((k) => [k.id, 0])), budgetMinimo)
  const soloLibere = soloLibereCandidata.scostamentoMassimoPp <= sogliaPp + 1e-6 ? soloLibereCandidata : null

  // "Massimo nei PAC": LP2 massimizza ΣP_k a budget B*, poi per ogni PAC il
  // minimo e il massimo di P_k a ΣP = Π*; la media dei 2·|K| punti sta ancora
  // sulla faccia ottima, che è convessa.
  let massimoPac: SoluzionePortafoglio | null = null
  if (pac.length > 0) {
    const conBudget = () => {
      const v = vincoliBase()
      v.set('budget', { max: budgetMinimo + TOLLERANZA_BUDGET })
      return v
    }
    const lp2 = risolvi('maximize', 'sommaPac', conBudget(), variabiliBase())
    if (lp2) {
      const pigrecoStella = lp2.valore
      const punti: Map<string, number>[] = []
      for (const k of pac) {
        for (const direzione of ['minimize', 'maximize'] as const) {
          const v = conBudget()
          v.set('sommaPac', { min: pigrecoStella - TOLLERANZA_BUDGET })
          const lp = risolvi(direzione, chiaveP(k), v, variabiliBase())
          if (lp) punti.push(new Map(pac.map((j) => [j.id, lp.variabili.get(chiaveP(j)) ?? 0])))
        }
      }
      if (punti.length > 0) {
        const media = new Map(
          pac.map((k) => [k.id, punti.reduce((acc, p) => acc + (p.get(k.id) ?? 0), 0) / punti.length])
        )
        massimoPac = completa(media, budgetMinimo)
      }
    }
  }

  const coincidono =
    soloLibere === null ||
    massimoPac === null ||
    (soloLibere.pac.every((p, i) => Math.abs(p.importo - massimoPac!.pac[i].importo) <= TOLLERANZA_COINCIDENZA) &&
      soloLibere.libere.every((f, i) => Math.abs(f.importo - massimoPac!.libere[i].importo) <= TOLLERANZA_COINCIDENZA))

  return { esito: 'raggiunto', budgetMinimo, soloLibere, massimoPac, coincidono, senzaVeicolo }
}
