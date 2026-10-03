'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatEuro, formatEuroSigned, formatNumero, formatPercent, type LocaleFormato } from '@/lib/format'
import { Sezione } from '@/components/sezione'
import { Checkbox } from '@/components/checkbox'
import { MenuSelect } from '@/components/menu-select'
import {
  RisultatoPortafoglioVista,
  NoteConclusiveVista,
  costruisciSezioniRisultatoPortafoglio,
  AvvisoStrutturaleVista,
  AvvisoSuccessoVista,
  RiepilogoVista,
  importoVersamentoSufficiente,
  Numero,
  stileTitoloBlocco,
  IMPORTO_MINIMO,
} from './risultato-portafoglio'
import { WizardRibilanciamento, type PassoWizard } from './wizard-ribilanciamento'
import { PassoSogliaVersamento, PassoCommissioniVendita, PassoVendiInPerdita, PassoEsecuzione } from './passi-comuni'
import { StoricoSimulazioni, type RigaStoricoVista } from './storico-simulazioni'
import { OverlayRisultatoSimulazione } from './overlay-risultato-simulazione'
import { esportaSimulazionePdf, testoDaRich, type SezionePdf } from './esporta-pdf'
import { eseguiSimulazionePortafoglio, type RigaStoricoSimulazione } from './actions-simulazione'
import { MAX_SIMULAZIONI_STORICO, type RisultatoSimulazionePortafoglio } from '@/lib/ribilanciamento-simulazione'

// Tipo minimo del traduttore next-intl di cui questo file ha bisogno (niente
// IntlMessages tipizzato in questo progetto: il vero t di useTranslations
// soddisfa già questa forma strutturalmente).
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

const stileBottonePrimario: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  fontSize: 'var(--fs-button)',
  fontWeight: 500,
  cursor: 'pointer',
}

