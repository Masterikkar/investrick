'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Modale } from '@/components/modale'
import { MenuSelect } from '@/components/menu-select'
import { formatData, type LocaleFormato } from '@/lib/format'
import { ETICHETTA_OPERAZIONE } from '@/lib/operazioni'
import { CHIAVE_TRADUZIONE_OPERAZIONE } from '@/lib/i18n-tipi-operazione'
import { modificaTransazione } from '../account/data-management/transactions/actions'
import {
  CODICI_OPERAZIONE,
  stileBottonePrimario,
  stileCampo,
  stileErroreCampo,
  stileEtichetta,
} from '../account/data-management/transactions/nuova-transazione'
import type { RigaStoricoTransazione } from './storico-transazioni'

type Gruppo = { id: string; nome: string; tipo: string }

// Popup di modifica di una transazione dello Storico. Strumento e categoria
// restano quelli della riga (solo mostrati): "Costo (in contanti)" è
// l'unica operazione senza strumento e il database non permette di passare da
// o verso di essa (transazioni_strumento_coerente).
export function ModificaTransazione({
  riga,
  contenitori,
  onChiudi,
  onSalvata,
}: {
  riga: RigaStoricoTransazione
  contenitori: Gruppo[]
  onChiudi: () => void
  onSalvata: () => void
}) {
  const t = useTranslations('PaginaStorico')
  const tGestioneTransazioni = useTranslations('PaginaGestioneTransazioni')
  const tTipiOperazione = useTranslations('TipiOperazione')
  const tContenitori = useTranslations('Contenitori')
  const tPaginaFiscalita = useTranslations('PaginaFiscalita')
  const locale = useLocale() as LocaleFormato
  const [inCorso, startTransition] = useTransition()

  const [data, setData] = useState(riga.data)
  const [operazione, setOperazione] = useState(riga.operazione)
  const [contenitoreId, setContenitoreId] = useState(riga.contenitore_id ?? '')
  const [quantita, setQuantita] = useState(String(riga.quantita))
  const [prezzoUnitario, setPrezzoUnitario] = useState(String(riga.prezzo_unitario))
  const [commissione, setCommissione] = useState(String(riga.commissione))
  const [tassaTrattenuta, setTassaTrattenuta] = useState(String(riga.tassa_trattenuta))
  const [errori, setErrori] = useState<Record<string, string>>({})
  const [erroreSalvataggio, setErroreSalvataggio] = useState(false)

  const eCostoContanti = riga.operazione === 'Costo_contanti'

  function etichettaOperazione(codice: string): string {
    const etichettaItaliana = ETICHETTA_OPERAZIONE[codice] ?? codice
    const chiave = CHIAVE_TRADUZIONE_OPERAZIONE[etichettaItaliana]
    return chiave ? tTipiOperazione(chiave) : etichettaItaliana
  }

  // "Costo (in contanti)" non è offerta come destinazione (né come origine
  // modificabile): vedi il commento sul componente.
  const opzioniOperazioni = (eCostoContanti ? ['Costo_contanti'] : CODICI_OPERAZIONE.filter((c) => c !== 'Costo_contanti')).map(
    (codice) => ({ value: codice, label: etichettaOperazione(codice) })
  )

  const opzioniGruppo = [
    { value: '', label: tContenitori('nessunGruppo') },
    ...contenitori.map((c) => ({ value: c.id, label: c.nome })),
  ]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErroreSalvataggio(false)

    const nuoviErrori: Record<string, string> = {}
    // Stesso vincolo del database (vincola_scambio_solo_polizza), per un errore
    // chiaro sul campo invece di quello generico dopo l'invio.
    if (
      (operazione === 'Scambio_cessione' || operazione === 'Scambio_acquisizione') &&
      contenitori.find((c) => c.id === contenitoreId)?.tipo !== 'Polizza'
    ) {
      nuoviErrori.contenitore_id = tGestioneTransazioni('erroreScambioSoloPolizza')
    }
    if (!(Number(quantita) > 0)) {
      nuoviErrori.quantita = tGestioneTransazioni('erroreQuantitaNonValida', { valore: quantita })
    }
    if (!data) {
      nuoviErrori.data = tGestioneTransazioni('erroreDataNonValida', { valore: data })
    }

    setErrori(nuoviErrori)
    if (Object.keys(nuoviErrori).length > 0) return

    startTransition(async () => {
      const risultato = await modificaTransazione(riga.id, {
        data,
        operazione,
        contenitoreId: contenitoreId || null,
        quantita: Number(quantita),
        prezzoUnitario: Number(prezzoUnitario || 0),
        commissione: Number(commissione || 0),
        tassaTrattenuta: Number(tassaTrattenuta || 0),
      })
      if ('errore' in risultato) {
        setErroreSalvataggio(true)
      } else {
        onSalvata()
      }
    })
  }

  return (
    <Modale aperto onChiudi={onChiudi} titolo={t('modaleTitoloModificaTransazione')}>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-primary)' }}
      >
        <div style={{ fontSize: 'var(--fs-form-hint)', color: 'var(--text-secondary)' }}>
          {tPaginaFiscalita('colonnaPosizione')}:{' '}
          <span style={{ color: 'var(--text-primary)' }}>
            {riga.strumento_nome !== '—' ? riga.strumento_nome : etichettaOperazione(riga.operazione)}
          </span>
          {' · '}
          {formatData(riga.data, locale)}
        </div>

        <label style={stileEtichetta}>
          {t('colonnaOperazione')}
          <div style={{ marginTop: 4 }}>
            <MenuSelect value={operazione} onChange={setOperazione} options={opzioniOperazioni} disabled={eCostoContanti} />
          </div>
        </label>

        <label style={stileEtichetta}>
          {tContenitori('colonnaGruppo')}
          <div style={{ marginTop: 4 }}>
            <MenuSelect
              value={contenitoreId}
              onChange={(v) => {
                setContenitoreId(v)
                setErrori((prev) => ({ ...prev, contenitore_id: '' }))
              }}
              options={opzioniGruppo}
            />
          </div>
          {errori.contenitore_id && <p style={stileErroreCampo}>{errori.contenitore_id}</p>}
        </label>

        <label style={stileEtichetta}>
          {tPaginaFiscalita('colonnaData')}
          <input type="date" required value={data} onChange={(e) => setData(e.target.value)} style={stileCampo} />
          {errori.data && <p style={stileErroreCampo}>{errori.data}</p>}
        </label>

        <label style={stileEtichetta}>
          {t('colonnaQuantita')}
          <input
            type="number"
            step="any"
            min={0}
            required
            value={quantita}
            onChange={(e) => setQuantita(e.target.value)}
            style={stileCampo}
          />
          {errori.quantita && <p style={stileErroreCampo}>{errori.quantita}</p>}
        </label>

        <label style={stileEtichetta}>
          {tGestioneTransazioni('labelPrezzoUnitarioEuro')}
          <input
            type="number"
            step="any"
            min={0}
            required
            value={prezzoUnitario}
            onChange={(e) => setPrezzoUnitario(e.target.value)}
            style={stileCampo}
          />
        </label>

        <label style={stileEtichetta}>
          {tGestioneTransazioni('labelCommissioneEuro')}
          <input
            type="number"
            step="any"
            min={0}
            value={commissione}
            onChange={(e) => setCommissione(e.target.value)}
            style={stileCampo}
          />
        </label>

        <label style={stileEtichetta}>
          {tGestioneTransazioni('labelTassaTrattenutaEuro')}
          <input
            type="number"
            step="any"
            min={0}
            value={tassaTrattenuta}
            onChange={(e) => setTassaTrattenuta(e.target.value)}
            style={stileCampo}
          />
        </label>

        {erroreSalvataggio && <p style={{ ...stileErroreCampo, margin: 0 }}>{tGestioneTransazioni('erroreRiprova')}</p>}

        <button type="submit" disabled={inCorso} style={{ ...stileBottonePrimario, opacity: inCorso ? 0.6 : 1 }}>
          {tGestioneTransazioni('bottoneSalvaTransazione')}
        </button>
      </form>
    </Modale>
  )
}
