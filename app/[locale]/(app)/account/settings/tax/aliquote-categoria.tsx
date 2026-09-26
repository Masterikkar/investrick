'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { aggiornaAliquotaDefaultCategoria, reimpostaAliquotaCategoria } from './actions-aliquote'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { useConferma } from '@/components/conferma'
import { useNotifica } from '@/components/notifica'

export type CategoriaAliquota = {
  categoria: string
  aliquotaDefault: number
  numeroStrumenti: number
}

const stileBottoneOutline: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  padding: '6px 12px',
  fontSize: 'var(--fs-table)',
  cursor: 'pointer',
}

export function AliquoteCategoria({ categorie }: { categorie: CategoriaAliquota[] }) {
  const t = useTranslations('PaginaGestioneFiscalita')
  const tCategorie = useTranslations('Categorie')
  const tPaginaRibilanciamento = useTranslations('PaginaRibilanciamento')
  const router = useRouter()
  const conferma = useConferma()
  const notifica = useNotifica()

  function etichettaCategoria(categoria: string): string {
    return traduciCategoria(tCategorie, categoria)
  }
  const [valori, setValori] = useState<Record<string, string>>(() =>
    Object.fromEntries(categorie.map((c) => [c.categoria, String(c.aliquotaDefault)]))
  )
  const [pendingCategoria, setPendingCategoria] = useState<string | null>(null)
  const [erroreCategoria, setErroreCategoria] = useState<string | null>(null)
  const [messaggioErrore, setMessaggioErrore] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleSalvaDefault(categoria: string) {
    const nuovoValore = Number(valori[categoria])
    setErroreCategoria(null)
    setMessaggioErrore(null)
    setPendingCategoria(categoria)

    startTransition(async () => {
      const risultato = await aggiornaAliquotaDefaultCategoria(categoria, nuovoValore)
      setPendingCategoria(null)
      if ('errore' in risultato) {
        setErroreCategoria(categoria)
        setMessaggioErrore(risultato.errore)
      } else {
        router.refresh()
      }
    })
  }

  async function handleReimposta(categoria: string, aliquotaDefault: number, numeroStrumenti: number) {
    const confermato = await conferma({
      titolo: t('titoloReimposta'),
      messaggio: t('confermaReimposta', {
        numeroStrumenti: t('numeroStrumenti', { numero: numeroStrumenti }),
        categoria: etichettaCategoria(categoria),
        aliquota: aliquotaDefault,
      }),
      etichettaConferma: t('bottoneReimpostaTutti'),
      pericoloso: true,
    })
    if (!confermato) return

    setErroreCategoria(null)
    setMessaggioErrore(null)
    setPendingCategoria(categoria)

    startTransition(async () => {
      const risultato = await reimpostaAliquotaCategoria(categoria)
      setPendingCategoria(null)
      if ('errore' in risultato) {
        setErroreCategoria(categoria)
        setMessaggioErrore(risultato.errore)
      } else {
        router.refresh()
        notifica({
          messaggio: t('successoReimposta', {
            numeroStrumenti: t('numeroStrumenti', { numero: risultato.aggiornati }),
            categoria: etichettaCategoria(categoria),
          }),
        })
      }
    })
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {categorie.map((c) => {
          const inPending = pendingCategoria === c.categoria
          const valoreCorrente = valori[c.categoria] ?? ''
          const invariato = Number(valoreCorrente) === c.aliquotaDefault

          return (
            <div key={c.categoria} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: 12 }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginBottom: 8 }}>
                {etichettaCategoria(c.categoria)}
              </div>
              <div style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                {t('numeroStrumenti', { numero: c.numeroStrumenti })}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={valoreCorrente}
                  onChange={(e) => setValori((stato) => ({ ...stato, [c.categoria]: e.target.value }))}
                  disabled={inPending}
                  style={{
                    width: 70,
                    padding: '6px 8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--fs-table)',
                  }}
                />
                <span style={{ fontSize: 'var(--fs-table)', color: 'var(--text-secondary)' }}>%</span>
                <button
                  type="button"
                  onClick={() => handleSalvaDefault(c.categoria)}
                  disabled={inPending || invariato}
                  style={{ ...stileBottoneOutline, opacity: inPending || invariato ? 0.5 : 1 }}
                >
                  {tPaginaRibilanciamento('bottoneSalva')}
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleReimposta(c.categoria, c.aliquotaDefault, c.numeroStrumenti)}
                disabled={inPending || c.numeroStrumenti === 0}
                style={{ ...stileBottoneOutline, width: '100%', opacity: inPending || c.numeroStrumenti === 0 ? 0.5 : 1 }}
              >
                {t('bottoneReimpostaTutti')}
              </button>

              {erroreCategoria === c.categoria && messaggioErrore && (
                <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-card-link)', marginTop: 8 }}>{messaggioErrore}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}