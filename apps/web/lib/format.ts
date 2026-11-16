export function formatPrice(cents: number, currency: string): string {
  const fractionDigits = cents % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(cents / 100)
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}
