export function formatEuro(valore: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
  }).format(valore)
}

export function formatEuroSigned(valore: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
    signDisplay: 'exceptZero',
  }).format(valore)
}

export function formatNumero(valore: number, decimali = 2, conSegno = false) {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
    useGrouping: 'always',
    signDisplay: conSegno ? 'exceptZero' : 'auto',
  }).format(valore)
}

export function formatPercent(valore: number, decimali = 2, conSegno = false) {
  return `${formatNumero(valore, decimali, conSegno)}%`
}