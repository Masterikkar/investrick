import { SSF, utils, type WorkSheet } from 'xlsx'
import { componiDataIso, giorniNelMese, partiDataIso } from '@/lib/data-calendario'

// Date lette da un file Excel (import) e scritte in un file Excel (export),
// senza mai passare da un fuso orario: vedi lib/data-calendario.ts.

/**
 * Valore di una cella "Data" letta da SheetJS → YYYY-MM-DD, o null.
 * - numero seriale Excel (lettura senza cellDates): anno/mese/giorno con
 *   SSF.parse_date_code, senza creare un Date;
 * - oggetto Date (se mai arrivasse): getFullYear/getMonth/getDate locali, che
 *   sono quelli con cui SheetJS lo costruisce;
 * - testo "gg/mm/aaaa": i tre numeri letti a mano e controllati.
 * date1904: il file usa il sistema di date 1904 (vecchi Excel per Mac).
 */
export function dataIsoDaCellaExcel(valore: unknown, date1904 = false): string | null {
  if (typeof valore === 'number') {
    if (!Number.isFinite(valore) || valore < 1) return null
    const parti = SSF.parse_date_code(valore, { date1904 }) as { y: number; m: number; d: number } | null
    return parti ? componiDataIso(parti.y, parti.m, parti.d) : null
  }
  if (valore instanceof Date) {
    if (Number.isNaN(valore.getTime())) return null
    return componiDataIso(valore.getFullYear(), valore.getMonth() + 1, valore.getDate())
  }
  const testo = String(valore ?? '').trim()
  const m = testo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const giorno = Number(m[1])
  const mese = Number(m[2])
  const anno = Number(m[3])
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > giorniNelMese(anno, mese)) return null
  return componiDataIso(anno, mese, giorno)
}

// Giorni dal 1970-01-01 per una data del calendario gregoriano, in aritmetica
// intera (algoritmo "days from civil" di H. Hinnant): nessun Date coinvolto.
function giorniDaEpoca(anno: number, mese: number, giorno: number): number {
  const a = mese <= 2 ? anno - 1 : anno
  const era = Math.floor(a / 400)
  const annoEra = a - era * 400
  const giornoAnno = Math.floor((153 * (mese + (mese > 2 ? -3 : 9)) + 2) / 5) + giorno - 1
  const giornoEra = annoEra * 365 + Math.floor(annoEra / 4) - Math.floor(annoEra / 100) + giornoAnno
  return era * 146097 + giornoEra - 719468
}

// Il seriale Excel 25569 è il 1970-01-01 (sistema 1900, valido dal 1° marzo 1900).
const SERIALE_EXCEL_1970 = 25569

/** YYYY-MM-DD → numero seriale Excel intero, per scrivere una cella data nell'export. */
export function serialeExcelDaDataIso(iso: string): number | null {
  const parti = partiDataIso(iso)
  if (!parti) return null
  return giorniDaEpoca(parti.anno, parti.mese, parti.giorno) + SERIALE_EXCEL_1970
}

/** Formato delle celle data scritte nell'export. */
export const FORMATO_DATA_EXCEL = 'dd/mm/yyyy'

/**
 * Nella colonna con questa intestazione, trasforma le date YYYY-MM-DD scritte
 * da json_to_sheet in vere celle data: il seriale Excel intero e il formato
 * gg/mm/aaaa. Un Date passato a json_to_sheet verrebbe invece convertito con
 * il fuso del browser (in Italia con un'ora nascosta, a ovest di Greenwich
 * nel giorno prima).
 */
export function scriviColonnaDateExcel(ws: WorkSheet, intestazione: string): void {
  if (!ws['!ref']) return
  const area = utils.decode_range(ws['!ref'])
  let colonna = -1
  for (let c = area.s.c; c <= area.e.c; c++) {
    if (ws[utils.encode_cell({ r: area.s.r, c })]?.v === intestazione) colonna = c
  }
  if (colonna < 0) return
  for (let r = area.s.r + 1; r <= area.e.r; r++) {
    const indirizzo = utils.encode_cell({ r, c: colonna })
    const valore = ws[indirizzo]?.v
    if (typeof valore !== 'string') continue
    const seriale = serialeExcelDaDataIso(valore)
    if (seriale !== null) ws[indirizzo] = { t: 'n', v: seriale, z: FORMATO_DATA_EXCEL }
  }
}
