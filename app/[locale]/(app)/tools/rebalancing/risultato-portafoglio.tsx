'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatEuro, formatNumero, formatPercent, type LocaleFormato } from '@/lib/format'
import { traduciCategoria } from '@/lib/i18n-categorie'
import type { AlternativaStrutturale, RisultatoPortafoglio, SoluzionePortafoglio } from '@/lib/ribilanciamento'
import type { AvvisoStrutturale } from '@/lib/ribilanciamento-simulazione'
import { Sezione } from '@/components/sezione'
import { stileCardMetrica } from '@/components/card-metrica'
import { IconaAvviso, IconaSpunta } from '@/components/icone'
import type { SezionePdf } from './esporta-pdf'

// Tipo minimo del traduttore next-intl di cui questo file ha bisogno per
// costruire il PDF: il progetto non ha una tipizzazione stretta delle chiavi
// dei messaggi (nessun global.d.ts con IntlMessages), quindi il traduttore
// vero restituito da useTranslations soddisfa già questa forma.
// `valori: any` e non Record<string, unknown>: il vero rich di next-intl
// dichiara il suo secondo parametro come parte di un rest (...args:
// TranslateArgs<...>), e per un rest parameter TypeScript confronta il tipo
// elemento in modo stretto anche quando rich è scritto in sintassi-metodo
// (il trucco della bivarianza dei metodi non si applica in quel caso) — un
// Record<string, unknown> lì risultava sempre incompatibile con
// Record<string, string | number | Date | RichTagsFunction>. `any` bypassa
// il controllo di varianza (verificato riproducendo l'errore con i tipi
// reali di next-intl clonati da GitHub, prima e dopo il fix).
type Traduttore = {
  (chiave: string, valori?: Record<string, string | number>): string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any obbligatorio qui, vedi commento sopra
  rich(chiave: string, valori: any): unknown
}

// Sotto questo importo una voce non si mostra: è rumore numerico, non un acquisto.
export const IMPORTO_MINIMO = 0.005

// Punto dello slider tra le due schede. Hanno lo stesso versamento, quindi lo
// stesso totale finale: ogni importo, valore, peso e scostamento è lineare
// nella posizione, e ogni punto intermedio è una combinazione convessa di due
// soluzioni ammissibili, quindi resta entro soglia.
function interpola(a: SoluzionePortafoglio, b: SoluzionePortafoglio, x: number): SoluzionePortafoglio {
  const mix = (u: number, v: number) => (1 - x) * u + x * v
  return {
    versamento: mix(a.versamento, b.versamento),
    pac: a.pac.map((p, i) => ({ ...p, importo: mix(p.importo, b.pac[i].importo) })),
    libere: a.libere.map((f, i) => ({ ...f, importo: mix(f.importo, b.libere[i].importo) })),
    righe: a.righe.map((r, i) => {
      const s = b.righe[i]
      return {
        ...r,
        acquisto: mix(r.acquisto, s.acquisto),
        valoreFinale: mix(r.valoreFinale, s.valoreFinale),
        pesoFinalePct: mix(r.pesoFinalePct, s.pesoFinalePct),
        scostamentoFinalePp:
          r.scostamentoFinalePp === null || s.scostamentoFinalePp === null
            ? null
            : mix(r.scostamentoFinalePp, s.scostamentoFinalePp),
      }
    }),
    scostamentoMassimoPp: Math.max(a.scostamentoMassimoPp, b.scostamentoMassimoPp),
  }
}

// Testo di ciascuna alternativa strutturale, una riga per alternativa: stessa
// fonte per il paragrafo a schermo (<li>) e per la lista nel PDF, mai
// duplicata (vedi CLAUDE.md).
function righeAlternativeStrutturali(
  alternative: AlternativaStrutturale[],
  t: Traduttore,
  tCategorie: Traduttore,
  locale: LocaleFormato
): string[] {
  return alternative.map((alt) => {
    if (alt.tipo === 'nuoviTarget') {
      const elenco = alt.categorie
        .map(
          (c) =>
            `${traduciCategoria(tCategorie, c.categoria)} ${formatPercent(c.targetAttualePct, 2, false, locale)} → ${formatPercent(c.targetSuggeritoPct, 2, false, locale)}`
        )
        .join(', ')
      return t('alternativaNuoviTarget', { elenco })
    }
    if (alt.tipo === 'nuovaFormaPac') {
      const elenco = alt.categorie
        .map(
          (c) =>
            `${traduciCategoria(tCategorie, c.categoria)} ${formatPercent(c.formaAttualePct, 1, false, locale)} → ${formatPercent(c.formaSuggeritaPct, 1, false, locale)}`
        )
        .join(', ')
      return t('alternativaNuovaFormaPac', { pac: alt.pacNome, elenco })
    }
    const elenco = alt.opzioni
      .map(
        (o) =>
          `${traduciCategoria(tCategorie, o.categoria)}: ${formatNumero(alt.floorAttualePp, 2, false, locale)} → ${formatNumero(o.floorSePp, 2, false, locale)} pp`
      )
      .join(', ')
    return t('alternativaNuovoVeicolo', { elenco })
  })
}

