'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatEuro, formatEuroSigned, formatNumero, formatPercent, type LocaleFormato } from '@/lib/format'
import { Sezione } from '@/components/sezione'
import { MenuSelect } from '@/components/menu-select'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { WizardRibilanciamento, type PassoWizard } from './wizard-ribilanciamento'
import { PassoSogliaVersamento, PassoCommissioniVendita, PassoVendiInPerdita, PassoEsecuzione } from './passi-comuni'
import { StoricoSimulazioni, type RigaStoricoVista } from './storico-simulazioni'
import { OverlayRisultatoSimulazione } from './overlay-risultato-simulazione'
import { esportaSimulazionePdf, testoDaRich, type SezionePdf } from './esporta-pdf'
import { eseguiSimulazioneGruppo, leggiUltimeSimulazioniGruppo, type RigaStoricoSimulazione } from './actions-simulazione'
import { MAX_SIMULAZIONI_STORICO, type RisultatoSimulazioneGruppo } from '@/lib/ribilanciamento-simulazione'

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

function fmtDataOra(iso: string, locale: LocaleFormato) {
  const d = new Date(iso)
  return `${d.toLocaleDateString(locale)} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
}

// Come rigaVista in simulatore-portafoglio.tsx, ma sul risultato "gruppo"
// (sufficiente: booleano, non un esito a tre stati) — mappature diverse,
// stessa forma in uscita: la card non lo sa.
function rigaVista(s: RigaStoricoSimulazione, locale: LocaleFormato, t: (chiave: string) => string): RigaStoricoVista {
  const risultato = s.risultato as Exclude<RisultatoSimulazioneGruppo, null>
  const badge = risultato.sufficiente
    ? { testo: t('badgeSimulazioneRaggiunto'), colore: 'var(--success)', sfondo: 'rgba(52,199,123,0.15)' }
    : { testo: t('badgeSimulazioneInsufficiente'), colore: 'var(--warning)', sfondo: 'rgba(232,162,59,0.15)' }
  return {
    id: s.id,
    nome: s.nome,
    dataOra: fmtDataOra(s.creato_at, locale),
    importo: formatEuro(risultato.versamentoUsato, locale),
    badgeTesto: badge.testo,
    badgeColore: badge.colore,
    badgeSfondo: badge.sfondo,
  }
}

// Stesso booleano usato da rigaVista qui sopra per il badge della mini-card
// — qui tradotto nel vocabolario successo/avviso/pericolo del PDF.
function distintivoGruppo(sufficiente: boolean, t: Traduttore) {
  return sufficiente
    ? { testo: t('badgeSimulazioneRaggiunto'), tono: 'successo' as const }
    : { testo: t('badgeSimulazioneInsufficiente'), tono: 'avviso' as const }
}

// Stessa idea di costruisciContenutoPdf in simulatore-portafoglio.tsx, sul
// risultato "gruppo": stesso ordine di sezioni dell'overlay a schermo.
function costruisciContenutoPdf(
  risultato: Exclude<RisultatoSimulazioneGruppo, null>,
  nome: string,
  nomeGruppo: string,
  dataOraIso: string,
  t: Traduttore,
  tPaginaFiscalita: Traduttore,
  tPaginaStorico: Traduttore,
  tPaginaCosti: Traduttore,
  tPaginaContenitore: Traduttore,
  tCategorie: Traduttore,
  locale: LocaleFormato
) {
  const sezioni: SezionePdf[] = []

  sezioni.push({
    tipo: 'paragrafo',
    testo: testoDaRich(
      t.rich('messaggioBudgetNecessario', { importo: formatEuro(risultato.necessario, locale), strong: (chunks: unknown) => chunks })
    ),
  })

  if (risultato.sufficiente) {
    sezioni.push({
      tipo: 'casella',
      tono: 'successo',
      testo: t('messaggioVersamentoSufficiente', { importo: formatEuro(risultato.versamentoUsato, locale) }),
    })
  } else {
    sezioni.push({
      tipo: 'casella',
      tono: 'avviso',
      testo: t('messaggioVersamentoInsufficiente', { importo: formatEuro(risultato.versamentoUsato, locale) }),
    })

    if (risultato.venditeProposte.length === 0) {
      sezioni.push({ tipo: 'paragrafo', tono: 'secondario', testo: t('alertNessunCompartoSovrappesato') })
    } else {
      sezioni.push({
        tipo: 'tabella',
        colonne: [
          { intestazione: tPaginaFiscalita('colonnaStrumento') },
          { intestazione: tPaginaStorico('colonnaQuantita'), allineaDestra: true },
          { intestazione: tPaginaFiscalita('colonnaValore'), allineaDestra: true },
          { intestazione: t('colonnaPlusMinusLorda'), allineaDestra: true },
          { intestazione: t('colonnaAliquota'), allineaDestra: true },
          { intestazione: t('colonnaTassa'), allineaDestra: true },
          { intestazione: t('colonnaNetto'), allineaDestra: true },
        ],
        righe: risultato.venditeProposte.map((v) => [
          v.nome,
          v.vincoloRispettato
            ? formatNumero(v.quantitaVenduta, 6, false, locale)
            : `${formatNumero(v.quantitaVenduta, 6, false, locale)} — ${t('notaQuantitaRidotta', { quantita: formatNumero(v.quantitaIdeale, 6, false, locale) })}`,
          formatEuro(v.valoreVenduto, locale),
          { testo: formatEuroSigned(v.plusvalenzaLorda, locale), tono: v.plusvalenzaLorda >= 0 ? ('successo' as const) : ('pericolo' as const) },
          v.imponibile ? formatPercent(v.aliquota * 100, 1, false, locale) : t('esenteTipoContenitore', { tipo: tPaginaContenitore('etichettaPolizza') }),
          formatEuro(v.tassa, locale),
          formatEuro(v.proventoNetto, locale),
        ]),
      })
    }

    sezioni.push({
      tipo: 'paragrafo',
      testo: testoDaRich(
        t.rich('messaggioPoolReinvestire', { importo: formatEuro(risultato.poolTotale, locale), strong: (chunks: unknown) => chunks })
      ),
    })
  }

  if (risultato.allocazioneAcquisto.length > 0) {
    sezioni.push({ tipo: 'sottotitolo', testo: t('titoloAcquistiProposti') })
    sezioni.push({
      tipo: 'tabella',
      colonne: [
        { intestazione: tPaginaCosti('colonnaCategoria') },
        { intestazione: t('colonnaDaVersare'), allineaDestra: true },
        { intestazione: t('colonnaPesoFinale'), allineaDestra: true },
        { intestazione: t('colonnaScostamentoFinale'), allineaDestra: true },
      ],
      righe: risultato.allocazioneAcquisto.map((a) => [
        traduciCategoria(tCategorie, a.categoria),
        formatEuro(a.importo, locale),
        formatPercent(a.pesoFinalePct, 2, false, locale),
        `${formatNumero(a.scostamentoFinalePp, 2, true, locale)} pp`,
      ]),
    })

    for (const c of risultato.allocazioneStrumenti) {
      const nota = c.usaTarget ? t('notaSecondoTargetStrumento') : t('notaSecondoPesiAttuali')
      sezioni.push({ tipo: 'sottotitolo', testo: `${traduciCategoria(tCategorie, c.categoria)} (${nota})` })
      if (c.strumenti.length === 0) {
        sezioni.push({ tipo: 'paragrafo', tono: 'avviso', testo: t('alertNessunoStrumentoPosseduto') })
      } else {
        sezioni.push({
          tipo: 'lista',
          voci: c.strumenti.map((s) => `${s.nome}${s.ticker ? ` (${s.ticker})` : ''}: ${formatEuro(s.importo, locale)}`),
        })
      }
    }
  }

  return {
    nome,
    sottotitolo: `${t('wizardTitoloGruppo')} · ${nomeGruppo} — ${fmtDataOra(dataOraIso, locale)}`,
    distintivo: distintivoGruppo(risultato.sufficiente, t),
    sezioni,
  }
}

export function SimulatoreGruppo({ contenitoriDisponibili }: { contenitoriDisponibili: [string, string][] }) {
  const t = useTranslations('PaginaRibilanciamento')
  const tContenitori = useTranslations('Contenitori')
  const tPaginaFiscalita = useTranslations('PaginaFiscalita')
  const tPaginaStorico = useTranslations('PaginaStorico')
  const tPaginaCosti = useTranslations('PaginaCosti')
  const tPaginaContenitore = useTranslations('PaginaContenitore')
  const tCategorie = useTranslations('Categorie')
  const locale = useLocale() as LocaleFormato

  const [contenitoreId, setContenitoreId] = useState('')
  const [aperto, setAperto] = useState(false)
  const [indice, setIndice] = useState(0)
  const [inCalcolo, setInCalcolo] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const [sogliaImpostata, setSogliaImpostata] = useState(false)
  const [sogliaValore, setSogliaValore] = useState('')
  const [commissione, setCommissione] = useState('')
  const [forzaVendita, setForzaVendita] = useState(false)
  const [nomeSimulazione, setNomeSimulazione] = useState('')

  const [risultato, setRisultato] = useState<RisultatoSimulazioneGruppo>(null)
  // Vedi il commento analogo in simulatore-portafoglio.tsx: nome/data mostrati
  // in testa all'overlay, distinti da nomeSimulazione perché una simulazione
  // riaperta dallo storico può avere nome/data diversi dall'ultimo giro nel
  // wizard.
  const [nomeRisultato, setNomeRisultato] = useState('')
  const [dataOraRisultato, setDataOraRisultato] = useState('')
  const [storico, setStorico] = useState<RigaStoricoSimulazione[]>([])

  // Azzera risultato e storico al cambio di gruppo durante il render (non in
  // un effect: eslint-plugin-react-hooks segnala un setState sincrono e
  // incondizionato nel corpo di un effect come possibile causa di render a
  // cascata). L'effect resta solo per il vero side-effect: leggere lo
  // storico del nuovo gruppo da Supabase.
  const [ultimoContenitoreId, setUltimoContenitoreId] = useState(contenitoreId)
  if (contenitoreId !== ultimoContenitoreId) {
    setUltimoContenitoreId(contenitoreId)
    setRisultato(null)
    setNomeRisultato('')
    setDataOraRisultato('')
    setStorico([])
  }

  useEffect(() => {
    if (!contenitoreId) return
    leggiUltimeSimulazioniGruppo(contenitoreId).then(setStorico)
  }, [contenitoreId])

  const opzioniContenitore = [
    { value: '', label: t('optionSeleziona') },
    ...contenitoriDisponibili.map(([id, nome]) => ({ value: id, label: nome })),
  ]

  const passi: PassoWizard[] = [
    { id: 'soglia', titolo: t('stepSogliaVersamento') },
    { id: 'commissioni', titolo: t('stepCommissioniVendita') },
    { id: 'perdita', titolo: t('stepVendiInPerdita') },
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
    const esito = await eseguiSimulazioneGruppo(nomeSimulazione, {
      contenitoreId,
      versamentoMassimo: sogliaImpostata && sogliaValore ? Number(sogliaValore) : null,
      commissioneVendita: commissione ? Number(commissione) : 0,
      forzaVendita,
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

  const nomeGruppoSelezionato = contenitoriDisponibili.find(([id]) => id === contenitoreId)?.[1] ?? ''

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
    <PassoEsecuzione key="esecuzione" valore={nomeSimulazione} onCambia={setNomeSimulazione} />,
  ]

  const ultimoPasso = indice === passi.length - 1

  return (
    <div>
      <Sezione>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 240 }}>
            <label style={{ fontSize: 'var(--fs-form-label)' }}>
              {tContenitori('colonnaGruppo')}
              <div style={{ marginTop: 4 }}>
                <MenuSelect value={contenitoreId} onChange={setContenitoreId} options={opzioniContenitore} />
              </div>
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              reset()
              setAperto(true)
            }}
            disabled={!contenitoreId}
            style={{ ...stileBottonePrimario, opacity: contenitoreId ? 1 : 0.6, cursor: contenitoreId ? 'pointer' : 'default' }}
          >
            {t('bottoneAvviaRibilanciamento')}
          </button>
        </div>
      </Sezione>

      <WizardRibilanciamento
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        titolo={t('wizardTitoloGruppo')}
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
            costruisciContenutoPdf(
              risultato,
              nomeRisultato,
              nomeGruppoSelezionato,
              dataOraRisultato,
              t,
              tPaginaFiscalita,
              tPaginaStorico,
              tPaginaCosti,
              tPaginaContenitore,
              tCategorie,
              locale
            )
          )
        }}
      >
        {risultato && (
          <>
            <p style={{ fontSize: 'var(--fs-body)', margin: 0 }}>
              {t.rich('messaggioBudgetNecessario', {
                importo: formatEuro(risultato.necessario, locale),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>

            {risultato.sufficiente ? (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--success)', fontWeight: 500 }}>
                {t('messaggioVersamentoSufficiente', { importo: formatEuro(risultato.versamentoUsato, locale) })}
              </p>
            ) : (
              <>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warning)', fontWeight: 500 }}>
                  {t('messaggioVersamentoInsufficiente', { importo: formatEuro(risultato.versamentoUsato, locale) })}
                </p>

                {risultato.venditeProposte.length === 0 ? (
                  <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>{t('alertNessunCompartoSovrappesato')}</p>
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
                      {risultato.venditeProposte.map((v) => (
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
                            {v.imponibile ? formatPercent(v.aliquota * 100, 1, false, locale) : t('esenteTipoContenitore', { tipo: tPaginaContenitore('etichettaPolizza') })}
                          </td>
                          <td style={{ padding: 8 }}>{formatEuro(v.tassa, locale)}</td>
                          <td style={{ padding: 8, fontWeight: 500 }}>{formatEuro(v.proventoNetto, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <p style={{ fontSize: 'var(--fs-body)', marginTop: 12 }}>
                  {t.rich('messaggioPoolReinvestire', { importo: formatEuro(risultato.poolTotale, locale), strong: (chunks) => <strong>{chunks}</strong> })}
                </p>
              </>
            )}

            {risultato.allocazioneAcquisto.length > 0 && (
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
                    {risultato.allocazioneAcquisto.map((a) => (
                      <tr key={a.categoria} className="tabella-riga">
                        <td style={{ padding: 8 }}>{traduciCategoria(tCategorie, a.categoria)}</td>
                        <td style={{ padding: 8 }}>{formatEuro(a.importo, locale)}</td>
                        <td style={{ padding: 8 }}>{formatPercent(a.pesoFinalePct, 2, false, locale)}</td>
                        <td style={{ padding: 8 }}>{formatNumero(a.scostamentoFinalePp, 2, true, locale)} pp</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {risultato.allocazioneStrumenti.map((c) => (
                  <div key={c.categoria} style={{ marginTop: 16, fontSize: 'var(--fs-body)' }}>
                    <strong>{traduciCategoria(tCategorie, c.categoria)}</strong>{' '}
                    <span style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)' }}>
                      ({c.usaTarget ? t('notaSecondoTargetStrumento') : t('notaSecondoPesiAttuali')})
                    </span>
                    {c.strumenti.length === 0 ? (
                      <p style={{ color: 'var(--warning)' }}>{t('alertNessunoStrumentoPosseduto')}</p>
                    ) : (
                      <ul>
                        {c.strumenti.map((s) => (
                          <li key={s.nome}>
                            {s.nome} {s.ticker ? `(${s.ticker})` : ''}: {formatEuro(s.importo, locale)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </OverlayRisultatoSimulazione>

      {contenitoreId && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginBottom: 12 }}>{t('titoloUltimeSimulazioni')}</h3>
          <StoricoSimulazioni
            righe={storico.map((s) => rigaVista(s, locale, t))}
            onSeleziona={(id) => {
              const riga = storico.find((s) => s.id === id)
              if (!riga) return
              setRisultato(riga.risultato as RisultatoSimulazioneGruppo)
              setNomeRisultato(riga.nome)
              setDataOraRisultato(riga.creato_at)
            }}
            onEsportaPdf={(id) => {
              const riga = storico.find((s) => s.id === id)
              if (!riga) return
              esportaSimulazionePdf(
                costruisciContenutoPdf(
                  riga.risultato as Exclude<RisultatoSimulazioneGruppo, null>,
                  riga.nome,
                  nomeGruppoSelezionato,
                  riga.creato_at,
                  t,
                  tPaginaFiscalita,
                  tPaginaStorico,
                  tPaginaCosti,
                  tPaginaContenitore,
                  tCategorie,
                  locale
                )
              )
            }}
            onRinominato={(id, nuovoNome) => setStorico((prev) => prev.map((s) => (s.id === id ? { ...s, nome: nuovoNome } : s)))}
            onEliminato={(id) => setStorico((prev) => prev.filter((s) => s.id !== id))}
          />
        </div>
      )}
    </div>
  )
}
