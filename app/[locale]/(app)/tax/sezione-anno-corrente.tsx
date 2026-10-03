'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatEuro, formatEuroSigned, type LocaleFormato } from '@/lib/format'
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
  const t = useTranslations('PaginaFiscalita')
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
      {aperto ? t('linkNascondiDettagli') : t('linkMostraDettagli')}
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
  avvisoNonRealizzato,
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
  // Polizze escluse dal confronto da inizio anno, già formulate come testo.
  avvisoNonRealizzato?: string | null
}) {
  const t = useTranslations('PaginaFiscalita')
  const locale = useLocale() as LocaleFormato
  const [dettagliRealizzateAperti, setDettagliRealizzateAperti] = useState(false)
  const [dettagliNonRealizzateAperti, setDettagliNonRealizzateAperti] = useState(false)
  const [dettagliInteressiAperti, setDettagliInteressiAperti] = useState(false)

  return (
    <Sezione>
      <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginBottom: 4 }}>{t('titoloPlusMinusvalenzeRealizzate')}</h3>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>
        {t('paragrafoRealizzateYtd')}
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <CardMetrica label={t('labelRealizzateNette')} minWidth={220}>
          <span style={{ color: Number(realizzato.netto_vendite) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatEuroSigned(Number(realizzato.netto_vendite), locale)}
          </span>
        </CardMetrica>
        <CardMetrica label={t('labelTasseTrattenute')} minWidth={220}>
          {formatEuro(Number(realizzato.tasse_vendite), locale)}
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
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginBottom: 4 }}>{t('labelPerCategoria')}</div>
          <BarreDivergenti voci={vociCategoriaRealizzate} />

          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginTop: 20, marginBottom: 4 }}>{t('labelPerContenitore')}</div>
          <BarreDivergenti voci={vociContenitoreRealizzate} />
        </div>
      )}

      <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 32, marginBottom: 4 }}>{t('titoloPlusMinusvalenzeNonRealizzate')}</h3>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>
        {t('paragrafoNonRealizzateYtd')}
        <InfoTooltip testo={t('tooltipMovimentoNonRealizzato')} />
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <CardMetrica label={t('labelTotaleAnno', { anno: annoCorrente })} minWidth={220}>
          <span style={{ color: totaleMovimentoNonRealizzato >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatEuroSigned(totaleMovimentoNonRealizzato, locale)}
          </span>
        </CardMetrica>
      </div>

      {avvisoNonRealizzato && (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warning)', marginTop: 12, marginBottom: 0 }}>{avvisoNonRealizzato}</p>
      )}

      <div style={{ marginTop: 12 }}>
        <LinkDettagli
          aperto={dettagliNonRealizzateAperti}
          onClick={() => setDettagliNonRealizzateAperti((a) => !a)}
        />
      </div>

      {dettagliNonRealizzateAperti && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginBottom: 4 }}>{t('labelPerCategoria')}</div>
          <BarreDivergenti voci={vociCategoria} />

          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginTop: 20, marginBottom: 4 }}>{t('labelPerContenitore')}</div>
          <BarreDivergenti voci={vociContenitore} />
        </div>
      )}

      <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 500, marginTop: 32, marginBottom: 4 }}>{t('titoloInteressiMaturati')}</h3>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>
        {t('paragrafoInteressiYtd')}
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <CardMetrica label={t('labelTotaleAnno', { anno: annoCorrente })} minWidth={220}>
          <span style={{ color: totaleInteressiNetti >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatEuroSigned(totaleInteressiNetti, locale)}
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
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaPosizione')}</th>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaInteresseLordo')}</th>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaTassaTrattenuta')}</th>
              <th style={{ padding: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{t('colonnaInteresseNetto')}</th>
            </tr>
          </thead>
          <tbody>
            {righeInteressi.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 8, color: 'var(--text-secondary)' }}>
                  {t('alertNessunInteresseAnno')}
                </td>
              </tr>
            ) : (
              righeInteressi.map((riga) => (
                <tr key={riga.strumentoId} className="tabella-riga">
                  <td style={{ padding: 8 }}>{riga.nome}</td>
                  <td style={{ padding: 8 }}>{formatEuro(riga.lordo, locale)}</td>
                  <td style={{ padding: 8 }}>{formatEuro(riga.tassa, locale)}</td>
                  <td style={{ padding: 8, fontWeight: 500 }}>{formatEuro(riga.netto, locale)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </Sezione>
  )
}