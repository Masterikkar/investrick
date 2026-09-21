'use client'

import { useState } from 'react'
import { formatEuro, formatEuroSigned } from '@/lib/format'
import { CardMetrica } from '@/components/card-metrica'
import { BarreDivergenti, type VoceBarra } from '@/components/barre-divergenti'
import { InfoTooltip } from '@/components/info-tooltip'
import { Sezione } from '@/components/sezione'

type RealizzatoAnno = {
  netto_vendite: number
  tasse_vendite: number
}

type RigaInteresse = {
  strumentoId: string
  nome: string
  lordo: number
  tassa: number
  netto: number
}

function LinkDettagli({ aperto, onClick }: { aperto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="link-dettaglio"
      style={{
        fontSize: 'var(--fs-card-link)',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {aperto ? '→ Nascondi dettagli' : '→ Mostra dettagli'}
    </button>
  )
}

export function SezioneAnnoCorrente({
  annoCorrente,
  realizzato,
  vociCategoriaRealizzate,
  vociContenitoreRealizzate,
  totaleMovimentoNonRealizzato,
  vociCategoria,
  vociContenitore,
  totaleInteressiNetti,
  righeInteressi,
}: {
  annoCorrente: number
  realizzato: RealizzatoAnno
  vociCategoriaRealizzate: VoceBarra[]
  vociContenitoreRealizzate: VoceBarra[]
  totaleMovimentoNonRealizzato: number
  vociCategoria: VoceBarra[]
  vociContenitore: VoceBarra[]
  totaleInteressiNetti: number
  righeInteressi: RigaInteresse[]
}) {
  const [dettagliRealizzateAperti, setDettagliRealizzateAperti] = useState(false)
  const [dettagliNonRealizzateAperti, setDettagliNonRealizzateAperti] = useState(false)
  const [dettagliInteressiAperti, setDettagliInteressiAperti] = useState(false)

  return (
    <Sezione>
      <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginBottom: 4 }}>Plus/minusvalenze realizzate</h3>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>
        Plus/minusvalenza realizzata da inizio anno ad oggi.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <CardMetrica label="Realizzate nette" minWidth={220}>
          <span style={{ color: Number(realizzato.netto_vendite) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatEuroSigned(Number(realizzato.netto_vendite))}
          </span>
        </CardMetrica>
        <CardMetrica label="Tasse trattenute" minWidth={220}>
          {formatEuro(Number(realizzato.tasse_vendite))}
        </CardMetrica>
      </div>

      <div style={{ marginTop: 12 }}>
        <LinkDettagli
          aperto={dettagliRealizzateAperti}
          onClick={() => setDettagliRealizzateAperti((a) => !a)}
        />
      </div>

      {dettagliRealizzateAperti && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginBottom: 4 }}>Per categoria</div>
          <BarreDivergenti voci={vociCategoriaRealizzate} />

          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginTop: 20, marginBottom: 4 }}>Per contenitore</div>
          <BarreDivergenti voci={vociContenitoreRealizzate} />
        </div>
      )}

      <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 32, marginBottom: 4 }}>Plus/minusvalenze non realizzate</h3>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>
        Variazione della plus/minusvalenza non realizzata da inizio anno a oggi.
        <InfoTooltip testo="Un valore negativo non indica per forza una perdita: può significare che una plusvalenza non realizzata si è ridotta durante l'anno — ad esempio per vendite parziali della posizione — pur restando positiva." />
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <CardMetrica label={`Totale ${annoCorrente}`} minWidth={220}>
          <span style={{ color: totaleMovimentoNonRealizzato >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatEuroSigned(totaleMovimentoNonRealizzato)}
          </span>
        </CardMetrica>
      </div>

      <div style={{ marginTop: 12 }}>
        <LinkDettagli
          aperto={dettagliNonRealizzateAperti}
          onClick={() => setDettagliNonRealizzateAperti((a) => !a)}
        />
      </div>

      {dettagliNonRealizzateAperti && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginBottom: 4 }}>Per categoria</div>
          <BarreDivergenti voci={vociCategoria} />

          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginTop: 20, marginBottom: 4 }}>Per contenitore</div>
          <BarreDivergenti voci={vociContenitore} />
        </div>
      )}

      <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 32, marginBottom: 4 }}>Interessi maturati</h3>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>
        Interessi maturati da inizio anno ad oggi.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <CardMetrica label={`Totale ${annoCorrente}`} minWidth={220}>
          <span style={{ color: totaleInteressiNetti >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatEuroSigned(totaleInteressiNetti)}
          </span>
        </CardMetrica>
      </div>

      <div style={{ marginTop: 12 }}>
        <LinkDettagli
          aperto={dettagliInteressiAperti}
          onClick={() => setDettagliInteressiAperti((a) => !a)}
        />
      </div>

      {dettagliInteressiAperti && (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: 16,
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-table)',
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-default)' }}>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Strumento</th>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Interesse lordo</th>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Tassa trattenuta</th>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>Interesse netto</th>
            </tr>
          </thead>
          <tbody>
            {righeInteressi.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 8, color: 'var(--text-secondary)' }}>
                  Nessun interesse maturato quest&apos;anno.
                </td>
              </tr>
            ) : (
              righeInteressi.map((riga) => (
                <tr key={riga.strumentoId} className="tabella-riga">
                  <td style={{ padding: 8 }}>{riga.nome}</td>
                  <td style={{ padding: 8 }}>{formatEuro(riga.lordo)}</td>
                  <td style={{ padding: 8 }}>{formatEuro(riga.tassa)}</td>
                  <td style={{ padding: 8, fontWeight: 500 }}>{formatEuro(riga.netto)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </Sezione>
  )
}