export const uid = () => crypto.randomUUID();
export const edgeKey = (a: number, b: number) =>
  a < b ? `${a}-${b}` : `${b}-${a}`;
export const clone = <T>(v: T): T => structuredClone(v);
