import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/[locale]/login/actions'
import { ChiudiTendineAutomaticamente } from '@/components/chiudi-tendine-automaticamente'
import { ConfermaProvider } from '@/components/conferma'
import { NotificaProvider } from '@/components/notifica'
import { BarraRicerca } from '@/components/barra-ricerca'
import { RippleLink } from '@/components/ripple-link'
import {
  IconaChevron,
  IconaPortafoglio,
  IconaAnalisi,
  IconaAccount,
  IconaAsset,
  IconaGruppi,
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
// chiave nel namespace "Categorie". La Liquidità ha la sua pagina dedicata.
const VOCI_ASSET = [
  { categoria: 'Azioni', href: '/shares', chiave: 'azioni' },
  { categoria: 'Obbligazioni', href: '/bonds', chiave: 'obbligazioni' },
  { categoria: 'Materie prime', href: '/commodities', chiave: 'materiePrime' },
  { categoria: 'Monetario', href: '/money-market', chiave: 'monetario' },
  { categoria: 'Multiasset', href: '/multiasset', chiave: 'multiasset' },
  { categoria: 'Crypto', href: '/crypto', chiave: 'crypto' },
  { categoria: 'Liquidita', href: '/cash', chiave: 'liquidita' },
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
  const locale = await getLocale()
  const supabase = await createClient()

  const [{ data: strumenti }, { data: contenitori }, { data: posizioniAperte }, { count: numeroContiLiquidita }] = await Promise.all([
    supabase
      .from('strumenti')
      .select('id, nome, categoria, ticker')
      .neq('categoria', 'Liquidita')
      .order('nome'),
    supabase.from('contenitori').select('id, nome, tipo').order('nome'),
    supabase.from('v_riepilogo_posizione').select('strumento_id').gt('quantita_posseduta', 0),
    // Per la liquidità "ha posizioni" vuol dire che esiste almeno un conto,
    // anche a saldo zero, come nella pagina /liquidita.
    supabase.from('strumenti').select('id', { count: 'exact', head: true }).eq('categoria', 'Liquidita'),
  ])

  // Categorie con almeno una posizione aperta, ricavate dagli strumenti già
  // caricati per la barra di ricerca. Il sottomenu Asset mostra solo quelle,
  // in ordine alfabetico sul nome tradotto (quindi diverso tra it ed en).
  const categoriaPerStrumento = new Map((strumenti ?? []).map((s) => [s.id, s.categoria]))
  const categorieConPosizioni = new Set((posizioniAperte ?? []).map((p) => (p.strumento_id ? categoriaPerStrumento.get(p.strumento_id) : undefined)))
  if ((numeroContiLiquidita ?? 0) > 0) categorieConPosizioni.add('Liquidita')
  const vociAsset = VOCI_ASSET.filter((v) => categorieConPosizioni.has(v.categoria))
    .map((v) => ({ href: v.href, etichetta: tCategorie(v.chiave) }))
    .sort((a, b) => a.etichetta.localeCompare(b.etichetta, locale))

  return (
    <ConfermaProvider><NotificaProvider>
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
                {/* "Gruppi" nel menu; nel codice e nel database restano i contenitori. */}
                <details>
                  <summary className="menu-toggle" style={{ padding: '9px 10px' }}>
                    <span className="menu-row-left">
                      <IconaGruppi /> {t('gruppi')}
                    </span>
                    <span className="menu-chevron">
                      <IconaChevron />
                    </span>
                  </summary>
                  <div className="menu-submenu-items">
                    <RippleLink href="/investment-plans" className="menu-row link-interattivo">
                      {t('pianiDiAccumulo')}
                    </RippleLink>
                    <RippleLink href="/insurance-policies" className="menu-row link-interattivo">
                      {t('polizze')}
                    </RippleLink>
                    <RippleLink href="/custom-groups" className="menu-row link-interattivo">
                      {t('personalizzati')}
                    </RippleLink>
                  </div>
                </details>
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
                  href="/costs"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaCosti /> {t('costi')}
                </RippleLink>
                <RippleLink
                  href="/tax"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaFiscalita /> {t('fiscalita')}
                </RippleLink>
                <RippleLink
                  href="/returns"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaRendimenti /> {t('rendimenti')}
                </RippleLink>
                <hr className="menu-divider" />
                <RippleLink
                  href="/tools/rebalancing"
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
                    <RippleLink href="/history/cash" className="menu-row link-interattivo">
                      {t('transazioniLiquidita')}
                    </RippleLink>
                    <RippleLink href="/history/asset" className="menu-row link-interattivo">
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
                <RippleLink
                  href="/account/data-management"
                  className="menu-row link-interattivo"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                >
                  <IconaGestione /> {t('gestioneDatabase')}
                </RippleLink>
                <RippleLink
                  href="/account/settings"
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
    </NotificaProvider></ConfermaProvider>
  )
}