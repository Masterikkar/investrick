import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/[locale]/login/actions'
import { ChiudiTendineAutomaticamente } from '@/components/chiudi-tendine-automaticamente'
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
  IconaEsci,
} from '@/components/icone'

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
  const supabase = await createClient()

  const [{ data: strumenti }, { data: contenitori }] = await Promise.all([
    supabase
      .from('strumenti')
      .select('id, nome, categoria, ticker')
      .neq('categoria', 'Liquidita')
      .order('nome'),
    supabase.from('contenitori').select('id, nome, tipo').order('nome'),
  ])

  return (
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

        <nav style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
          <details style={{ position: 'relative' }}>
            <summary className="menu-toggle menu-toggle-bar">
              <IconaPortafoglio />
              {t('portafoglio')}
              <span className="menu-chevron">
                <IconaChevron />
              </span>
            </summary>
            <div className="menu-panel" style={stilePannello}>
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
                  <RippleLink href="/azioni" className="menu-row link-interattivo">
                    {tCategorie('azioni')}
                  </RippleLink>
                  <RippleLink href="/obbligazioni" className="menu-row link-interattivo">
                    {tCategorie('obbligazioni')}
                  </RippleLink>
                  <RippleLink href="/materie-prime" className="menu-row link-interattivo">
                    {tCategorie('materiePrime')}
                  </RippleLink>
                  <RippleLink href="/monetario" className="menu-row link-interattivo">
                    {tCategorie('monetario')}
                  </RippleLink>
                  <RippleLink href="/multiasset" className="menu-row link-interattivo">
                    {tCategorie('multiasset')}
                  </RippleLink>
                  <RippleLink href="/crypto" className="menu-row link-interattivo">
                    {tCategorie('crypto')}
                  </RippleLink>
                </div>
              </details>
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
                  <RippleLink href="/gestione/fiscalita" className="menu-row link-interattivo">
                    {t('fiscalita')}
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
  )
}