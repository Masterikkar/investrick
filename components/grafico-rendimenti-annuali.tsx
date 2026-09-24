'use client'

import { useLocale, useTranslations } from 'next-intl'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts'
import { formatPercent, type LocaleFormato } from '@/lib/format'

export type RendimentoAnnuale = { anno: number; rendimentoPct: number | null }

const VERDE = '#34C77B'
const ROSSO = '#E5484D'
const GRIGLIA = '#2B3350'
const TESTO_ASSI = '#9198AD'

export function GraficoRendimentiAnnuali({
  rendimentoCumulato,
  rendimentiAnnuali,
}: {
  rendimentoCumulato: number | null
  rendimentiAnnuali: RendimentoAnnuale[]
}) {
  const t = useTranslations('PaginaRendimenti')
  const locale = useLocale() as LocaleFormato
  const dati = rendimentiAnnuali.map((r) => ({
    anno: String(r.anno),
    valore: r.rendimentoPct,
  }))

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)' }}>{t('labelRendimentoCumulato')}</span>
        <div
          style={{
            fontFamily: 'var(--font-zilla-slab)',
            fontWeight: 600,
            fontSize: 'var(--fs-hero-secondario)',
            marginTop: 2,
            color: (rendimentoCumulato ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {rendimentoCumulato != null ? formatPercent(rendimentoCumulato, 2, true, locale) : '—'}
        </div>
      </div>

      {dati.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>{t('alertNessunoStorico')}</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dati}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRIGLIA} />
            <XAxis dataKey="anno" fontSize={11} tick={{ fill: TESTO_ASSI }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
            <YAxis allowDecimals={false} tickFormatter={(v) => formatPercent(Number(v), 0, false, locale)} fontSize={11} width={50} tick={{ fill: TESTO_ASSI }} axisLine={{ stroke: GRIGLIA }} tickLine={{ stroke: GRIGLIA }} />
            <Tooltip
              formatter={(value) => [value != null ? formatPercent(Number(value), 2, true, locale) : '—', t('tooltipRendimento')]}
              cursor={{ fill: '#1A2036', fillOpacity: 0.5 }}
              contentStyle={{ background: '#1A2036', border: '1px solid #2B3350', borderRadius: 0, color: '#E8EBF2' }}
              labelStyle={{ color: '#E8EBF2' }}
              itemStyle={{ color: '#E8EBF2' }}
            />
            <Bar dataKey="valore" radius={0} maxBarSize={48}>
              {dati.map((d, i) => (
                <Cell key={i} fill={(d.valore ?? 0) >= 0 ? VERDE : ROSSO} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}