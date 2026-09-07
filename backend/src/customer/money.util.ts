/**
 * Money helpers for expense totals. Amounts are summed in minor units (paise) so
 * repeated additions never accumulate binary floating-point error.
 */

const MINOR_UNIT_DIGITS = 2;

/** Accepts a Prisma Decimal, a number or a decimal string. */
export function toMinorUnits(value: { toString(): string }): number {
  const [whole, fraction = ''] = String(value).split('.');
  const minor = `${fraction}00`.slice(0, MINOR_UNIT_DIGITS);
  const magnitude =
    Math.abs(Number(whole)) * 100 +
    Number(minor.padEnd(MINOR_UNIT_DIGITS, '0'));

  return whole.trim().startsWith('-') ? -magnitude : magnitude;
}

export function fromMinorUnits(minorUnits: number): number {
  return minorUnits / 100;
}

/** Normalises a validated decimal string to exactly two fraction digits. */
export function formatAmount(value: { toString(): string }): string {
  return (toMinorUnits(value) / 100).toFixed(MINOR_UNIT_DIGITS);
}
