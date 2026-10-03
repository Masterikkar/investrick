'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Modale } from '@/components/modale'
import { MenuSelect } from '@/components/menu-select'
import { formatData, type LocaleFormato } from '@/lib/format'
import { CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA } from '@/lib/i18n-tipi-movimento-liquidita'
import { modificaMovimentoLiquidita } from './actions'
import {
  CODICI_TIPO_MOVIMENTO_LIQUIDITA,
  stileBottonePrimario,
  stileCampo,
  stileErroreCampo,
  stileEtichetta,
} from './nuova-transazione'
import type { RigaStoricoMovimentoLiquidita } from './storico-movimenti-liquidita'

type Gruppo = { id: string; nome: string }

// Popup di modifica di un movimento di liquidità dello Storico. Il conto resta
// quello della riga (solo mostrato).
export function ModificaMovimentoLiquidita({
  movimento,
  contenitori,
  onChiudi,
  onSalvato,
}: {
  movimento: RigaStoricoMovimentoLiquidita
  contenitori: Gruppo[]
  onChiudi: () => void
  // avvisoStorico: salvato, ma lo storico dei grafici non si è aggiornato
  onSalvato: (avvisoStorico: boolean) => void
}) {
  const t = useTranslations('PaginaStorico')
  const tGestioneTransazioni = useTranslations('PaginaGestioneTransazioni')
  const tTipiMovimento = useTranslations('TipiMovimentoLiquidita')
  const tContenitori = useTranslations('Contenitori')
  const tPaginaFiscalita = useTranslations('PaginaFiscalita')
  const locale = useLocale() as LocaleFormato
  const [inCorso, startTransition] = useTransition()

  const [data, setData] = useState(movimento.data)
  const [tipoMovimento, setTipoMovimento] = useState(movimento.tipo_movimento)
  const [contenitoreId, setContenitoreId] = useState(movimento.contenitore_id ?? '')
  const [importo, setImporto] = useState(String(movimento.importo))
  const [tassaTrattenuta, setTassaTrattenuta] = useState(String(movimento.tassa_trattenuta))
  const [errori, setErrori] = useState<Record<string, string>>({})
  const [erroreSalvataggio, setErroreSalvataggio] = useState(false)

  function etichettaTipoMovimento(codice: string): string {
    const chiave = CHIAVE_TRADUZIONE_TIPO_MOVIMENTO_LIQUIDITA[codice]
    return chiave ? tTipiMovimento(chiave) : codice
  }

  const opzioniTipo = CODICI_TIPO_MOVIMENTO_LIQUIDITA.map((codice) => ({
    value: codice,
    label: etichettaTipoMovimento(codice),
  }))

  const opzioniGruppo = [
    { value: '', label: tContenitori('nessunGruppo') },
    ...contenitori.map((c) => ({ value: c.id, label: c.nome })),
  ]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErroreSalvataggio(false)

    const nuoviErrori: Record<string, string> = {}
    if (!(Number(importo) > 0)) {
      nuoviErrori.importo = tGestioneTransazioni('erroreImportoNonValido', { valore: importo })
    }
    if (!data) {
      nuoviErrori.data = tGestioneTransazioni('erroreDataNonValida', { valore: data })
    }

    setErrori(nuoviErrori)
    if (Object.keys(nuoviErrori).length > 0) return

    startTransition(async () => {
      const risultato = await modificaMovimentoLiquidita(movimento.id, {
        data,
        tipoMovimento,
        contenitoreId: contenitoreId || null,
        importo: Number(importo),
        tassaTrattenuta: Number(tassaTrattenuta || 0),
      })
      if ('errore' in risultato) {
        setErroreSalvataggio(true)
      } else {
        onSalvato(Boolean(risultato.avvisoStorico))
      }
    })
  }

  return (
    <Modale aperto onChiudi={onChiudi} titolo={t('modaleTitoloModificaMovimento')}>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-primary)' }}
      >
        <div style={{ fontSize: 'var(--fs-form-hint)', color: 'var(--text-secondary)' }}>
          {tPaginaFiscalita('colonnaPosizione')}: <span style={{ color: 'var(--text-primary)' }}>{movimento.strumento_nome}</span>
          {' · '}
          {formatData(movimento.data, locale)}
        </div>

        <label style={stileEtichetta}>
          {t('colonnaTipoMovimento')}
          <div style={{ marginTop: 4 }}>
            <MenuSelect value={tipoMovimento} onChange={setTipoMovimento} options={opzioniTipo} />
          </div>
        </label>

        <label style={stileEtichetta}>
          {tContenitori('colonnaGruppo')}
          <div style={{ marginTop: 4 }}>
            <MenuSelect value={contenitoreId} onChange={setContenitoreId} options={opzioniGruppo} />
          </div>
        </label>

        <label style={stileEtichetta}>
          {tPaginaFiscalita('colonnaData')}
          <input type="date" required value={data} onChange={(e) => setData(e.target.value)} style={stileCampo} />
          {errori.data && <p style={stileErroreCampo}>{errori.data}</p>}
        </label>

        <label style={stileEtichetta}>
          {tGestioneTransazioni('labelImportoLordoEuro')}
          <input
            type="number"
            step="any"
            min={0}
            required
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            style={stileCampo}
          />
          {errori.importo && <p style={stileErroreCampo}>{errori.importo}</p>}
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
          <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
            {tGestioneTransazioni('hintTassaSoloInteresse', { tipo: etichettaTipoMovimento('Interesse') })}
          </small>
        </label>

        {erroreSalvataggio && <p style={{ ...stileErroreCampo, margin: 0 }}>{tGestioneTransazioni('erroreRiprova')}</p>}

        <button type="submit" disabled={inCorso} style={{ ...stileBottonePrimario, opacity: inCorso ? 0.6 : 1 }}>
          {tGestioneTransazioni('bottoneSalvaTransazione')}
        </button>
      </form>
    </Modale>
  )
}
