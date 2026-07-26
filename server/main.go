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
