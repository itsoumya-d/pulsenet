// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1619@gmail.com | +91 7031648617

package main

import (
	"log"
	"net/http"
)

func main() {
	store, err := NewStore("pulsenet.db")
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	http.HandleFunc("/api/collect", handleCollect(store))
	http.HandleFunc("/api/stats", handleStats(store))
	http.HandleFunc("/api/events", handleEvents(store))
	http.HandleFunc("/api/sessions", handleSessions(store))

	log.Println("PulseNet Server starting on :4003")
	if err := http.ListenAndServe(":4003", nil); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
