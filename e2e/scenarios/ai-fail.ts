export function discount(total: number, member: boolean): number {
  return member && total > 100 ? 10 : 0;
}
