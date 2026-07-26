export function addLaplaceNoise(value: number, sensitivity: number, epsilon: number): number {
  if (value === 0) return 0;
  const scale = sensitivity / epsilon;
  const u = Math.random() - 0.5;
  const noise = scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  return Math.max(0, Math.round(value + noise));
}
