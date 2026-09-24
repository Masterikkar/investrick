export type LocaleFormato = 'it' | 'en'

// 'en' usa en-GB (mai en-US) per mantenere l'ordine giorno/mese nelle date,
// coerente con l'italiano.
function tagLocale(locale: LocaleFormato) {
  return locale === 'en' ? 'en-GB' : 'it-IT'
}

export function formatEuro(valore: number, locale: LocaleFormato = 'it') {
  return new Intl.NumberFormat(tagLocale(locale), {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
  }).format(valore)
}

export function formatEuroSigned(valore: number, locale: LocaleFormato = 'it') {
  return new Intl.NumberFormat(tagLocale(locale), {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
    signDisplay: 'exceptZero',
  }).format(valore)
}

export function formatEuroCompatto(valore: number, locale: LocaleFormato = 'it') {
  return new Intl.NumberFormat(tagLocale(locale), {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
  }).format(valore)
}

export function formatNumero(valore: number, decimali = 2, conSegno = false, locale: LocaleFormato = 'it') {
  return new Intl.NumberFormat(tagLocale(locale), {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
    useGrouping: 'always',
    signDisplay: conSegno ? 'exceptZero' : 'auto',
  }).format(valore)
}

export function formatPercent(valore: number, decimali = 2, conSegno = false, locale: LocaleFormato = 'it') {
  return `${formatNumero(valore, decimali, conSegno, locale)}%`
}

export function formatData(data: Date | string, locale: LocaleFormato = 'it', opzioni?: Intl.DateTimeFormatOptions) {
  const date = typeof data === 'string' ? new Date(data) : data
  return date.toLocaleDateString(tagLocale(locale), opzioni)
}
