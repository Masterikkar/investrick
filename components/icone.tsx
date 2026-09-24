function IconaBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function IconaChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7.5l5 5 5-5" />
    </svg>
  )
}

export function IconaPortafoglio() {
  return (
    <IconaBase>
      <rect x="3" y="7" width="14" height="9" rx="1.5" />
      <path d="M7 7V5.5A1.5 1.5 0 0 1 8.5 4h3A1.5 1.5 0 0 1 13 5.5V7" />
      <path d="M3 11h14" />
    </IconaBase>
  )
}

export function IconaAnalisi() {
  return (
    <IconaBase>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M16.5 16.5l-4-4" />
    </IconaBase>
  )
}

export function IconaAccount() {
  return (
    <IconaBase>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    </IconaBase>
  )
}

export function IconaAsset() {
  return (
    <IconaBase>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3v7l5 3" />
    </IconaBase>
  )
}

export function IconaLiquidita() {
  return (
    <IconaBase>
      <rect x="3" y="6" width="14" height="9" rx="2" />
      <circle cx="10" cy="10.5" r="2" />
    </IconaBase>
  )
}

export function IconaPac() {
  return (
    <IconaBase>
      <path d="M10 3l7 3.5-7 3.5-7-3.5L10 3z" />
      <path d="M3 10.5l7 3.5 7-3.5" />
      <path d="M3 14l7 3.5 7-3.5" />
    </IconaBase>
  )
}

export function IconaPolizze() {
  return (
    <IconaBase>
      <path d="M10 3l6 2.2v4.3c0 4-2.6 6.7-6 7.5-3.4-.8-6-3.5-6-7.5V5.2L10 3z" />
    </IconaBase>
  )
}

export function IconaCosti() {
  return (
    <IconaBase>
      <path d="M11 3h4a2 2 0 0 1 2 2v4L8.5 17.5a2 2 0 0 1-2.8 0l-3.2-3.2a2 2 0 0 1 0-2.8L11 3z" />
      <circle cx="13.5" cy="6.5" r="1.2" />
    </IconaBase>
  )
}

export function IconaFiscalita() {
  return (
    <IconaBase>
      <path d="M6 2.5h6l3 3v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z" />
      <path d="M12 2.5v3h3" />
      <path d="M7 10h6M7 12.5h6M7 15h4" />
    </IconaBase>
  )
}

export function IconaRendimenti() {
  return (
    <IconaBase>
      <path d="M3 14l4.5-4.5 3 3L17 5.5" />
      <path d="M13 5.5h4v4" />
    </IconaBase>
  )
}

export function IconaRibilanciamento() {
  return (
    <IconaBase>
      <path d="M10 3v14M6 17h8" />
      <path d="M4 6h5M11 6h5" />
      <path d="M4 6l-2 4.5a2.2 2.2 0 0 0 4 0L4 6z" />
      <path d="M16 6l-2 4.5a2.2 2.2 0 0 0 4 0L16 6z" />
    </IconaBase>
  )
}

export function IconaStorico() {
  return (
    <IconaBase>
      <circle cx="10" cy="10.5" r="7" />
      <path d="M10 6.5v4l3 2" />
    </IconaBase>
  )
}

export function IconaGestione() {
  return (
    <IconaBase>
      <path d="M4 6h8M15 6h1M4 10h1M7 10h9M4 14h11M17 14h-1" />
      <circle cx="14" cy="6" r="1.6" />
      <circle cx="5" cy="10" r="1.6" />
      <circle cx="14" cy="14" r="1.6" />
    </IconaBase>
  )
}

export function IconaImpostazioni() {
  return (
    <IconaBase>
      <g transform="scale(0.8333)">
        <path
          d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="12" cy="12" r="3" vectorEffect="non-scaling-stroke" />
      </g>
    </IconaBase>
  )
}

export function IconaEsci() {
  return (
    <IconaBase>
      <path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H8" />
      <path d="M13 6.5l4 3.5-4 3.5M17 10H7.5" />
    </IconaBase>
  )
}

export function IconaModifica() {
  return (
    <IconaBase>
      <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5zM11.5 5.5l3 3" />
    </IconaBase>
  )
}

export function IconaSalva() {
  return (
    <IconaBase>
      <path d="M4 3.5h9.5L16.5 6.5v10H4zM7 3.5v4h6v-4M7 16.5v-5h6v5" />
    </IconaBase>
  )
}

export function IconaElimina() {
  return (
    <IconaBase>
      <path d="M3.5 6h13M8 6V3.5h4V6M5.5 6l1 10.5h7l1-10.5M8.5 9v4.5M11.5 9v4.5" />
    </IconaBase>
  )
}

export function IconaDownload() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}