// Testo di una causa "forma fissa del PAC" in "Causa del problema": stessa
// fonte per la riga a schermo (AvvisoStrutturaleVista) e per il paragrafo nel
// PDF, mai duplicata. Singolare quando il gruppo intrappola una sola
// categoria — l'italiano "questi asset hanno vincoli..." suona sbagliato per
// una sola categoria.
function testoCausaFormaPac(gruppo: { pacNome: string; categorie: string[] }, t: Traduttore, tCategorie: Traduttore): string {
  return gruppo.categorie.length === 1
    ? t('causaProblemaFormaPacSingolare', { categoria: traduciCategoria(tCategorie, gruppo.categorie[0]), pac: gruppo.pacNome })
    : t('causaProblemaFormaPacPlurale', {
        categorie: gruppo.categorie.map((c) => traduciCategoria(tCategorie, c)).join(' e '),
        pac: gruppo.pacNome,
      })
}

// Stessa cosa per la causa "nessun veicolo", ma con due varianti di testo
// possibili, non solo singolare/plurale: "non esistono asset" è vero solo
// per le categorie davvero a zero nel portafoglio. Una categoria con un
// asset che esiste ma è intrappolato (es. in un PAC non toccabile, o con una
// forma che non la copre — vedi AvvisoStrutturale.senzaVeicoloConAsset in
// lib/ribilanciamento-simulazione.ts) userebbe altrimenti un testo falso.
// Restituisce fino a due paragrafi (uno per gruppo, quando servono entrambi).
function testoCausaSenzaVeicolo(categorie: string[], conAsset: string[], t: Traduttore, tCategorie: Traduttore): string[] {
  const senzaAsset = categorie.filter((c) => !conAsset.includes(c))
  const testi: string[] = []
  if (senzaAsset.length > 0) {
    testi.push(
      senzaAsset.length === 1
        ? t('causaProblemaSenzaVeicoloSingolare', { categoria: traduciCategoria(tCategorie, senzaAsset[0]) })
        : t('causaProblemaSenzaVeicoloPlurale', { categorie: senzaAsset.map((c) => traduciCategoria(tCategorie, c)).join(' e ') })
    )
  }
  if (conAsset.length > 0) {
    testi.push(
      conAsset.length === 1
        ? t('causaProblemaAssetNonRaggiungibileSingolare', { categoria: traduciCategoria(tCategorie, conAsset[0]) })
        : t('causaProblemaAssetNonRaggiungibilePlurale', { categorie: conAsset.map((c) => traduciCategoria(tCategorie, c)).join(' e ') })
    )
  }
  return testi
}

// Testo di "Note conclusive": un array per poter affiancare in futuro altre
// note oltre ai PAC esclusi, stessa fonte per schermo (NoteConclusiveVista) e
// PDF (sezioniNoteConclusivePdf), mai duplicata. Vuoto se nessun PAC è stato
// escluso in questa simulazione.
function testoNoteConclusive(pacEsclusi: string[], t: Traduttore): string[] {
  if (pacEsclusi.length === 0) return []
  return [
    pacEsclusi.length === 1
      ? t('notaPacEsclusiSingolare', { pac: pacEsclusi[0] })
      : t('notaPacEsclusiPlurale', { pac: pacEsclusi.join(', ') }),
  ]
}

const stileTh: React.CSSProperties = { padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }

// Titolo di blocco nel layout a blocchi (Riepilogo, Da dove arrivano i
// soldi, Dove versare, Risultato per categoria, Possibili soluzioni): stesso
// font-size ovunque, un solo punto da cui lo pescano tutti i blocchi.
export const stileTitoloBlocco: React.CSSProperties = { fontSize: 'var(--fs-h2)', fontWeight: 600 }

// Chip numerato (1, 2, 3...) davanti a una voce di un elenco a blocchi
// (vendite/riscatti in "Da dove arrivano i soldi", ciascuna card in
// "Possibili soluzioni"): stesso aspetto nei due punti in cui compare.
export function Numero({ valore }: { valore: number }) {
  return (
    <div
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--primary)',
        color: 'var(--primary-vivid)',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'var(--font-plex-mono)',
      }}
    >
      {valore}
    </div>
  )
}

function stileScheda(attiva: boolean): React.CSSProperties {
  return {
    flex: '1 1 200px',
    textAlign: 'left',
    padding: '10px 14px',
    background: attiva ? 'var(--bg-surface)' : 'transparent',
    color: 'var(--text-primary)',
    border: `1px solid ${attiva ? 'var(--primary)' : 'var(--border-default)'}`,
    fontSize: 'var(--fs-body)',
    fontFamily: 'inherit',
    cursor: 'pointer',
  }
}

