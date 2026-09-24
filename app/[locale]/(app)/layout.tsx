import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/[locale]/login/actions'
import { ChiudiTendineAutomaticamente } from '@/components/chiudi-tendine-automaticamente'
import { ConfermaProvider } from '@/components/conferma'
import { BarraRicerca } from '@/components/barra-ricerca'
import { RippleLink } from '@/components/ripple-link'
import {
  IconaChevron,
  IconaPortafoglio,
  IconaAnalisi,
  IconaAccount,
  IconaAsset,
  IconaLiquidita,
  IconaPac,
  IconaPolizze,
  IconaCosti,
  IconaFiscalita,
  IconaRendimenti,
  IconaRibilanciamento,
  IconaStorico,
  IconaGestione,
  IconaImpostazioni,
  IconaEsci,
} from '@/components/icone'

// Voci del sottomenu Portafoglio → Asset: categoria del database, pagina,
// chiave nel namespace "Categorie".
const VOCI_ASSET = [
  { categoria: 'Azioni', href: '/azioni', chiave: 'azioni' },
  { categoria: 'Obbligazioni', href: '/obbligazioni', chiave: 'obbligazioni' },
  { categoria: 'Materie prime', href: '/materie-prime', chiave: 'materiePrime' },
  { categoria: 'Monetario', href: '/monetario', chiave: 'monetario' },
  { categoria: 'Multiasset', href: '/multiasset', chiave: 'multiasset' },
  { categoria: 'Crypto', href: '/crypto', chiave: 'crypto' },
]

