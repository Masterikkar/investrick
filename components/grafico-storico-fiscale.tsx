'use client'

import { useLocale, useTranslations } from 'next-intl'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatEuro, type LocaleFormato } from '@/lib/format'

export type PuntoStoricoFiscale = {
  anno: number
  realizzato: number
  nonRealizzato: number
}

const VERDE = '#34C77B'
const ROSSO = '#E5484D'
const OPACITA_NON_REALIZZATO = 0.45
const GRIGLIA = '#2B3350'
const TESTO_ASSI = '#9198AD'

export function GraficoStoricoFiscale({ punti }: { punti: PuntoStoricoFiscale[] }) {
  const t = useTranslations('PaginaFiscalita')
  const locale = useLocale() as LocaleFormato
  if (punti.length === 0) {
    return <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>{t('alertStoricoInsufficiente')}</p>
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={punti} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRIGLIA} />
          <XAxis dataKey="anno" tick={{ fill: TESTO_ASSI, fontSize: 11 }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
          <YAxis tickFormatter={(v) => formatEuro(Number(v), locale)} width={80} tick={{ fill: TESTO_ASSI, fontSize: 11 }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
          <Tooltip
            formatter={(value) => formatEuro(Number(value), locale)}
            cursor={{ fill: '#1A2036', fillOpacity: 0.5 }}
            contentStyle={{ background: '#1A2036', border: '1px solid #2B3350', borderRadius: 0, color: '#E8EBF2' }}
            labelStyle={{ color: '#E8EBF2' }}
            itemStyle={{ color: '#E8EBF2' }}
          />
          <Bar dataKey="realizzato" name={t('labelRealizzateNette')} maxBarSize={36}>
            {punti.map((p, i) => (
              <Cell key={`realizzato-${i}`} fill={p.realizzato >= 0 ? VERDE : ROSSO} />
            ))}
          </Bar>
          <Bar dataKey="nonRealizzato" name={t('serieNonRealizzate')} maxBarSize={36}>
            {punti.map((p, i) => (
              <Cell
                key={`nonrealizzato-${i}`}
                fill={p.nonRealizzato >= 0 ? VERDE : ROSSO}
                fillOpacity={OPACITA_NON_REALIZZATO}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 'var(--fs-form-hint)', color: 'var(--text-secondary)', marginTop: 4 }}>
        {t('legendaGrafico')}
      </p>
    </div>
  )
}