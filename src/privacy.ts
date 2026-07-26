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