// top: 100% = bordo inferiore reale dell'header. +1px bordo header, +5px distacco richiesto.
const stilePannello: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  zIndex: 10,
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('Menu')
  const tCategorie = await getTranslations('Categorie')
  const tGestioneTransazioni = await getTranslations('PaginaGestioneTransazioni')
  const locale = await getLocale()
  const supabase = await createClient()

  const [{ data: strumenti }, { data: contenitori }, { data: posizioniAperte }] = await Promise.all([
    supabase
      .from('strumenti')
      .select('id, nome, categoria, ticker')
      .neq('categoria', 'Liquidita')
      .order('nome'),
    supabase.from('contenitori').select('id, nome, tipo').order('nome'),
    supabase.from('v_riepilogo_posizione').select('strumento_id').gt('quantita_posseduta', 0),
  ])

  // Categorie con almeno una posizione aperta, ricavate dagli strumenti già
  // caricati per la barra di ricerca. Il sottomenu Asset mostra solo quelle,
  // in ordine alfabetico sul nome tradotto (quindi diverso tra it ed en).
  const categoriaPerStrumento = new Map((strumenti ?? []).map((s) => [s.id, s.categoria]))
  const categorieConPosizioni = new Set((posizioniAperte ?? []).map((p) => (p.strumento_id ? categoriaPerStrumento.get(p.strumento_id) : undefined)))
  const vociAsset = VOCI_ASSET.filter((v) => categorieConPosizioni.has(v.categoria))
    .map((v) => ({ href: v.href, etichetta: tCategorie(v.chiave) }))
    .sort((a, b) => a.etichetta.localeCompare(b.etichetta, locale))

  return (
    <ConfermaProvider>
      <div>
        <ChiudiTendineAutomaticamente />
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'var(--bg-base)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            padding: '0 48px',
            borderBottom: '1px solid var(--border-default)',
            gap: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0' }}>
            <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
              <strong>Investrick</strong>
            </Link>
            <BarraRicerca strumenti={strumenti ?? []} contenitori={contenitori ?? []} />
          </div>

          <nav data-menu-principale style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
            <details style={{ position: 'relative' }}>
              <summary className="menu-toggle menu-toggle-bar">
                <IconaPortafoglio />
                {t('portafoglio')}
                <span className="menu-chevron">
                  <IconaChevron />
                </span>
              </summary>
              <div className="menu-panel" style={stilePannello}>
                {vociAsset.length > 0 && (
                  <details>
                    <summary className="menu-toggle" style={{ padding: '9px 10px' }}>
                      <span className="menu-row-left">
                        <IconaAsset /> {t('asset')}
                      </span>
                      <span className="menu-chevron">
                        <IconaChevron />
                      </span>
                    </summary>
                    <div className="menu-submenu-items">
                      <RippleLink href="/asset" className="menu-row link-interattivo">
                        {t('tuttiAsset')}
                      </RippleLink>
                      <hr className="menu-divider" />
                      {vociAsset.map((v) => (
                        <RippleLink key={v.href} href={v.href} className="menu-row link-interattivo">
                          {v.etichetta}
                        </RippleLink>
                      ))}
                    </div>
                  </details>
                )}
                <RippleLink
                  href="/liquidita"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaLiquidita /> {t('liquidita')}
                </RippleLink>
                <RippleLink
                  href="/pac"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaPac /> {t('pianiDiAccumulo')}
                </RippleLink>
                <RippleLink
                  href="/polizze"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaPolizze /> {t('polizze')}
                </RippleLink>
              </div>
            </details>

            <details style={{ position: 'relative' }}>
              <summary className="menu-toggle menu-toggle-bar">
                <IconaAnalisi />
                {t('analisi')}
                <span className="menu-chevron">
                  <IconaChevron />
                </span>
              </summary>
              <div className="menu-panel" style={stilePannello}>
                <RippleLink
                  href="/costi"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaCosti /> {t('costi')}
                </RippleLink>
                <RippleLink
                  href="/fiscalita"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaFiscalita /> {t('fiscalita')}
                </RippleLink>
                <RippleLink
                  href="/rendimenti"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaRendimenti /> {t('rendimenti')}
                </RippleLink>
                <hr className="menu-divider" />
                <RippleLink
                  href="/ribilanciamento"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaRibilanciamento /> {t('ribilanciamento')}
                </RippleLink>
                <hr className="menu-divider" />
                <details>
                  <summary className="menu-toggle" style={{ padding: '9px 10px' }}>
                    <span className="menu-row-left">
                      <IconaStorico /> {t('storico')}
                    </span>
                    <span className="menu-chevron">
                      <IconaChevron />
                    </span>
                  </summary>
                  <div className="menu-submenu-items">
                    <RippleLink href="/storico/liquidita" className="menu-row link-interattivo">
                      {t('transazioniLiquidita')}
                    </RippleLink>
                    <RippleLink href="/storico/asset" className="menu-row link-interattivo">
                      {t('transazioniFinanziarie')}
                    </RippleLink>
                  </div>
                </details>
              </div>
            </details>

            <details style={{ position: 'relative' }}>
              <summary className="menu-toggle menu-toggle-bar">
                <IconaAccount />
                {t('account')}
                <span className="menu-chevron">
                  <IconaChevron />
                </span>
              </summary>
              <div className="menu-panel" style={stilePannello}>
                <details>
                  <summary className="menu-toggle" style={{ padding: '9px 10px' }}>
                    <span className="menu-row-left">
                      <IconaGestione /> {t('gestioneDatabase')}
                    </span>
                    <span className="menu-chevron">
                      <IconaChevron />
                    </span>
                  </summary>
                  <div className="menu-submenu-items">
                    <RippleLink href="/gestione/esporta" className="menu-row link-interattivo">
                      {tGestioneTransazioni('titoloEsporta')}
                    </RippleLink>
                    <RippleLink href="/gestione/importa" className="menu-row link-interattivo">
                      {tGestioneTransazioni('titoloImporta')}
                    </RippleLink>
                    <RippleLink href="/gestione/strumenti" className="menu-row link-interattivo">
                      {t('strumenti')}
                    </RippleLink>
                    <RippleLink href="/gestione/transazioni" className="menu-row link-interattivo">
                      {t('transazioni')}
                    </RippleLink>
                  </div>
                </details>
                <hr className="menu-divider" />
                <RippleLink
                  href="/account/impostazioni"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaImpostazioni /> {t('impostazioni')}
                </RippleLink>
                <hr className="menu-divider" />
                <form action={logout}>
                  <button
                    type="submit"
                    className="menu-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <IconaEsci /> {t('esci')}
                  </button>
                </form>
              </div>
            </details>
          </nav>
        </header>
        <main style={{ padding: '32px 48px' }}>
          <div style={{ maxWidth: 1600, margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </ConfermaProvider>
  )
}