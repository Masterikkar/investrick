'use client'

import { useState, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatData, formatEuro, formatEuroCompatto, formatPercent, type LocaleFormato } from '@/lib/format'

export type PuntoStorico = { data: string; valore: number }

type Periodo = '1G' | '1S' | '1M' | '1A' | 'YTD' | 'SEMPRE'

const PERIODI: Periodo[] = ['1G', '1S', '1M', '1A', 'YTD', 'SEMPRE']

const CHIAVE_LABEL_PERIODO: Record<Periodo, string> = {
  '1G': 'periodoGiorno',
  '1S': 'periodoSettimana',
  '1M': 'periodoMese',
  '1A': 'periodoAnno',
  YTD: 'periodoYtd',
  SEMPRE: 'periodoSempre',
}

const GRIGLIA = '#2B3350'
const TESTO_ASSI = '#9198AD'
const LINEA = '#7C8CFF'

function dataMinimaTeorica(periodo: Periodo, oggi: Date): Date | null {
  if (periodo === 'YTD') return new Date(oggi.getFullYear(), 0, 1)
  if (periodo === '1S' || periodo === '1M' || periodo === '1A') {
    const giorni = { '1S': 7, '1M': 30, '1A': 365 }[periodo]
    const d = new Date(oggi)
    d.setDate(d.getDate() - giorni)
    return d
  }
  return null
}

function filtraPerPeriodo(punti: PuntoStorico[], periodo: Periodo): PuntoStorico[] {
  if (periodo === 'SEMPRE') return punti
  if (periodo === '1G') {
    // Un solo aggiornamento al giorno: "1G" confronta gli ultimi due punti disponibili
    // (oggi vs il giorno prima), non un vero arco di 24 ore.
    return punti.slice(-2)
  }
  const soglia = dataMinimaTeorica(periodo, new Date())
  if (!soglia) return punti
  return punti.filter((p) => new Date(p.data) >= soglia)
}

export function GraficoStorico({
  punti,
  formato = 'euro',
  valoreAttuale,
}: {
  punti: PuntoStorico[]
  formato?: 'euro' | 'percent'
  valoreAttuale?: number
}) {
  const t = useTranslations('GraficoStorico')
  const tPaginaRendimenti = useTranslations('PaginaRendimenti')
  const locale = useLocale() as LocaleFormato
  const [periodo, setPeriodo] = useState<Periodo>('1M')
  const datiFiltrati = useMemo(() => filtraPerPeriodo(punti, periodo), [punti, periodo])

  const rendimentoBadge = useMemo(() => {
    if (formato !== 'percent') return null
    if (periodo === 'SEMPRE') {
      return punti.length > 0 ? punti[punti.length - 1].valore : null
    }
    if (datiFiltrati.length < 2) return null
    return datiFiltrati[datiFiltrati.length - 1].valore - datiFiltrati[0].valore
  }, [formato, periodo, punti, datiFiltrati])

  // Se il periodo scelto (es. "1A", "YTD") teoricamente inizierebbe prima del primo dato
  // storico che abbiamo davvero, lo segnaliamo — invece di far credere che il numero copra
  // un arco più lungo di quello reale.
  const notaDatiParziali = useMemo(() => {
    if (formato !== 'percent' || punti.length === 0) return null
    const soglia = dataMinimaTeorica(periodo, new Date())
    if (!soglia) return null
    const primoDatoReale = new Date(punti[0].data)
    if (primoDatoReale > soglia) {
      return t('notaDatiParziali', {
        data: formatData(primoDatoReale, locale),
        periodo: t(CHIAVE_LABEL_PERIODO[periodo]),
      })
    }
    return null
  }, [formato, periodo, punti, t, locale])

  const formatAsse = formato === 'percent' ? (v: number) => formatPercent(v, 0, false, locale) : (v: number) => formatEuroCompatto(v, locale)
  const formatTooltip =
    formato === 'percent' ? (v: number) => formatPercent(v, 2, true, locale) : (v: number) => formatEuro(v, locale)
  const etichettaTooltip = formato === 'percent' ? tPaginaRendimenti('tooltipRendimento') : t('etichettaTooltipValore')

  return (
    <div>
      {valoreAttuale !== undefined && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <p style={{ fontFamily: 'var(--font-zilla-slab)', fontWeight: 600, fontSize: 'var(--fs-hero)', margin: 0, color: 'var(--text-primary)' }}>
            {formatEuro(valoreAttuale, locale)}
          </p>
          {rendimentoBadge !== null && (
            <span
              style={{
                fontSize: 'var(--fs-hero-badge)',
                fontWeight: 500,
                color: rendimentoBadge >= 0 ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {formatPercent(rendimentoBadge, 2, true, locale)}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        {PERIODI.map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            style={{
              padding: '4px 10px',
              borderRadius: 0,
              border: '1px solid var(--border-default)',
              background: periodo === p ? 'var(--primary)' : 'var(--bg-surface)',
              color: periodo === p ? '#FFFFFF' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--fs-period)',
            }}
          >
            {t(CHIAVE_LABEL_PERIODO[p])}
          </button>
        ))}
      </div>

      {notaDatiParziali && (
        <p style={{ fontSize: 'var(--fs-form-hint)', color: 'var(--warning)', margin: '4px 0 8px' }}>{notaDatiParziali}</p>
      )}

      {punti.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{tPaginaRendimenti('alertNessunoStorico')}</p>
      ) : datiFiltrati.length < 2 ? (
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{t('alertDatiInsufficientiPeriodo')}</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={datiFiltrati} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRIGLIA} />
            <XAxis
              dataKey="data"
              interval="preserveStartEnd"
              tickFormatter={(d) => formatData(d, locale, { day: '2-digit', month: '2-digit' })}
              fontSize={11}
              tick={{ fill: TESTO_ASSI }}
              axisLine={{ stroke: GRIGLIA }}
              tickLine={{ stroke: GRIGLIA }}
            />
            <YAxis tickFormatter={(v) => formatAsse(Number(v))} fontSize={11} width={70} tick={{ fill: TESTO_ASSI }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
            <Tooltip
              formatter={(value) => [formatTooltip(Number(value)), etichettaTooltip]}
              labelFormatter={(label) => (label ? formatData(String(label), locale) : '')}
              cursor={{ stroke: '#2B3350', strokeWidth: 1 }}
              contentStyle={{ background: '#1A2036', border: '1px solid #2B3350', borderRadius: 0, color: '#E8EBF2' }}
              labelStyle={{ color: '#E8EBF2' }}
              itemStyle={{ color: '#E8EBF2' }}
            />
            <Line type="monotone" dataKey="valore" stroke={LINEA} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}