'use client'

import { useState, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatPercent, type LocaleFormato } from '@/lib/format'
import { CHIAVE_TRADUZIONE_CATEGORIA } from '@/lib/i18n-categorie'
import { salvaTarget } from './actions'

const CATEGORIE = ['Azioni', 'Obbligazioni', 'Materie prime', 'Monetario', 'Crypto', 'Multiasset'] as const

type StrumentoConPeso = { id: string; nome: string; ticker: string | null; percentualeIniziale: number }

const stileCampoNumero: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  fontSize: 'var(--fs-form-label)',
}

const stileBottoneEspandi: React.CSSProperties = {
  fontSize: 'var(--fs-button-outline)',
  color: 'var(--text-secondary)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  padding: '6px 12px',
  cursor: 'pointer',
}

export function FormTarget({
  contenitoreId,
  targetAttivoIniziale,
  percentualiIniziali,
  strumentiPerCategoria,
}: {
  contenitoreId: string
  targetAttivoIniziale: boolean
  percentualiIniziali: Record<string, number>
  strumentiPerCategoria: Record<string, StrumentoConPeso[]>
}) {
  const t = useTranslations('FormTarget')
  const tCategorie = useTranslations('Categorie')
  const locale = useLocale() as LocaleFormato
  const [targetAttivo, setTargetAttivo] = useState(targetAttivoIniziale)
  const [percentuali, setPercentuali] = useState<Record<string, number>>(percentualiIniziali)
  const [percentualiStrumento, setPercentualiStrumento] = useState<Record<string, number>>(() => {
    const iniziale: Record<string, number> = {}
    for (const cat of Object.keys(strumentiPerCategoria)) {
      for (const s of strumentiPerCategoria[cat]) {
        iniziale[s.id] = s.percentualeIniziale
      }
    }
    return iniziale
  })
  const [categorieAperte, setCategorieAperte] = useState<Record<string, boolean>>({})

  const somma = useMemo(
    () => CATEGORIE.reduce((acc, cat) => acc + (percentuali[cat] ?? 0), 0),
    [percentuali]
  )

  const sommaOk = Math.abs(somma - 100) < 0.01
  const puoSalvare = !targetAttivo || sommaOk

  function handleChange(categoria: string, valore: string) {
    setPercentuali((prev) => ({ ...prev, [categoria]: valore === '' ? 0 : Number(valore) }))
  }

  function handleChangeStrumento(strumentoId: string, valore: string) {
    setPercentualiStrumento((prev) => ({ ...prev, [strumentoId]: valore === '' ? 0 : Number(valore) }))
  }

  function sommaCategoria(categoria: string) {
    return (strumentiPerCategoria[categoria] ?? []).reduce(
      (acc, s) => acc + (percentualiStrumento[s.id] ?? 0),
      0
    )
  }

  return (
    <form
      action={salvaTarget}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480, color: 'var(--text-primary)' }}
    >
      <input type="hidden" name="contenitore_id" value={contenitoreId} />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-form-label)' }}>
        <input
          type="checkbox"
          name="target_attivo"
          checked={targetAttivo}
          onChange={(e) => setTargetAttivo(e.target.checked)}
          style={{ accentColor: 'var(--primary)' }}
        />
        {t('checkboxTargetAttivo')}
      </label>

      {!targetAttivo && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', margin: 0 }}>
          {t('hintTargetDisattivato')}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {CATEGORIE.map((cat) => {
          const strumentiCategoria = strumentiPerCategoria[cat]
          const haSottotarget = strumentiCategoria && strumentiCategoria.length > 1
          const sommaStrumenti = haSottotarget ? sommaCategoria(cat) : 0
          const sommaStrumentiOk = sommaStrumenti === 0 || Math.abs(sommaStrumenti - 100) < 0.01
          const aperta = categorieAperte[cat] ?? false
          const nomeCategoria = tCategorie(CHIAVE_TRADUZIONE_CATEGORIA[cat])

          return (
            <div key={cat}>
              <label style={{ fontSize: 'var(--fs-form-label)' }}>
                {nomeCategoria}
                <input
                  type="number"
                  name={`percentuale_${cat}`}
                  min="0"
                  max="100"
                  step="any"
                  value={percentuali[cat] ?? 0}
                  onChange={(e) => handleChange(cat, e.target.value)}
                  style={stileCampoNumero}
                />
              </label>

              {haSottotarget && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setCategorieAperte((prev) => ({ ...prev, [cat]: !aperta }))}
                    style={stileBottoneEspandi}
                  >
                    {aperta ? '▾' : '▸'} {t('bottoneTargetPerStrumento', { categoria: nomeCategoria })}
                  </button>

                  {aperta && (
                    <div style={{ marginTop: 8, paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {strumentiCategoria.map((s) => (
                        <label key={s.id} style={{ fontSize: 'var(--fs-form-label)' }}>
                          {s.nome} {s.ticker ? `(${s.ticker})` : ''}
                          <input
                            type="number"
                            name={`sub_${s.id}`}
                            min="0"
                            max="100"
                            step="any"
                            value={percentualiStrumento[s.id] ?? 0}
                            onChange={(e) => handleChangeStrumento(s.id, e.target.value)}
                            style={stileCampoNumero}
                          />
                        </label>
                      ))}
                      <div
                        style={{
                          fontSize: 'var(--fs-form-hint)',
                          color: sommaStrumentiOk ? 'var(--text-secondary)' : 'var(--danger)',
                        }}
                      >
                        {t('labelSommaStrumenti', { somma: formatPercent(sommaStrumenti, 2, false, locale) })}
                        {!sommaStrumentiOk && t('erroreSommaStrumenti')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div
        style={{
          fontSize: 'var(--fs-body)',
          color: targetAttivo ? (sommaOk ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)',
        }}
      >
        {t('labelSommaCategorie', { somma: formatPercent(somma, 2, false, locale) })}
        {targetAttivo && !sommaOk ? t('erroreSommaCategorie') : ''}
      </div>

      <button
        type="submit"
        disabled={!puoSalvare}
        style={{
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          fontSize: 'var(--fs-button)',
          fontWeight: 500,
          cursor: puoSalvare ? 'pointer' : 'not-allowed',
          opacity: puoSalvare ? 1 : 0.4,
          alignSelf: 'flex-start',
        }}
      >
        {t('bottoneSalvaTarget')}
      </button>
    </form>
  )
}