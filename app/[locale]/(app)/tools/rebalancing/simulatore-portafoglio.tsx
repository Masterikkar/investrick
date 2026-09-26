'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatEuro, formatEuroSigned, formatNumero, formatPercent, type LocaleFormato } from '@/lib/format'
import { Sezione } from '@/components/sezione'
import { RisultatoPortafoglioVista } from './risultato-portafoglio'
import { WizardRibilanciamento, type PassoWizard } from './wizard-ribilanciamento'
import { PassoSogliaVersamento, PassoCommissioniVendita, PassoVendiInPerdita } from './passi-comuni'
import { eseguiSimulazionePortafoglio, type RigaStoricoSimulazione } from './actions-simulazione'
import type { RisultatoSimulazionePortafoglio } from '@/lib/ribilanciamento-simulazione'

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
        <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-body)' }}>
          <input
            type="checkbox"
            checked={selezionati.includes(o.id)}
            onChange={(e) => onCambia(o.id, e.target.checked)}
            style={{ accentColor: 'var(--primary)' }}
          />
          {o.nome}
        </label>
      ))}
    </div>
  )
}

function fmtDataOra(iso: string, locale: LocaleFormato) {
  const d = new Date(iso)
  return `${d.toLocaleDateString(locale)} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
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

  const [risultato, setRisultato] = useState<RisultatoSimulazionePortafoglio | null>(null)
  const [storico, setStorico] = useState(storicoIniziale)

  const passi: PassoWizard[] = [
    { id: 'soglia', titolo: t('stepSogliaVersamento') },
    { id: 'commissioni', titolo: t('stepCommissioniVendita') },
    { id: 'perdita', titolo: t('stepVendiInPerdita') },
    { id: 'polizza', titolo: t('stepRiscattoPolizza') },
    { id: 'pac', titolo: t('stepToccaPac') },
  ]

  function reset() {
    setIndice(0)
    setErrore(null)
  }

  async function handleCalcola() {
    setInCalcolo(true)
    setErrore(null)
    const esito = await eseguiSimulazionePortafoglio({
      versamentoMassimo: sogliaImpostata && sogliaValore ? Number(sogliaValore) : null,
      commissioneVendita: commissione ? Number(commissione) : 0,
      forzaVendita,
      valutaRiscattoPolizza: valutaRiscatto,
      modoRiscattoPolizza: modoRiscatto,
      polizzeSelezionate: modoRiscatto === 'manuale' ? polizzeSelezionate : [],
      valutaPac,
      pacSelezionati: valutaPac ? pacSelezionati : [],
    })
    setInCalcolo(false)
    if (!esito.ok) {
      setErrore(t('erroreSimulazione'))
      return
    }
    setRisultato(esito.risultato)
    setAperto(false)
    setStorico((precedente) => [
      { id: crypto.randomUUID(), creato_at: new Date().toISOString(), parametri: null, risultato: esito.risultato },
      ...precedente,
    ].slice(0, 3))
  }

  const passoCorrenteContenuto = [
    <PassoSogliaVersamento
      key="soglia"
      impostata={sogliaImpostata}
      onCambiaImpostata={setSogliaImpostata}
      valore={sogliaValore}
      onCambiaValore={setSogliaValore}
    />,
    <PassoCommissioniVendita key="commissioni" valore={commissione} onCambia={setCommissione} />,
    <PassoVendiInPerdita key="perdita" valore={forzaVendita} onCambia={setForzaVendita} />,
    <div key="polizza" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-form-label)' }}>
        <input
          type="checkbox"
          checked={valutaRiscatto}
          onChange={(e) => setValutaRiscatto(e.target.checked)}
          style={{ accentColor: 'var(--primary)' }}
        />
        {t('domandaRiscattoPolizza')}
      </label>
      {valutaRiscatto && (
        <>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-body)' }}>
              <input
                type="radio"
                name="modo-riscatto"
                checked={modoRiscatto === 'automatico'}
                onChange={() => setModoRiscatto('automatico')}
                style={{ accentColor: 'var(--primary)' }}
              />
              {t('modoRiscattoAutomatico')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-body)' }}>
              <input
                type="radio"
                name="modo-riscatto"
                checked={modoRiscatto === 'manuale'}
                onChange={() => setModoRiscatto('manuale')}
                style={{ accentColor: 'var(--primary)' }}
              />
              {t('modoRiscattoManuale')}
            </label>
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-form-label)' }}>
        <input
          type="checkbox"
          checked={valutaPac}
          onChange={(e) => setValutaPac(e.target.checked)}
          style={{ accentColor: 'var(--primary)' }}
        />
        {t('domandaToccaPac')}
      </label>
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
    </div>,
  ]

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
      >
        {passoCorrenteContenuto[indice]}
      </WizardRibilanciamento>

      {errore && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginTop: 12 }}>{errore}</p>}

      {risultato && (
        <div style={{ marginTop: 16 }}>
          <Sezione>
            {risultato.venditeProposte.length > 0 && (
              <>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warning)', fontWeight: 500 }}>{t('titoloVenditeProposte')}</p>
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
                    {risultato.venditeProposte.map((v) => (
                      <tr key={v.strumentoId} className="tabella-riga">
                        <td style={{ padding: 8 }}>{v.nome}</td>
                        <td style={{ padding: 8 }}>{formatNumero(v.quantitaVenduta, 6, false, locale)}</td>
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
              </>
            )}

            {risultato.riscattiProposti.length > 0 && (
              <>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warning)', fontWeight: 500, marginTop: risultato.venditeProposte.length > 0 ? 24 : 0 }}>
                  {t('titoloRiscattiProposti')}
                </p>
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
                        <td style={{ padding: 8 }}>{formatEuro(r.valoreAttuale, locale)}</td>
                        <td style={{ padding: 8 }}>{formatEuro(r.imponibile, locale)}</td>
                        <td style={{ padding: 8 }}>{formatEuro(r.tassa, locale)}</td>
                        <td style={{ padding: 8, fontWeight: 500 }}>{formatEuro(r.proventoNetto, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {risultato.poolTotale !== null && (
              <p style={{ fontSize: 'var(--fs-body)', marginTop: 12 }}>
                {t.rich('messaggioPoolReinvestire', {
                  importo: formatEuro(risultato.poolTotale, locale),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
            )}

            <p
              style={{
                fontSize: 'var(--fs-card-link)',
                color: 'var(--text-secondary)',
                marginTop: risultato.venditeProposte.length > 0 || risultato.riscattiProposti.length > 0 ? 16 : 0,
                marginBottom: 16,
              }}
            >
              {t('notaPolizzaEsclusaDalleVendite')}
            </p>

            <RisultatoPortafoglioVista
              risultato={risultato.risultato}
              versamentoMassimo={risultato.versamentoMassimo}
              avvisoStrutturale={risultato.avvisoStrutturale}
            />
          </Sezione>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginBottom: 12 }}>{t('titoloUltimeSimulazioni')}</h3>
        {storico.length === 0 ? (
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>{t('nessunaSimulazionePrecedente')}</p>
        ) : (
          <ul style={{ fontSize: 'var(--fs-body)', margin: 0 }}>
            {storico.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setRisultato(s.risultato as RisultatoSimulazionePortafoglio)}
                  className="link-dettaglio"
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
                >
                  {fmtDataOra(s.creato_at, locale)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
