// Genera i template Excel inglesi (public/*-en.xlsx) dai template italiani.
// Le intestazioni vengono da intestazioneExcel (lib/i18n-intestazioni-excel.ts),
// cioè la stessa mappa che l'import usa per riconoscerle; le etichette di
// Operazione e Tipo movimento da messages/en.json. Solo le note in fondo al
// template liquidità sono scritte qui a mano.
//
// Uso: node scripts/genera-template-excel.mjs
import { createJiti } from 'jiti'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const jiti = createJiti(import.meta.url, { alias: { '@': radice } })
// Build CommonJS di xlsx: quella ESM non legge né scrive file senza set_fs.
const XLSX = createRequire(import.meta.url)('xlsx')
const { COLONNE_EXCEL_FINANZIARIE, COLONNE_EXCEL_LIQUIDITA, TEMPLATE_EXCEL, colonnaDaIntestazioneExcel, intestazioneExcel } =
  await jiti.import('@/lib/i18n-intestazioni-excel')
const { traduciOperazione } = await jiti.import('@/lib/i18n-tipi-operazione')
const { CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA, traduciTipoMovimentoLiquidita } = await jiti.import('@/lib/i18n-tipi-movimento-liquidita')
const en = await jiti.import('@/messages/en.json')

const LOCALE = 'en'
const tOperazione = (chiave) => en.TipiOperazione[chiave]
const tTipoMovimento = (chiave) => en.TipiMovimentoLiquidita[chiave]
const intestazione = (colonna) => intestazioneExcel(colonna, LOCALE)

function genera({ origine, destinazione, nomeFoglio, colonne, traduciCella, note }) {
  const wb = XLSX.readFile(path.join(radice, 'public', origine), { cellStyles: true })
  const foglioIt = wb.Sheets[wb.SheetNames[0]]
  const [intestazioniIt, ...righe] = XLSX.utils.sheet_to_json(foglioIt, { header: 1, defval: '', blankrows: false })

  // Ogni intestazione italiana deve essere una colonna nota: il template
  // tradotto ha esattamente le stesse colonne, nello stesso ordine.
  const colonneTemplate = intestazioniIt.map((h) => {
    const colonna = colonnaDaIntestazioneExcel(String(h))
    if (!colonna || !colonne.includes(colonna)) throw new Error(`${origine}: intestazione non riconosciuta "${h}"`)
    return colonna
  })

  // Solo le righe di esempio (con almeno un valore in una colonna diversa
  // dalla prima): le note in italiano vengono sostituite da quelle tradotte.
  const esempi = righe.filter((riga) => riga.slice(1).some((v) => v !== ''))
  const aoa = [
    colonneTemplate.map(intestazione),
    ...esempi.map((riga) => riga.map((v, i) => traduciCella(colonneTemplate[i], v))),
    ...(note ? [[], ...note.map((n) => [n])] : []),
  ]
  const foglio = XLSX.utils.aoa_to_sheet(aoa)
  foglio['!cols'] = (foglioIt['!cols'] ?? []).map((c) => ({ wch: c.wch }))
  const nuovo = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(nuovo, foglio, nomeFoglio)
  XLSX.writeFile(nuovo, path.join(radice, 'public', destinazione))
  console.log(`${origine} → ${destinazione}`)
}

const nomeFile = (url) => url.replace(/^\//, '')
const tipiMovimento = Object.keys(CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA).map((t) => traduciTipoMovimentoLiquidita(tTipoMovimento, t))

genera({
  origine: nomeFile(TEMPLATE_EXCEL.finanziarie.it),
  destinazione: nomeFile(TEMPLATE_EXCEL.finanziarie[LOCALE]),
  nomeFoglio: 'Transactions',
  colonne: COLONNE_EXCEL_FINANZIARIE,
  traduciCella: (colonna, v) => (colonna === 'Operazione' && v !== '' ? traduciOperazione(tOperazione, String(v)) : v),
})

genera({
  origine: nomeFile(TEMPLATE_EXCEL.liquidita.it),
  destinazione: nomeFile(TEMPLATE_EXCEL.liquidita[LOCALE]),
  nomeFoglio: 'Cash movements',
  colonne: COLONNE_EXCEL_LIQUIDITA,
  traduciCella: (colonna, v) => (colonna === 'Tipo movimento' && v !== '' ? traduciTipoMovimentoLiquidita(tTipoMovimento, String(v)) : v),
  note: [
    'Notes:',
    `- ${intestazione('Data')}: format DD/MM/YYYY.`,
    `- ${intestazione('Strumento')}: exact name of an account that already exists in Instruments (Cash category). New accounts are not created.`,
    `- ${intestazione('Tipo movimento')}: one of ${tipiMovimento.join(', ')}.`,
    `- ${intestazione('Importo')}: number, gross.`,
    `- ${intestazione('Tassa trattenuta')}: number, optional (default 0). Only relevant for ${traduciTipoMovimentoLiquidita(tTipoMovimento, 'Interesse')}.`,
    `- ${intestazione('Contenitore')}: name of an existing group, or leave empty.`,
    '- Delete this example row (row 2) and these notes before importing the file.',
  ],
})
