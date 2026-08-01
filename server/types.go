// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1619@gmail.com | +91 7031648617

package main

type PulseNetPayload struct {
	AppID      string             `json:"appId"`
	Period     Period             `json:"period"`
	PageViews  map[string]float64 `json:"pageViews"`
	Events     map[string]float64 `json:"events"`
	Sessions   SessionStats       `json:"sessions"`
	Timing     map[string]Timing  `json:"timing"`
	Referrers  map[string]float64 `json:"referrers"`
	Devices    map[string]float64 `json:"devices"`
	NoiseLevel float64            `json:"noiseLevel"`
}

type Period struct {
	Start int64 `json:"start"`
	End   int64 `json:"end"`
}

type SessionStats struct {
	Count          float64 `json:"count"`
	AvgDurationSec float64 `json:"avgDurationSec"`
	BounceRate     float64 `json:"bounceRate"`
}

type Timing struct {
	P50 float64 `json:"p50"`
	P95 float64 `json:"p95"`
	P99 float64 `json:"p99"`
}