const stileCampoLista: React.CSSProperties = {
  marginTop: 8,
  padding: 8,
  border: '1px solid var(--border-default)',
  maxHeight: 160,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

function ListaSpuntabile({
  opzioni,
  selezionati,
  onCambia,
  alertVuoto,
}: {
  opzioni: { id: string; nome: string }[]
  selezionati: string[]
  onCambia: (id: string, spuntato: boolean) => void
  alertVuoto: string
}) {
  if (opzioni.length === 0) {
    return <p style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', margin: '8px 0 0' }}>{alertVuoto}</p>
  }
  return (
    <div style={stileCampoLista}>
      {opzioni.map((o) => (
        <Checkbox
          key={o.id}
          checked={selezionati.includes(o.id)}
          onChange={(spuntato) => onCambia(o.id, spuntato)}
          label={o.nome}
        />
      ))}
    </div>
  )
}

function fmtDataOra(iso: string, locale: LocaleFormato) {
  const d = new Date(iso)
  return `${d.toLocaleDateString(locale)} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
}

// Traduce una riga grezza dello storico in ciò che la mini card mostra: solo
// qui si conoscono i campi propri del risultato "portafoglio" (poolTotale,
// risultato.esito) — la card resta generica.
function rigaVista(
  s: RigaStoricoSimulazione,
  locale: LocaleFormato,
  t: (chiave: string) => string
): RigaStoricoVista {
  const risultato = s.risultato as RisultatoSimulazionePortafoglio
  const importoNumero = risultato.poolTotale ?? risultato.versamentoMassimo
  const esito = risultato.risultato.esito
  const badge =
    esito === 'raggiunto'
      ? { testo: t('badgeSimulazioneRaggiunto'), colore: 'var(--success)', sfondo: 'rgba(52,199,123,0.15)' }
      : esito === 'residuo'
        ? { testo: t('badgeSimulazioneParziale'), colore: 'var(--warning)', sfondo: 'rgba(232,162,59,0.15)' }
        : { testo: t('badgeSimulazioneNonRaggiunto'), colore: 'var(--danger)', sfondo: 'rgba(229,72,77,0.15)' }
  return {
    id: s.id,
    nome: s.nome,
    dataOra: fmtDataOra(s.creato_at, locale),
    importo: importoNumero !== null ? formatEuro(importoNumero, locale) : null,
    badgeTesto: badge.testo,
    badgeColore: badge.colore,
    badgeSfondo: badge.sfondo,
  }
}

// Traduce il risultato tipizzato nelle sezioni PDF, nello stesso ordine in
// cui appaiono nell'overlay: vendite proposte, riscatti proposti, pool da
// reinvestire, nota Polizza, poi il risultato del ribilanciamento vero e
// proprio (costruisciSezioniRisultatoPortafoglio, condivisa con
// risultato-portafoglio.tsx).
// Stesso esito a tre stati usato da rigaVista qui sopra per il badge della
// mini-card — qui tradotto nel vocabolario successo/avviso/pericolo del PDF
// invece che nelle variabili CSS --success/--warning/--danger.
function distintivoPortafoglio(esito: RisultatoSimulazionePortafoglio['risultato']['esito'], t: Traduttore) {
  return esito === 'raggiunto'
    ? { testo: t('badgeSimulazioneRaggiunto'), tono: 'successo' as const }
    : esito === 'residuo'
      ? { testo: t('badgeSimulazioneParziale'), tono: 'avviso' as const }
      : { testo: t('badgeSimulazioneNonRaggiunto'), tono: 'pericolo' as const }
}

function costruisciContenutoPdf(
  risultato: RisultatoSimulazionePortafoglio,
  nome: string,
  dataOraIso: string,
  t: Traduttore,
  tPaginaFiscalita: Traduttore,
  tPaginaStorico: Traduttore,
  tCategorie: Traduttore,
  locale: LocaleFormato
) {
  const sezioni: SezionePdf[] = []

  if (risultato.venditeProposte.length > 0) {
    sezioni.push({ tipo: 'sottotitolo', tono: 'avviso', testo: t('titoloVenditeProposte') })
    sezioni.push({
      tipo: 'tabella',
      colonne: [
        { intestazione: t('colonnaPosizioneVenduta') },
        { intestazione: tPaginaStorico('colonnaQuantita'), allineaDestra: true },
        { intestazione: tPaginaFiscalita('colonnaValore'), allineaDestra: true },
        { intestazione: t('colonnaPlusMinusLorda'), allineaDestra: true },
        { intestazione: t('colonnaAliquota'), allineaDestra: true },
        { intestazione: t('colonnaTassa'), allineaDestra: true },
        { intestazione: t('colonnaNetto'), allineaDestra: true },
      ],
      // Plus/minus colorata come a schermo (rosso in perdita, verde in
      // guadagno): unica cella "tono" di questa tabella.
      righe: risultato.venditeProposte.map((v) => [
        v.nome,
        formatNumero(v.quantitaVenduta, 6, false, locale),
        formatEuro(v.valoreVenduto, locale),
        { testo: formatEuroSigned(v.plusvalenzaLorda, locale), tono: v.plusvalenzaLorda >= 0 ? ('successo' as const) : ('pericolo' as const) },
        formatPercent(v.aliquota * 100, 1, false, locale),
        formatEuro(v.tassa, locale),
        formatEuro(v.proventoNetto, locale),
      ]),
    })
  }

  if (risultato.riscattiProposti.length > 0) {
    sezioni.push({ tipo: 'sottotitolo', tono: 'avviso', testo: t('titoloRiscattiProposti') })
    sezioni.push({
      tipo: 'tabella',
      colonne: [
        { intestazione: t('colonnaPolizza') },
        { intestazione: tPaginaFiscalita('colonnaValore'), allineaDestra: true },
        { intestazione: t('colonnaImponibile'), allineaDestra: true },
        { intestazione: t('colonnaTassa'), allineaDestra: true },
        { intestazione: t('colonnaNetto'), allineaDestra: true },
      ],
      righe: risultato.riscattiProposti.map((r) => [
        r.nome,
        formatEuro(r.valoreAttuale, locale),
        formatEuro(r.imponibile, locale),
        formatEuro(r.tassa, locale),
        formatEuro(r.proventoNetto, locale),
      ]),
    })
    // Stessa posizione dello schermo: subito dopo la tabella dei riscatti
    // proposti, non come nota generica di chiusura.
    sezioni.push({ tipo: 'paragrafo', tono: 'secondario', testo: t('notaPolizzaEsclusaDalleVendite') })
  }

  if (risultato.poolTotale !== null) {
    sezioni.push({
      tipo: 'paragrafo',
      testo: testoDaRich(
        t.rich('messaggioPoolReinvestire', { importo: formatEuro(risultato.poolTotale, locale), strong: (chunks: unknown) => chunks })
      ),
    })
  }

  sezioni.push({ tipo: 'separatore' })
  sezioni.push(
    ...costruisciSezioniRisultatoPortafoglio(
      risultato.risultato,
      risultato.versamentoMassimo,
      risultato.poolTotale,
      risultato.avvisoStrutturale,
      risultato.pacEsclusi ?? [],
      t,
      tCategorie,
      locale
    )
  )

  return {
    nome,
    sottotitolo: `${t('wizardTitoloPortafoglio')} — ${fmtDataOra(dataOraIso, locale)}`,
    distintivo: distintivoPortafoglio(risultato.risultato.esito, t),
    sezioni,
  }
}

export function SimulatorePortafoglio({
  pacDisponibili,
  polizzeDisponibili,
  storicoIniziale,
}: {
  pacDisponibili: { id: string; nome: string }[]
  polizzeDisponibili: { id: string; nome: string }[]
  storicoIniziale: RigaStoricoSimulazione[]
}) {
  const t = useTranslations('PaginaRibilanciamento')
  const tPaginaFiscalita = useTranslations('PaginaFiscalita')
  const tPaginaStorico = useTranslations('PaginaStorico')
  const tCategorie = useTranslations('Categorie')
  const locale = useLocale() as LocaleFormato

  const [aperto, setAperto] = useState(false)
  const [indice, setIndice] = useState(0)
  const [inCalcolo, setInCalcolo] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const [sogliaImpostata, setSogliaImpostata] = useState(false)
  const [sogliaValore, setSogliaValore] = useState('')
  const [commissione, setCommissione] = useState('')
  const [forzaVendita, setForzaVendita] = useState(false)
  const [valutaRiscatto, setValutaRiscatto] = useState(false)
  const [modoRiscatto, setModoRiscatto] = useState<'manuale' | 'automatico'>('automatico')
  const [polizzeSelezionate, setPolizzeSelezionate] = useState<string[]>([])
  const [valutaPac, setValutaPac] = useState(false)
  const [pacSelezionati, setPacSelezionati] = useState<string[]>([])
  // Indipendente da valutaPac/pacSelezionati: un PAC qui dentro sparisce da
  // tutta la simulazione (vedi pacEsclusiSet in lib/ribilanciamento-simulazione.ts),
  // non solo dalla possibilità di venderlo. La lista selezionabile compare
  // solo dopo aver spuntato valutaEsclusionePac (stesso pattern di
  // valutaPac/pacSelezionati qui sopra).
  const [valutaEsclusionePac, setValutaEsclusionePac] = useState(false)
  const [pacEsclusi, setPacEsclusi] = useState<string[]>([])
  const [nomeSimulazione, setNomeSimulazione] = useState('')

  const [risultato, setRisultato] = useState<RisultatoSimulazionePortafoglio | null>(null)
  // Nome e data/ora mostrati in testa all'overlay: il nome digitato nel
  // wizard resta nello stato nomeSimulazione anche dopo il calcolo, ma se poi
  // si riapre una simulazione più vecchia dallo storico il nome/la data
  // giusti sono quelli della riga selezionata, non quelli dell'ultimo giro
  // nel wizard — da qui uno stato dedicato invece di riusare nomeSimulazione.
  const [nomeRisultato, setNomeRisultato] = useState('')
  const [dataOraRisultato, setDataOraRisultato] = useState('')
  const [storico, setStorico] = useState(storicoIniziale)

  const passi: PassoWizard[] = [
    { id: 'soglia', titolo: t('stepSogliaVersamento') },
    { id: 'commissioni', titolo: t('stepCommissioniVendita') },
    { id: 'perdita', titolo: t('stepVendiInPerdita') },
    { id: 'polizza', titolo: t('stepRiscattoPolizza') },
    { id: 'pac', titolo: t('stepToccaPac') },
    { id: 'esecuzione', titolo: t('stepEsecuzione') },
  ]

  function reset() {
    setIndice(0)
    setErrore(null)
    setNomeSimulazione('')
  }

  async function handleCalcola() {
    setInCalcolo(true)
    setErrore(null)
    const esito = await eseguiSimulazionePortafoglio(nomeSimulazione, {
      versamentoMassimo: sogliaImpostata && sogliaValore ? Number(sogliaValore) : null,
      commissioneVendita: commissione ? Number(commissione) : 0,
      forzaVendita,
      valutaRiscattoPolizza: valutaRiscatto,
      modoRiscattoPolizza: modoRiscatto,
      polizzeSelezionate: modoRiscatto === 'manuale' ? polizzeSelezionate : [],
      valutaPac,
      pacSelezionati: valutaPac ? pacSelezionati : [],
      pacEsclusi: valutaEsclusionePac ? pacEsclusi : [],
    })
    setInCalcolo(false)
    if (!esito.ok) {
      setErrore(t('erroreSimulazione'))
      return
    }
    const adesso = new Date().toISOString()
    setRisultato(esito.risultato)
    setNomeRisultato(nomeSimulazione.trim())
    setDataOraRisultato(adesso)
    setAperto(false)
    setStorico((precedente) =>
      [
        {
          id: crypto.randomUUID(),
          nome: nomeSimulazione.trim(),
          creato_at: adesso,
          parametri: null,
          risultato: esito.risultato,
        },
        ...precedente,
      ].slice(0, MAX_SIMULAZIONI_STORICO)
    )
  }

  const opzioniModoRiscatto = [
    { value: 'automatico', label: t('modoRiscattoAutomatico') },
    { value: 'manuale', label: t('modoRiscattoManuale') },
  ]

  const passoCorrenteContenuto = [
    <PassoSogliaVersamento
      key="soglia"
      impostata={sogliaImpostata}
      onCambiaImpostata={setSogliaImpostata}
      valore={sogliaValore}
      onCambiaValore={setSogliaValore}
      numeroSimulazioniSalvate={storico.length}
    />,
    <PassoCommissioniVendita key="commissioni" valore={commissione} onCambia={setCommissione} />,
    <PassoVendiInPerdita key="perdita" valore={forzaVendita} onCambia={setForzaVendita} />,
    <div key="polizza" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Checkbox checked={valutaRiscatto} onChange={setValutaRiscatto} label={t('domandaRiscattoPolizza')} />
      {valutaRiscatto && (
        <>
          <div style={{ maxWidth: 340 }}>
            <span style={{ fontSize: 'var(--fs-form-label)', display: 'block', marginBottom: 4 }}>{t('labelModoRiscatto')}</span>
            <MenuSelect value={modoRiscatto} onChange={(v) => setModoRiscatto(v as 'manuale' | 'automatico')} options={opzioniModoRiscatto} />
          </div>
          {modoRiscatto === 'manuale' && (
            <div>
              <span style={{ fontSize: 'var(--fs-form-label)' }}>{t('labelPolizzeDaValutare')}</span>
              <ListaSpuntabile
                opzioni={polizzeDisponibili}
                selezionati={polizzeSelezionate}
                onCambia={(id, spuntato) =>
                  setPolizzeSelezionate((prev) => (spuntato ? [...prev, id] : prev.filter((x) => x !== id)))
                }
                alertVuoto={t('alertNessunaPolizza')}
              />
            </div>
          )}
        </>
      )}
    </div>,
    <div key="pac" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Checkbox checked={valutaPac} onChange={setValutaPac} label={t('domandaToccaPac')} />
      {valutaPac && (
        <div>
          <span style={{ fontSize: 'var(--fs-form-label)' }}>{t('labelPacDaToccare')}</span>
          <ListaSpuntabile
            opzioni={pacDisponibili}
            selezionati={pacSelezionati}
            onCambia={(id, spuntato) => setPacSelezionati((prev) => (spuntato ? [...prev, id] : prev.filter((x) => x !== id)))}
            alertVuoto={t('alertNessunPac')}
          />
        </div>
      )}
      <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Checkbox checked={valutaEsclusionePac} onChange={setValutaEsclusionePac} label={t('domandaEscludiPac')} />
        <p style={{ fontSize: 'var(--fs-form-hint)', color: 'var(--text-muted)', margin: 0 }}>{t('hintPacDaEscludere')}</p>
        {valutaEsclusionePac && (
          <ListaSpuntabile
            opzioni={pacDisponibili}
            selezionati={pacEsclusi}
            onCambia={(id, spuntato) => setPacEsclusi((prev) => (spuntato ? [...prev, id] : prev.filter((x) => x !== id)))}
            alertVuoto={t('alertNessunPac')}
          />
        )}
      </div>
    </div>,
    <PassoEsecuzione key="esecuzione" valore={nomeSimulazione} onCambia={setNomeSimulazione} />,
  ]

  const ultimoPasso = indice === passi.length - 1

  return (
    <div>
      <Sezione>
        <button type="button" onClick={() => { reset(); setAperto(true) }} style={stileBottonePrimario}>
          {t('bottoneAvviaRibilanciamento')}
        </button>
      </Sezione>

      <WizardRibilanciamento
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        titolo={t('wizardTitoloPortafoglio')}
        passi={passi}
        indiceCorrente={indice}
        onIndietro={() => setIndice((i) => Math.max(0, i - 1))}
        onAvanti={() => setIndice((i) => Math.min(passi.length - 1, i + 1))}
        onCalcola={handleCalcola}
        inCalcolo={inCalcolo}
        puoAvanzare={!ultimoPasso || nomeSimulazione.trim().length > 0}
        mostraAnnullaAccantoAvanti={indice === 0 && storico.length >= MAX_SIMULAZIONI_STORICO}
      >
        {passoCorrenteContenuto[indice]}
      </WizardRibilanciamento>

      {errore && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginTop: 12 }}>{errore}</p>}

      <OverlayRisultatoSimulazione
        aperto={risultato !== null}
        onChiudi={() => setRisultato(null)}
        nomeSimulazione={nomeRisultato}
        onEsportaPdf={() => {
          if (!risultato) return
          esportaSimulazionePdf(
            costruisciContenutoPdf(risultato, nomeRisultato, dataOraRisultato, t, tPaginaFiscalita, tPaginaStorico, tCategorie, locale)
          )
        }}
      >
        {risultato && (() => {
          // Layout a blocchi (Riepilogo + avviso/successo + "Da dove
          // arrivano i soldi" numerato): per lo scenario "limite
          // strutturale" e per un ribilanciamento riuscito (esito
          // "raggiunto", con un versamento effettivo — non il caso "già in
          // soglia" senza nulla da versare). Sono mutuamente esclusivi
          // (avvisoStrutturale con categorie non vuote implica un esito
          // "residuo", mai "raggiunto"). Per ogni altro esito resta il
          // rendering semplice, invariato.
          const strutturale = !!(risultato.avvisoStrutturale && risultato.avvisoStrutturale.categorie.length > 0)
          // Estratto in un'unica espressione (non un booleano derivato a
          // parte) perché è qui che TypeScript restringe risultato.risultato
          // al ramo "raggiunto" del tipo unione — da qui in poi si leggono
          // solo i suoi campi (massimoPac, soloLibere, budgetMinimo), mai da
          // risultato.risultato direttamente.
          const risultatoRaggiunto = risultato.risultato.esito === 'raggiunto' ? risultato.risultato : null
          const unicaSuccesso = risultatoRaggiunto ? (risultatoRaggiunto.massimoPac ?? risultatoRaggiunto.soloLibere) : null
          const successo = risultatoRaggiunto !== null && risultatoRaggiunto.budgetMinimo >= IMPORTO_MINIMO && !!unicaSuccesso
          // Stessa fonte di AvvisoSuccessoVista/PDF (importoVersamentoSufficiente,
          // condivisa da risultato-portafoglio.tsx): il tetto impostato
          // dall'utente se è bastato da solo, altrimenti il pool con
          // vendite/riscatti, altrimenti il budget minimo puro.
          const versamentoTotaleSuccesso =
            successo && risultatoRaggiunto
              ? importoVersamentoSufficiente(risultato.versamentoMassimo, risultato.poolTotale, risultatoRaggiunto.budgetMinimo)
              : 0
          // Categorie che ricevono davvero un acquisto (stesso filtro
          // IMPORTO_MINIMO di TabellaSoluzione in risultato-portafoglio.tsx),
          // non tutte le categorie del portafoglio.
          const categorieCoinvolteSuccesso = unicaSuccesso
            ? unicaSuccesso.righe.filter((r) => r.acquisto >= IMPORTO_MINIMO).map((r) => r.categoria)
            : []
          const haVendite = risultato.venditeProposte.length > 0
          const haRiscatti = risultato.riscattiProposti.length > 0
          const numeroVendite = 1
          const numeroRiscatti = haVendite ? 2 : 1

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {strutturale && (
                <>
                  <RiepilogoVista
                    versamentoTotale={risultato.risultato.esito === 'residuo' ? risultato.risultato.soluzione.versamento : 0}
                    conVendite={haVendite}
                    conRiscatti={haRiscatti}
                    scostamentoResiduoPp={risultato.risultato.esito === 'residuo' ? risultato.risultato.soluzione.scostamentoMassimoPp : 0}
                    soglia={risultato.soglia ?? 3}
                    categorieCoinvolte={risultato.avvisoStrutturale!.categorie}
                  />
                  <AvvisoStrutturaleVista avvisoStrutturale={risultato.avvisoStrutturale} senzaVeicolo={risultato.risultato.senzaVeicolo} />
                </>
              )}

              {successo && (
                <>
                  <RiepilogoVista
                    // A differenza di AvvisoSuccessoVista qui sotto (che
                    // conferma "il TUO versamento impostato basta"), questa
                    // card riporta quanto la simulazione ha calcolato come
                    // davvero necessario — mai il tetto impostato in fase di
                    // setup: budgetMinimo, non versamentoTotaleSuccesso.
                    // Stesso principio del blocco "strutturale" qui sopra,
                    // che per lo stesso motivo usa soluzione.versamento (il
                    // totale della soluzione calcolata) e non un valore
                    // d'ingresso dell'utente.
                    versamentoTotale={risultatoRaggiunto!.budgetMinimo}
                    conVendite={haVendite}
                    conRiscatti={haRiscatti}
                    scostamentoResiduoPp={unicaSuccesso!.scostamentoMassimoPp}
                    soglia={risultato.soglia ?? 3}
                    categorieCoinvolte={categorieCoinvolteSuccesso}
                    successo
                  />
                  <AvvisoSuccessoVista
                    versamentoTotale={versamentoTotaleSuccesso}
                    budgetMinimo={risultatoRaggiunto!.budgetMinimo}
                    locale={locale}
                  />
                </>
              )}

              {(haVendite || haRiscatti) && (
                <Sezione chiara>
                  <div style={stileTitoloBlocco}>{t('titoloDaDoveArrivanoISoldi')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
                    {haVendite && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Numero valore={numeroVendite} />
                          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{t('titoloVenditeProposte')}</div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaPosizioneVenduta')}</th>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaStorico('colonnaQuantita')}</th>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaValore')}</th>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaPlusMinusLorda')}</th>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaAliquota')}</th>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaTassa')}</th>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaNetto')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {risultato.venditeProposte.map((v) => (
                              <tr key={v.strumentoId} className="tabella-riga">
                                <td style={{ padding: 8 }}>{v.nome}</td>
                                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>{formatNumero(v.quantitaVenduta, 6, false, locale)}</td>
                                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>{formatEuro(v.valoreVenduto, locale)}</td>
                                <td
                                  style={{
                                    padding: 8,
                                    fontFamily: 'var(--font-plex-mono)',
                                    color: v.plusvalenzaLorda >= 0 ? 'var(--success)' : 'var(--danger)',
                                  }}
                                >
                                  {formatEuroSigned(v.plusvalenzaLorda, locale)}
                                </td>
                                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>{formatPercent(v.aliquota * 100, 1, false, locale)}</td>
                                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>{formatEuro(v.tassa, locale)}</td>
                                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)', fontWeight: 600 }}>{formatEuro(v.proventoNetto, locale)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {haRiscatti && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Numero valore={numeroRiscatti} />
                          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{t('titoloRiscattiProposti')}</div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaPolizza')}</th>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{tPaginaFiscalita('colonnaValore')}</th>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaImponibile')}</th>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaTassa')}</th>
                              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaNetto')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {risultato.riscattiProposti.map((r) => (
                              <tr key={r.contenitoreId} className="tabella-riga">
                                <td style={{ padding: 8 }}>{r.nome}</td>
                                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>{formatEuro(r.valoreAttuale, locale)}</td>
                                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>{formatEuro(r.imponibile, locale)}</td>
                                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)' }}>{formatEuro(r.tassa, locale)}</td>
                                <td style={{ padding: 8, fontFamily: 'var(--font-plex-mono)', fontWeight: 600 }}>{formatEuro(r.proventoNetto, locale)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', margin: 0 }}>
                          {t('notaPolizzaEsclusaDalleVendite')}
                        </p>
                      </div>
                    )}

                    {risultato.poolTotale !== null && (
                      <p style={{ fontSize: 'var(--fs-body)', margin: 0 }}>
                        {t.rich('messaggioPoolReinvestire', {
                          importo: formatEuro(risultato.poolTotale, locale),
                          strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                      </p>
                    )}
                  </div>
                </Sezione>
              )}

              <RisultatoPortafoglioVista risultato={risultato.risultato} avvisoStrutturale={risultato.avvisoStrutturale} />

              <NoteConclusiveVista pacEsclusi={risultato.pacEsclusi ?? []} />
            </div>
          )
        })()}
      </OverlayRisultatoSimulazione>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginBottom: 12 }}>{t('titoloUltimeSimulazioni')}</h3>
        <StoricoSimulazioni
          righe={storico.map((s) => rigaVista(s, locale, t))}
          onSeleziona={(id) => {
            const riga = storico.find((s) => s.id === id)
            if (!riga) return
            setRisultato(riga.risultato as RisultatoSimulazionePortafoglio)
            setNomeRisultato(riga.nome)
            setDataOraRisultato(riga.creato_at)
          }}
          onEsportaPdf={(id) => {
            const riga = storico.find((s) => s.id === id)
            if (!riga) return
            esportaSimulazionePdf(
              costruisciContenutoPdf(
                riga.risultato as RisultatoSimulazionePortafoglio,
                riga.nome,
                riga.creato_at,
                t,
                tPaginaFiscalita,
                tPaginaStorico,
                tCategorie,
                locale
              )
            )
          }}
          onRinominato={(id, nuovoNome) => setStorico((prev) => prev.map((s) => (s.id === id ? { ...s, nome: nuovoNome } : s)))}
          onEliminato={(id) => setStorico((prev) => prev.filter((s) => s.id !== id))}
        />
      </div>
    </div>
  )
}
