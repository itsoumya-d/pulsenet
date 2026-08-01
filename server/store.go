// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1619@gmail.com | +91 7031648617

package main

import (
	"database/sql"
	"encoding/json"
	"log"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func NewStore(dsn string) (*Store, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS payloads (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			app_id TEXT NOT NULL,
			start_time INTEGER,
			end_time INTEGER,
			data TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_app_id ON payloads(app_id);
	`)
	if err != nil {
		return nil, err
	}

	return &Store{db: db}, nil
}

func (s *Store) SavePayload(payload PulseNetPayload) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`
		INSERT INTO payloads (app_id, start_time, end_time, data)
		VALUES (?, ?, ?, ?)
	`, payload.AppID, payload.Period.Start, payload.Period.End, string(data))
	
	if err != nil {
		log.Printf("Error saving payload: %v", err)
	}
	return err
}

func (s *Store) GetPayloads(appId string) ([]PulseNetPayload, error) {
	rows, err := s.db.Query("SELECT data FROM payloads WHERE app_id = ?", appId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payloads []PulseNetPayload
	for rows.Next() {
		var data string
		if err := rows.Scan(&data); err != nil {
			return nil, err
		}
		var p PulseNetPayload
		if err := json.Unmarshal([]byte(data), &p); err != nil {
			return nil, err
		}
		payloads = append(payloads, p)
	}
	return payloads, nil
}
