// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

function getSecureRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / 0xFFFFFFFF;
  }
  return Math.random();
}

export function addLaplaceNoise(value: number, sensitivity: number, epsilon: number): number {
  const scale = sensitivity / Math.max(epsilon, 1e-5);
  let u = getSecureRandom() - 0.5;
  while (u === 0) u = getSecureRandom() - 0.5;
  const noise = scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  return Math.max(0, Math.round(value + noise));
}

export function addGaussianNoise(value: number, sensitivity: number, epsilon: number): number {
  let u = 0, v = 0;
  while (u === 0) u = getSecureRandom();
  while (v === 0) v = getSecureRandom();
  const stddev = (sensitivity * Math.sqrt(2 * Math.log(1.25 / 0.00001))) / Math.max(epsilon, 1e-5);
  const noise = stddev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.max(0, Math.round(value + noise));
}

class PrivacyBudgetTracker {
  private budget: number = 1.0;
  private maxBudget: number = 1.0;

  public remaining(): number {
    return this.budget;
  }

  public consume(epsilon: number): boolean {
    if (this.budget >= epsilon) {
      this.budget -= epsilon;
      return true;
    }
    return false;
  }

  public reset(budget: number = 1.0): void {
    // Prevent setting infinite budget
    this.maxBudget = Math.min(Math.max(budget, 0.1), 10.0);
    this.budget = this.maxBudget;
  }
}

const defaultTracker = new PrivacyBudgetTracker();

export function remainingBudget(): number {
  return defaultTracker.remaining();
}

export function consumeBudget(epsilon: number): boolean {
  return defaultTracker.consume(epsilon);
}

export function reset(budget: number = 1.0): void {
  defaultTracker.reset(budget);
}

