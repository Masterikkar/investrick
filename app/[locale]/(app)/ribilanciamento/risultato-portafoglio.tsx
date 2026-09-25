'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatEuro, formatNumero, formatPercent, type LocaleFormato } from '@/lib/format'
import { traduciCategoria } from '@/lib/i18n-categorie'
import type { RisultatoPortafoglio, SoluzionePortafoglio } from '@/lib/ribilanciamento'

// Sotto questo importo una voce non si mostra: è rumore numerico, non un acquisto.
const IMPORTO_MINIMO = 0.005

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

const stileTh: React.CSSProperties = { padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }

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
      <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 24, marginBottom: 12 }}>{t('titoloDoveVersare')}</h3>
      {voci.length === 0 ? (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>{t('alertNessunAcquisto')}</p>
      ) : (
        <ul style={{ fontSize: 'var(--fs-body)', margin: 0 }}>
          {voci.map((v) => (
            <li key={v.chiave}>
              {v.nome} <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-card-link)' }}>({v.nota})</span>:{' '}
              <strong>{formatEuro(v.importo, locale)}</strong>
            </li>
          ))}
        </ul>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, color: 'var(--text-primary)', fontSize: 'var(--fs-table)' }}>
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
              <td style={{ padding: 8 }}>{r.targetPct === null ? '—' : formatPercent(r.targetPct, 2, false, locale)}</td>
              <td style={{ padding: 8 }}>
                {formatPercent(totaleAttuale > 0 ? (r.valoreAttuale / totaleAttuale) * 100 : 0, 2, false, locale)}
              </td>
              <td style={{ padding: 8 }}>{formatEuro(r.acquisto, locale)}</td>
              <td style={{ padding: 8 }}>{formatPercent(r.pesoFinalePct, 2, false, locale)}</td>
              <td style={{ padding: 8 }}>
                {r.scostamentoFinalePp === null ? '—' : `${formatNumero(r.scostamentoFinalePp, 2, true, locale)} pp`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export function RisultatoPortafoglioVista({
  risultato,
  versamentoMassimo,
}: {
  risultato: RisultatoPortafoglio
  versamentoMassimo: number | null
}) {
  const t = useTranslations('PaginaRibilanciamento')
  const tCategorie = useTranslations('Categorie')
  const locale = useLocale() as LocaleFormato
  const [quotaPac, setQuotaPac] = useState(100)

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

  const intestazione = (
    <>
      <p style={{ fontSize: 'var(--fs-body)', margin: 0 }}>
        {t.rich('messaggioBudgetPortafoglio', {
          importo: formatEuro(budgetMinimo, locale),
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
      {versamentoMassimo !== null && (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--success)', fontWeight: 500 }}>
          {t('messaggioVersamentoSufficiente', { importo: formatEuro(versamentoMassimo, locale) })}
        </p>
      )}
      {avvisoSenzaVeicolo}
    </>
  )

  if (coincidono || !soloLibere || !massimoPac) {
    return (
      <>
        {intestazione}
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
      {intestazione}

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