function TabellaSoluzione({ soluzione }: { soluzione: SoluzionePortafoglio }) {
  const t = useTranslations('PaginaRibilanciamento')
  const tCategorie = useTranslations('Categorie')
  const locale = useLocale() as LocaleFormato

  const totaleAttuale = soluzione.righe.reduce((acc, r) => acc + r.valoreAttuale, 0)
  const voci = [
    ...soluzione.pac.map((p) => ({ chiave: `pac-${p.id}`, nome: p.nome, nota: t('notaBloccoPac'), importo: p.importo })),
    ...soluzione.libere.map((f) => ({
      chiave: `libera-${f.categoria}`,
      nome: traduciCategoria(tCategorie, f.categoria),
      nota: t('notaAcquistoLibero'),
      importo: f.importo,
    })),
  ].filter((v) => v.importo >= IMPORTO_MINIMO)

  return (
    <>
      <Sezione chiara>
        <div style={stileTitoloBlocco}>{t('titoloDoveVersare')}</div>
        {voci.length === 0 ? (
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginTop: 12 }}>{t('alertNessunAcquisto')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
            {voci.map((v, i) => (
              <div
                key={v.chiave}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 0',
                  // Mai sull'ultima riga, sempre e in qualsiasi caso: altrimenti
                  // resta un bordo scollegato da tutto ciò che segue la lista.
                  borderBottom: i === voci.length - 1 ? 'none' : '1px solid var(--border-default)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{v.nome}</span>
                  <span style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)' }}>({v.nota})</span>
                </div>
                <span style={{ fontFamily: 'var(--font-plex-mono)', fontSize: 'var(--fs-body)' }}>{formatEuro(v.importo, locale)}</span>
              </div>
            ))}
          </div>
        )}
      </Sezione>

      <Sezione chiara>
        <div style={stileTitoloBlocco}>{t('titoloRisultatoPerCategoria')}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
              <th style={stileTh}>{t('colonnaAsset')}</th>
              <th style={stileTh}>{t('colonnaTarget')}</th>
              <th style={stileTh}>{t('colonnaAttuale')}</th>
              <th style={stileTh}>{t('colonnaDaVersare')}</th>
              <th style={stileTh}>{t('colonnaPesoFinale')}</th>
              <th style={stileTh}>{t('colonnaScostamentoFinale')}</th>
            </tr>
          </thead>
          <tbody>
            {soluzione.righe.map((r) => (
              <tr key={r.categoria} className="tabella-riga">
                <td style={{ padding: 8 }}>{traduciCategoria(tCategorie, r.categoria)}</td>
                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>
                  {r.targetPct === null ? '—' : formatPercent(r.targetPct, 2, false, locale)}
                </td>
                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>
                  {formatPercent(totaleAttuale > 0 ? (r.valoreAttuale / totaleAttuale) * 100 : 0, 2, false, locale)}
                </td>
                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>{formatEuro(r.acquisto, locale)}</td>
                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>{formatPercent(r.pesoFinalePct, 2, false, locale)}</td>
                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>
                  {r.scostamentoFinalePp === null ? '—' : `${formatNumero(r.scostamentoFinalePp, 2, true, locale)} pp`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sezione>
    </>
  )
}

// "Possibili soluzioni": una card numerata per ciascuna AlternativaStrutturale
// trovata da calcolaAlternativeStrutturali. Mostrata solo per lo scenario
// "limite strutturale" (avvisoStrutturale con categorie non vuote): non ha
// senso per un residuo che basterebbe un versamento più alto a risolvere.
export function PossibiliSoluzioniVista({ alternative }: { alternative: AlternativaStrutturale[] }) {
  const t = useTranslations('PaginaRibilanciamento')
  const tCategorie = useTranslations('Categorie')
  const locale = useLocale() as LocaleFormato

  if (alternative.length === 0) return null

  return (
    <Sezione chiara>
      <div style={stileTitoloBlocco}>{t('titoloPossibiliSoluzioni')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 16 }}>
        {alternative.map((alt, i) => (
          <div key={i} style={{ ...stileCardMetrica, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Numero valore={i + 1} />
              <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 600 }}>
                {alt.tipo === 'nuoviTarget'
                  ? t('titoloAlternativaNuoviTarget')
                  : alt.tipo === 'nuovaFormaPac'
                    ? alt.pacNome
                    : t('titoloAlternativaNuovoVeicolo')}
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {alt.tipo === 'nuoviTarget'
                ? t('sottotitoloAlternativaNuoviTarget')
                : alt.tipo === 'nuovaFormaPac'
                  ? t('sottotitoloAlternativaNuovaFormaPac')
                  : t('sottotitoloAlternativaNuovoVeicolo')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-card-link)' }}>
              {alt.tipo === 'nuoviTarget' &&
                alt.categorie.map((c) => (
                  <div key={c.categoria} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{traduciCategoria(tCategorie, c.categoria)}</span>
                    <span style={{ fontFamily: 'var(--font-plex-mono)' }}>
                      {formatPercent(c.targetAttualePct, 2, false, locale)} &rarr; {formatPercent(c.targetSuggeritoPct, 2, false, locale)}
                    </span>
                  </div>
                ))}
              {alt.tipo === 'nuovaFormaPac' &&
                alt.categorie.map((c) => (
                  <div key={c.categoria} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{traduciCategoria(tCategorie, c.categoria)}</span>
                    <span style={{ fontFamily: 'var(--font-plex-mono)' }}>
                      {formatPercent(c.formaAttualePct, 1, false, locale)} &rarr; {formatPercent(c.formaSuggeritaPct, 1, false, locale)}
                    </span>
                  </div>
                ))}
              {alt.tipo === 'nuovoVeicolo' &&
                alt.opzioni.map((o) => (
                  <div key={o.categoria} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{traduciCategoria(tCategorie, o.categoria)}</span>
                    <span style={{ fontFamily: 'var(--font-plex-mono)', color: o.floorSePp <= 0.005 ? 'var(--success)' : undefined }}>
                      {formatNumero(alt.floorAttualePp, 2, false, locale)}% &rarr; {formatNumero(o.floorSePp, 2, false, locale)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Sezione>
  )
}

// Box di avviso "limite strutturale": titolo forte + "Causa del problema" con
// una riga per ciascuna causa individuata — la forma fissa di un PAC ETF
// (quando una delle alternative è "cambiare la forma del PAC") e/o categorie
// del tutto senza un modo di essere comprate (es. Monetario, da
// risultato.senzaVeicolo): quest'ultima non è più tenuta a parte come un
// avviso separato quando siamo nello scenario strutturale, è essa stessa una
// causa del problema.
export function AvvisoStrutturaleVista({
  avvisoStrutturale,
  senzaVeicolo,
}: {
  avvisoStrutturale: AvvisoStrutturale | null
  senzaVeicolo: string[]
}) {
  const t = useTranslations('PaginaRibilanciamento')
  const tCategorie = useTranslations('Categorie')

  if (!avvisoStrutturale || avvisoStrutturale.categorie.length === 0) return null

  // Un gruppo per ciascun PAC la cui forma fissa concorre a tenere al floor
  // almeno una categoria (avvisoStrutturale.causaPac, da
  // lib/ribilanciamento-simulazione.ts): non dipende dall'esistenza di una
  // specifica alternativa "nuovaFormaPac" quantificata, che richiede almeno
  // 2 categorie intrappolate solo da quel PAC e quindi può mancare anche
  // quando la forma del PAC è comunque la causa (es. una sola categoria
  // intrappolata, o una categoria anche libera ma comunque spinta al floor
  // dalla quota del PAC).
  const causeLine: string[] = avvisoStrutturale.causaPac.map((gruppo) => testoCausaFormaPac(gruppo, t, tCategorie))
  causeLine.push(...testoCausaSenzaVeicolo(senzaVeicolo, avvisoStrutturale.senzaVeicoloConAsset, t, tCategorie))

  return (
    <Sezione chiara>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }}>
          <IconaAvviso />
        </span>
        <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, lineHeight: 1.4 }}>{t('titoloAvvisoStrutturale')}</div>
      </div>
      {causeLine.length > 0 && (
        <div style={{ ...stileCardMetrica, marginTop: 14 }}>
          <div
            style={{
              fontSize: 'var(--fs-eyebrow)',
              letterSpacing: 1,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              fontWeight: 500,
            }}
          >
            {t('titoloCausaProblema')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {causeLine.map((riga, i) => (
              <div
                key={i}
                style={{ display: 'flex', gap: 8, fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-secondary)' }}
              >
                <span style={{ flexShrink: 0 }}>{i + 1}.</span>
                <span>{riga}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sezione>
  )
}

// Quanto basta muovere in totale quando l'esito è "raggiunto": il tetto
// impostato dall'utente se è bastato da solo, altrimenti il pool con
// vendite/riscatti se sono servite, altrimenti il budget minimo puro. Le tre
// fonti sono mutuamente esclusive — versamentoMassimo torna null quando
// poolTotale è valorizzato, vedi RisultatoSimulazionePortafoglio in
// lib/ribilanciamento-simulazione.ts — quindi coincidono con budgetMinimo
// quando non sono servite né un tetto né vendite/riscatti (il caso comune).
// Stessa fonte per schermo (AvvisoSuccessoVista, anche dal chiamante in
// simulatore-portafoglio.tsx per il valore passato a RiepilogoVista) e PDF,
// mai duplicata.
export function importoVersamentoSufficiente(versamentoMassimo: number | null, poolTotale: number | null, budgetMinimo: number): number {
  return versamentoMassimo ?? poolTotale ?? budgetMinimo
}

// Box di successo "Ribilanciamento possibile": stessa struttura visiva di
// AvvisoStrutturaleVista qui sopra (icona + titolo + testo dentro una
// Sezione chiara), ma per l'esito opposto — spunta invece del triangolo,
// --success invece di --warning. Due righe: quanto basta muovere in totale
// (messaggioVersamentoSufficiente, condivisa con simulatore-gruppo.tsx — non
// toccarne il significato) e, a parte, quanto basterebbe comprando soltanto
// (budgetMinimo, indipendente da eventuali vendite/riscatti).
export function AvvisoSuccessoVista({
  versamentoTotale,
  budgetMinimo,
  locale,
}: {
  versamentoTotale: number
  budgetMinimo: number
  locale: LocaleFormato
}) {
  const t = useTranslations('PaginaRibilanciamento')

  return (
    <Sezione chiara>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>
          <IconaSpunta />
        </span>
        <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, lineHeight: 1.4 }}>{t('titoloAvvisoSuccesso')}</div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ fontSize: 'var(--fs-body)', margin: 0 }}>
          {t('messaggioVersamentoSufficiente', { importo: formatEuro(versamentoTotale, locale) })}
        </p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>
          {t('messaggioSoloAcquistoSufficiente', { importo: formatEuro(budgetMinimo, locale) })}
        </p>
      </div>
    </Sezione>
  )
}

// "Riepilogo": le 3 card in cima al blocco — per lo scenario "limite
// strutturale" e per un ribilanciamento riuscito (esito "raggiunto"), stesse
// 3 card in entrambi i casi. Il chiamante (SimulatorePortafoglio) passa i
// dati grezzi: qui si fa solo la composizione del testo e la formattazione.
export function RiepilogoVista({
  versamentoTotale,
  conVendite,
  conRiscatti,
  scostamentoResiduoPp,
  soglia,
  categorieCoinvolte,
  successo = false,
}: {
  versamentoTotale: number
  conVendite: boolean
  conRiscatti: boolean
  scostamentoResiduoPp: number
  soglia: number
  categorieCoinvolte: string[]
  // true quando la card "scostamento residuo" descrive un esito raggiunto
  // (entro soglia): colorata in --success invece di --warning, non c'è nulla
  // da segnalare come problema qui.
  successo?: boolean
}) {
  const t = useTranslations('PaginaRibilanciamento')
  const tCategorie = useTranslations('Categorie')
  const locale = useLocale() as LocaleFormato

  const componenti = [
    t('componenteVersamento'),
    ...(conVendite ? [t('componenteVendite')] : []),
    ...(conRiscatti ? [t('componenteRiscatti')] : []),
  ].join(' + ')

  return (
    <Sezione chiara>
      <div style={stileTitoloBlocco}>{t('titoloRiepilogo')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
        <div style={{ ...stileCardMetrica, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)' }}>{t('labelImportoDaMovimentare')}</div>
          <div style={{ fontFamily: 'var(--font-hero)', fontWeight: 600, fontSize: 'var(--fs-hero-secondario)' }}>
            {formatEuro(versamentoTotale, locale)}
          </div>
          <div style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)' }}>{componenti}</div>
        </div>

        <div style={{ ...stileCardMetrica, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)' }}>{t('labelScostamentoResiduoOttenibile')}</div>
          <div
            style={{
              fontFamily: 'var(--font-hero)',
              fontWeight: 600,
              fontSize: 'var(--fs-hero-secondario)',
              color: successo ? 'var(--success)' : 'var(--warning)',
            }}
          >
            {formatNumero(scostamentoResiduoPp, 2, false, locale)}%
          </div>
          <div style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)' }}>
            {t('sottotitoloSogliaImpostata', { soglia: formatNumero(soglia, 2, false, locale) })}
          </div>
        </div>

        <div style={{ ...stileCardMetrica, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)' }}>{t('labelCategorieCoinvolte')}</div>
          <div style={{ fontFamily: 'var(--font-hero)', fontWeight: 600, fontSize: 'var(--fs-hero-secondario)' }}>
            {categorieCoinvolte.length}
          </div>
          <div style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)' }}>
            {categorieCoinvolte.map((c) => traduciCategoria(tCategorie, c)).join(', ')}
          </div>
        </div>
      </div>
    </Sezione>
  )
}

// "Note conclusive": in coda al risultato, indipendentemente dall'esito
// (raggiunto/residuo/irraggiungibile) — per questo è un blocco a sé nel
// chiamante (dopo RisultatoPortafoglioVista), non dentro le sue diramazioni
// per esito. Oggi mostra solo l'esclusione PAC, ma resta un contenitore
// aperto ad altre note future (vedi testoNoteConclusive).
export function NoteConclusiveVista({ pacEsclusi }: { pacEsclusi: string[] }) {
  const t = useTranslations('PaginaRibilanciamento')
  const note = testoNoteConclusive(pacEsclusi, t)
  if (note.length === 0) return null

  return (
    <Sezione chiara>
      <div style={stileTitoloBlocco}>{t('titoloNoteConclusive')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
        {note.map((riga, i) => (
          <p key={i} style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            {riga}
          </p>
        ))}
      </div>
    </Sezione>
  )
}

export function RisultatoPortafoglioVista({
  risultato,
  avvisoStrutturale,
}: {
  risultato: RisultatoPortafoglio
  // Non più letto qui: gli importi dell'esito "raggiunto" li rende il
  // chiamante (AvvisoSuccessoVista), stesso pattern del ramo strutturale.
  avvisoStrutturale?: AvvisoStrutturale | null
}) {
  const t = useTranslations('PaginaRibilanciamento')
  const tCategorie = useTranslations('Categorie')
  const locale = useLocale() as LocaleFormato
  const [quotaPac, setQuotaPac] = useState(100)

  // Vero solo per lo scenario "limite strutturale" (nessun versamento, per
  // quanto alto, basterebbe): in quel caso il layout a blocchi (AvvisoStrutturaleVista
  // + PossibiliSoluzioniVista, resi dal chiamante e qui sotto) sostituisce il
  // messaggio semplice "residuo", non lo affianca.
  const strutturale = avvisoStrutturale !== null && avvisoStrutturale !== undefined && avvisoStrutturale.categorie.length > 0

  const avvisoSenzaVeicolo =
    risultato.senzaVeicolo.length > 0 ? (
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warning)' }}>
        {t('alertSenzaVeicolo', {
          categorie: risultato.senzaVeicolo.map((c) => traduciCategoria(tCategorie, c)).join(', '),
        })}
      </p>
    ) : null

  if (risultato.esito === 'irraggiungibile') {
    return (
      <>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warning)', fontWeight: 500, margin: 0 }}>
          {t('messaggioPortafoglioIrraggiungibile')}
        </p>
        {avvisoSenzaVeicolo}
      </>
    )
  }

  if (risultato.esito === 'residuo') {
    if (strutturale) {
      // Titolo, "Causa del problema" (comprese le categorie senza veicolo,
      // es. Monetario) sono già resi dal chiamante (AvvisoStrutturaleVista,
      // prima delle vendite/riscatti proposti): qui restano solo Dove
      // versare, Risultato per categoria e, in coda, Possibili soluzioni.
      return (
        <>
          <TabellaSoluzione soluzione={risultato.soluzione} />
          <PossibiliSoluzioniVista alternative={avvisoStrutturale!.alternative} />
        </>
      )
    }
    return (
      <>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warning)', fontWeight: 500, margin: 0 }}>
          {t('messaggioPortafoglioResiduo', {
            importo: formatEuro(risultato.soluzione.versamento, locale),
            scostamento: formatNumero(risultato.soluzione.scostamentoMassimoPp, 2, false, locale),
          })}
        </p>
        {avvisoSenzaVeicolo}
        <TabellaSoluzione soluzione={risultato.soluzione} />
      </>
    )
  }

  const { budgetMinimo, soloLibere, massimoPac, coincidono } = risultato
  const unica = massimoPac ?? soloLibere

  if (budgetMinimo < IMPORTO_MINIMO || !unica) {
    return (
      <>
        <p style={{ fontSize: 'var(--fs-body)', margin: 0 }}>{t('messaggioPortafoglioGiaInSoglia')}</p>
        {avvisoSenzaVeicolo}
      </>
    )
  }

  // Niente più intestazione con importi qui: "Ribilanciamento possibile" +
  // gli importi li rende già il chiamante (AvvisoSuccessoVista, prima delle
  // vendite/riscatti proposti) — stesso pattern del ramo "residuo"
  // strutturale qui sopra, che per lo stesso motivo non ha una propria
  // intestazione.
  if (coincidono || !soloLibere || !massimoPac) {
    return (
      <>
        {avvisoSenzaVeicolo}
        {!soloLibere && massimoPac && (
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>{t('notaSoloTramitePac')}</p>
        )}
        <TabellaSoluzione soluzione={unica} />
      </>
    )
  }

  const x = quotaPac / 100
  const corrente = interpola(soloLibere, massimoPac, x)

  return (
    <>
      {avvisoSenzaVeicolo}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" onClick={() => setQuotaPac(0)} style={stileScheda(quotaPac === 0)}>
          <strong style={{ fontWeight: 500 }}>{t('schedaSoloLibere')}</strong>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-card-link)', marginTop: 4 }}>
            {t('schedaSoloLibereNota')}
          </div>
        </button>
        <button type="button" onClick={() => setQuotaPac(100)} style={stileScheda(quotaPac === 100)}>
          <strong style={{ fontWeight: 500 }}>{t('schedaMassimoPac')}</strong>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-card-link)', marginTop: 4 }}>
            {t('schedaMassimoPacNota', {
              importo: formatEuro(massimoPac.pac.reduce((acc, p) => acc + p.importo, 0), locale),
            })}
          </div>
        </button>
      </div>

      <label style={{ display: 'block', marginTop: 16, fontSize: 'var(--fs-form-label)' }}>
        {t('labelQuotaPac', { quota: quotaPac })}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={quotaPac}
          onChange={(e) => setQuotaPac(Number(e.target.value))}
          style={{ display: 'block', width: '100%', maxWidth: 480, marginTop: 8, accentColor: 'var(--primary)' }}
        />
      </label>

      <TabellaSoluzione soluzione={corrente} />
    </>
  )
}

// Equivalente di TabellaSoluzione ma per il PDF: stessa fonte dati
// (soluzione.pac/libere/righe), stesso filtro IMPORTO_MINIMO sulle voci
// "dove versare".
function sezioniTabellaSoluzionePdf(
  soluzione: SoluzionePortafoglio,
  t: Traduttore,
  tCategorie: Traduttore,
  locale: LocaleFormato
): SezionePdf[] {
  const totaleAttuale = soluzione.righe.reduce((acc, r) => acc + r.valoreAttuale, 0)
  const voci = [
    ...soluzione.pac.map((p) => `${p.nome} (${t('notaBloccoPac')}): ${formatEuro(p.importo, locale)}`),
    ...soluzione.libere
      .filter((f) => f.importo >= IMPORTO_MINIMO)
      .map((f) => `${traduciCategoria(tCategorie, f.categoria)} (${t('notaAcquistoLibero')}): ${formatEuro(f.importo, locale)}`),
  ]

  const sezioni: SezionePdf[] = [{ tipo: 'sottotitolo', testo: t('titoloDoveVersare') }]
  sezioni.push(voci.length === 0 ? { tipo: 'paragrafo', testo: t('alertNessunAcquisto') } : { tipo: 'lista', voci })
  sezioni.push({
    tipo: 'tabella',
    colonne: [
      { intestazione: t('colonnaAsset') },
      { intestazione: t('colonnaTarget'), allineaDestra: true },
      { intestazione: t('colonnaAttuale'), allineaDestra: true },
      { intestazione: t('colonnaDaVersare'), allineaDestra: true },
      { intestazione: t('colonnaPesoFinale'), allineaDestra: true },
      { intestazione: t('colonnaScostamentoFinale'), allineaDestra: true },
    ],
    righe: soluzione.righe.map((r) => [
      traduciCategoria(tCategorie, r.categoria),
      r.targetPct === null ? '—' : formatPercent(r.targetPct, 2, false, locale),
      formatPercent(totaleAttuale > 0 ? (r.valoreAttuale / totaleAttuale) * 100 : 0, 2, false, locale),
      formatEuro(r.acquisto, locale),
      formatPercent(r.pesoFinalePct, 2, false, locale),
      r.scostamentoFinalePp === null ? '—' : `${formatNumero(r.scostamentoFinalePp, 2, true, locale)} pp`,
    ]),
  })
  return sezioni
}

// Sezioni PDF di "Note conclusive": stesso testo di NoteConclusiveVista a
// schermo (testoNoteConclusive), un sottotitolo + un paragrafo per nota. Vuoto
// se nessun PAC è stato escluso.
function sezioniNoteConclusivePdf(pacEsclusi: string[], t: Traduttore): SezionePdf[] {
  const note = testoNoteConclusive(pacEsclusi, t)
  if (note.length === 0) return []
  return [
    { tipo: 'separatore' },
    { tipo: 'sottotitolo', testo: t('titoloNoteConclusive') },
    ...note.map((testo): SezionePdf => ({ tipo: 'paragrafo', tono: 'secondario', testo })),
  ]
}

// Traduce RisultatoPortafoglio nelle sezioni PDF equivalenti a
// RisultatoPortafoglioVista qui sopra. Unica differenza voluta: la scelta
// interattiva "quota nei PAC" non ha senso su carta, quindi quando i due
// estremi (soloLibere / massimoPac) non coincidono si esportano entrambi
// come due tabelle separate invece dello slider.
function costruisciSezioniRisultatoPortafoglioBase(
  risultato: RisultatoPortafoglio,
  versamentoMassimo: number | null,
  poolTotale: number | null,
  avvisoStrutturale: AvvisoStrutturale | null | undefined,
  t: Traduttore,
  tCategorie: Traduttore,
  locale: LocaleFormato
): SezionePdf[] {
  // Stessi colori semantici del messaggio a schermo (--warning/--success/
  // --text-secondary): niente qui è colorato "a caso", replica 1:1
  // RisultatoPortafoglioVista qui sopra.
  const sezioniSenzaVeicolo = (categorie: string[]): SezionePdf[] =>
    categorie.length > 0
      ? [{ tipo: 'paragrafo', tono: 'avviso', testo: t('alertSenzaVeicolo', { categorie: categorie.map((c) => traduciCategoria(tCategorie, c)).join(', ') }) }]
      : []

  if (risultato.esito === 'irraggiungibile') {
    return [
      { tipo: 'casella', tono: 'avviso', testo: t('messaggioPortafoglioIrraggiungibile') },
      ...sezioniSenzaVeicolo(risultato.senzaVeicolo),
    ]
  }

  if (risultato.esito === 'residuo') {
    const strutturale = !!(avvisoStrutturale && avvisoStrutturale.categorie.length > 0)
    // Stesso titolo forte del layout a blocchi a schermo (AvvisoStrutturaleVista)
    // quando nessun versamento, per quanto alto, basterebbe; altrimenti il
    // messaggio "residuo" semplice, invariato.
    const sezioni: SezionePdf[] = [
      {
        tipo: 'casella',
        tono: 'avviso',
        testo: strutturale
          ? t('titoloAvvisoStrutturale')
          : t('messaggioPortafoglioResiduo', {
              importo: formatEuro(risultato.soluzione.versamento, locale),
              scostamento: formatNumero(risultato.soluzione.scostamentoMassimoPp, 2, false, locale),
            }),
      },
    ]
    if (strutturale) {
      // Stessa logica e stesso testo di AvvisoStrutturaleVista qui sopra: un
      // paragrafo numerato per ciascun PAC la cui forma fissa concorre a
      // tenere al floor almeno una categoria (avvisoStrutturale.causaPac),
      // non solo quando esiste una specifica alternativa "nuovaFormaPac"
      // quantificata, più eventualmente uno per le categorie senza veicolo —
      // stessa numerazione progressiva delle righe a schermo.
      let numeroCausa = 0
      for (const gruppo of avvisoStrutturale!.causaPac) {
        numeroCausa += 1
        sezioni.push({
          tipo: 'paragrafo',
          tono: 'secondario',
          testo: `${numeroCausa}. ${testoCausaFormaPac(gruppo, t, tCategorie)}`,
        })
      }
      for (const testo of testoCausaSenzaVeicolo(risultato.senzaVeicolo, avvisoStrutturale!.senzaVeicoloConAsset, t, tCategorie)) {
        numeroCausa += 1
        sezioni.push({ tipo: 'paragrafo', tono: 'secondario', testo: `${numeroCausa}. ${testo}` })
      }
    } else {
      sezioni.push(...sezioniSenzaVeicolo(risultato.senzaVeicolo))
    }
    sezioni.push(...sezioniTabellaSoluzionePdf(risultato.soluzione, t, tCategorie, locale))
    // Possibili soluzioni in coda, dopo il risultato per categoria: stesso
    // ordine del layout a blocchi a schermo (RisultatoPortafoglioVista).
    if (strutturale && avvisoStrutturale!.alternative.length > 0) {
      sezioni.push({ tipo: 'sottotitolo', testo: t('titoloAlternativeStrutturali') })
      sezioni.push({ tipo: 'lista', voci: righeAlternativeStrutturali(avvisoStrutturale!.alternative, t, tCategorie, locale) })
    }
    return sezioni
  }

  const { budgetMinimo, soloLibere, massimoPac, coincidono, senzaVeicolo } = risultato
  const unica = massimoPac ?? soloLibere

  if (budgetMinimo < IMPORTO_MINIMO || !unica) {
    return [{ tipo: 'paragrafo', testo: t('messaggioPortafoglioGiaInSoglia') }, ...sezioniSenzaVeicolo(senzaVeicolo)]
  }

  // Stesso box "Ribilanciamento possibile" dello schermo (AvvisoSuccessoVista):
  // casella di successo col titolo, poi le due righe di importo — quanto
  // basta muovere in totale e, a parte, quanto basterebbe comprando soltanto.
  const versamentoTotale = importoVersamentoSufficiente(versamentoMassimo, poolTotale, budgetMinimo)
  const sezioni: SezionePdf[] = [
    { tipo: 'casella', tono: 'successo', testo: t('titoloAvvisoSuccesso') },
    { tipo: 'paragrafo', testo: t('messaggioVersamentoSufficiente', { importo: formatEuro(versamentoTotale, locale) }) },
    { tipo: 'paragrafo', tono: 'secondario', testo: t('messaggioSoloAcquistoSufficiente', { importo: formatEuro(budgetMinimo, locale) }) },
  ]
  sezioni.push(...sezioniSenzaVeicolo(senzaVeicolo))

  if (coincidono || !soloLibere || !massimoPac) {
    if (!soloLibere && massimoPac) sezioni.push({ tipo: 'paragrafo', tono: 'secondario', testo: t('notaSoloTramitePac') })
    sezioni.push(...sezioniTabellaSoluzionePdf(unica, t, tCategorie, locale))
    return sezioni
  }

  sezioni.push({ tipo: 'sottotitolo', testo: t('schedaSoloLibere') })
  sezioni.push(...sezioniTabellaSoluzionePdf(soloLibere, t, tCategorie, locale))
  sezioni.push({ tipo: 'spazio', altezza: 6 })
  sezioni.push({ tipo: 'sottotitolo', testo: t('schedaMassimoPac') })
  sezioni.push(...sezioniTabellaSoluzionePdf(massimoPac, t, tCategorie, locale))
  return sezioni
}

// Wrapper esportato: stesso risultato di costruisciSezioniRisultatoPortafoglioBase
// (invariata, tutte le sue diramazioni per esito) più "Note conclusive" in
// coda una sola volta, qualunque sia l'esito — evita di duplicare la chiamata
// a sezioniNoteConclusivePdf in ciascuna delle diramazioni qui sopra.
export function costruisciSezioniRisultatoPortafoglio(
  risultato: RisultatoPortafoglio,
  versamentoMassimo: number | null,
  poolTotale: number | null,
  avvisoStrutturale: AvvisoStrutturale | null | undefined,
  pacEsclusi: string[],
  t: Traduttore,
  tCategorie: Traduttore,
  locale: LocaleFormato
): SezionePdf[] {
  const sezioni = costruisciSezioniRisultatoPortafoglioBase(risultato, versamentoMassimo, poolTotale, avvisoStrutturale, t, tCategorie, locale)
  sezioni.push(...sezioniNoteConclusivePdf(pacEsclusi, t))
  return sezioni
}
