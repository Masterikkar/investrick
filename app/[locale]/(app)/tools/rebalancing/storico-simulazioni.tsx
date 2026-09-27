'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useConferma } from '@/components/conferma'
import { IconaRibilanciamento, IconaModifica, IconaElimina, IconaSalva, STILE_BOTTONE_ICONA } from '@/components/icone'
import { NOME_SIMULAZIONE_MAX, pulisciNomeSimulazione } from '@/lib/ribilanciamento-simulazione'
import { rinominaSimulazione, eliminaSimulazione } from './actions-simulazione'

// Riga già pronta per la vista: chi chiama (SimulatorePortafoglio /
// SimulatoreGruppo) traduce il proprio risultato tipizzato in questi pochi
// campi testuali — la card non conosce le differenze fra i due esiti.
export type RigaStoricoVista = {
  id: string
  nome: string
  dataOra: string
  importo: string | null
  badgeTesto: string
  badgeColore: string
  badgeSfondo: string
}

const stileBottoneNome: React.CSSProperties = {
  flexGrow: 1,
  minWidth: 0,
  textAlign: 'left',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
}

// Concept "A" scelto dall'utente: card orizzontale con icona quadrata,
// nome/data a sinistra, importo+esito a destra, matita/cestino in fondo per
// rinominare o eliminare. Condivisa da portafoglio e gruppo.
export function StoricoSimulazioni({
  righe,
  onSeleziona,
  onEsportaPdf,
  onRinominato,
  onEliminato,
}: {
  righe: RigaStoricoVista[]
  onSeleziona: (id: string) => void
  // Esporta subito in PDF senza aprire l'overlay del risultato — stesso PDF
  // che si otterrebbe aprendo la simulazione e premendo "Salva PDF" lì.
  onEsportaPdf: (id: string) => void
  // La card salva da sé (server action); avvisa il chiamante solo per
  // aggiornare la propria copia dello storico — niente logica di persistenza
  // duplicata fra portafoglio e gruppo.
  onRinominato: (id: string, nuovoNome: string) => void
  onEliminato: (id: string) => void
}) {
  const t = useTranslations('PaginaRibilanciamento')
  const conferma = useConferma()
  const [modificaId, setModificaId] = useState<string | null>(null)
  const [bozza, setBozza] = useState('')

  async function confermaRinomina(id: string) {
    const nome = bozza.trim()
    setModificaId(null)
    if (!nome) return
    const esito = await rinominaSimulazione(id, nome)
    if (esito.ok) onRinominato(id, nome)
  }

  async function handleElimina(id: string, nome: string) {
    const ok = await conferma({
      titolo: t('confermaEliminaSimulazioneTitolo'),
      messaggio: t('confermaEliminaSimulazioneMessaggio', { nome }),
      etichettaConferma: t('confermaEliminaSimulazioneBottone'),
      pericoloso: true,
    })
    if (!ok) return
    await eliminaSimulazione(id)
    onEliminato(id)
  }

  if (righe.length === 0) {
    return <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>{t('nessunaSimulazionePrecedente')}</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {righe.map((r) => (
        <div
          key={r.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--bg-section)',
            border: '1px solid var(--border-section)',
            padding: '10px 12px',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              background: 'var(--bg-surface)',
              color: 'var(--primary-vivid)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconaRibilanciamento />
          </div>

          {modificaId === r.id ? (
            <input
              type="text"
              value={bozza}
              autoFocus
              maxLength={NOME_SIMULAZIONE_MAX}
              onChange={(e) => setBozza(pulisciNomeSimulazione(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confermaRinomina(r.id)
                if (e.key === 'Escape') setModificaId(null)
              }}
              onBlur={() => confermaRinomina(r.id)}
              style={{
                flexGrow: 1,
                minWidth: 0,
                background: 'var(--bg-surface)',
                border: '1px solid var(--primary-vivid)',
                color: 'var(--text-primary)',
                fontSize: 'var(--fs-body)',
                padding: '4px 8px',
              }}
            />
          ) : (
            <button type="button" onClick={() => onSeleziona(r.id)} style={stileBottoneNome}>
              <div
                style={{
                  fontSize: 'var(--fs-body)',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.nome}
              </div>
              <div style={{ fontSize: 'var(--fs-form-hint)', color: 'var(--text-muted)' }}>{r.dataOra}</div>
            </button>
          )}

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {r.importo && (
              <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>{r.importo}</div>
            )}
            <span
              style={{
                display: 'inline-block',
                marginTop: 3,
                fontSize: 'var(--fs-form-hint)',
                fontWeight: 500,
                padding: '2px 7px',
                background: r.badgeSfondo,
                color: r.badgeColore,
              }}
            >
              {r.badgeTesto}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button type="button" onClick={() => onEsportaPdf(r.id)} aria-label={t('bottoneSalvaPdf')} style={STILE_BOTTONE_ICONA}>
              <IconaSalva />
            </button>
            <button
              type="button"
              onClick={() => {
                setModificaId(r.id)
                setBozza(r.nome)
              }}
              aria-label={t('bottoneRinomina')}
              style={STILE_BOTTONE_ICONA}
            >
              <IconaModifica />
            </button>
            <button
              type="button"
              onClick={() => handleElimina(r.id, r.nome)}
              aria-label={t('bottoneElimina')}
              style={{ ...STILE_BOTTONE_ICONA, color: 'var(--danger)' }}
            >
              <IconaElimina />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
