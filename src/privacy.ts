// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

export function addLaplaceNoise(value: number, sensitivity: number, epsilon: number): number {
  if (value === 0) return 0;
  const scale = sensitivity / epsilon;
  const u = Math.random() - 0.5;
  const noise = scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  return Math.max(0, Math.round(value + noise));
}

export function addGaussianNoise(value: number, sensitivity: number, epsilon: number): number {
  if (value === 0) return 0;
  // Box-Muller transform for Gaussian noise
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  const stddev = (sensitivity * Math.sqrt(2 * Math.log(1.25 / 0.00001))) / epsilon; // delta=0.00001 approx
  const noise = stddev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.max(0, Math.round(value + noise));
}

let privacyBudget = 1.0;

export function remainingBudget(): number {
  return privacyBudget;
}

export function consumeBudget(epsilon: number): boolean {
  if (privacyBudget >= epsilon) {
    privacyBudget -= epsilon;
    return true;
  }
  return false;
}

export function reset(budget: number = 1.0): void {
  privacyBudget = budget;
}
