// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

package main

import (
	"encoding/json"
	"net/http"
)

func handleStats(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		appId := r.URL.Query().Get("appId")
		if appId == "" {
			http.Error(w, "Missing appId parameter", http.StatusBadRequest)
			return
		}

		payloads, err := store.GetPayloads(appId)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Simple aggregation of all payloads for the app
		mergedPageViews := make(map[string]float64)
		mergedEvents := make(map[string]float64)
		var totalSessions float64
		
		for _, p := range payloads {
			for k, v := range p.PageViews {
				mergedPageViews[k] += v
			}
			for k, v := range p.Events {
				mergedEvents[k] += v
			}
			totalSessions += p.Sessions.Count
		}

		response := map[string]interface{}{
			"appId": appId,
			"pageViews": mergedPageViews,
			"events": mergedEvents,
			"totalSessions": totalSessions,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

func handleEvents(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		appId := r.URL.Query().Get("appId")
		if appId == "" {
			http.Error(w, "Missing appId parameter", http.StatusBadRequest)
			return
		}

		payloads, err := store.GetPayloads(appId)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		mergedEvents := make(map[string]float64)
		for _, p := range payloads {
			for k, v := range p.Events {
				mergedEvents[k] += v
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mergedEvents)
	}
}

func handleSessions(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		appId := r.URL.Query().Get("appId")
		if appId == "" {
			http.Error(w, "Missing appId parameter", http.StatusBadRequest)
			return
		}

		payloads, err := store.GetPayloads(appId)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		var totalSessions float64
		var sumAvgDuration float64
		var sumBounceRate float64

		for _, p := range payloads {
			totalSessions += p.Sessions.Count
			sumAvgDuration += p.Sessions.AvgDurationSec * p.Sessions.Count
			sumBounceRate += p.Sessions.BounceRate * p.Sessions.Count
		}

		response := map[string]interface{}{
			"totalSessions": totalSessions,
			"avgDurationSec": 0,
			"bounceRate": 0,
		}
		if totalSessions > 0 {
			response["avgDurationSec"] = sumAvgDuration / totalSessions
			response["bounceRate"] = sumBounceRate / totalSessions
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
