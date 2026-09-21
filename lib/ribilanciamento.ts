// Calcoli puri per il tool di ribilanciamento — nessuna dipendenza da Supabase, testabili in isolamento.

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
