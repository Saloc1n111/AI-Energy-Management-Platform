package sqlite_test

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"
	"testing"

	"energyhub/internal/infrastructure/sqlite"
)

func TestOpen_WALAndConcurrency(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "concurrency_test.db")
	db, err := sqlite.Open(dbPath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer db.Close()

	if err := sqlite.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	// Verify journal_mode is WAL
	var journalMode string
	if err := db.QueryRow("PRAGMA journal_mode;").Scan(&journalMode); err != nil {
		t.Fatalf("query journal_mode: %v", err)
	}
	if journalMode != "wal" {
		t.Errorf("expected journal_mode=wal, got %s", journalMode)
	}

	// Verify busy_timeout
	var busyTimeout int
	if err := db.QueryRow("PRAGMA busy_timeout;").Scan(&busyTimeout); err != nil {
		t.Fatalf("query busy_timeout: %v", err)
	}
	if busyTimeout < 5000 {
		t.Errorf("expected busy_timeout >= 5000, got %d", busyTimeout)
	}

	// Insert test meter
	_, err = db.Exec("INSERT INTO meters (meter_id, name) VALUES ('M-TEST', 'Medidor Test Concurrencia')")
	if err != nil {
		t.Fatalf("insert test meter: %v", err)
	}

	// Verify concurrent readers AND writers can run simultaneously across connections
	var wg sync.WaitGroup
	workers := 8
	errCh := make(chan error, workers*2)

	// Reader workers
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 25; j++ {
				var name string
				err := db.QueryRowContext(context.Background(), "SELECT name FROM meters WHERE meter_id = 'M-TEST'").Scan(&name)
				if err != nil {
					errCh <- err
					return
				}
				if name != "Medidor Test Concurrencia" {
					t.Errorf("unexpected name: %s", name)
				}
			}
		}(i)
	}

	// Concurrent writer workers
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 5; j++ {
				_, err := db.ExecContext(context.Background(),
					"INSERT INTO readings (meter_id, timestamp, consumption_kwh, voltage_v, current_a, power_factor, status) VALUES ('M-TEST', datetime('now', ?), 10.5, 220.0, 45.0, 0.95, 'OK')",
					fmt.Sprintf("+%d seconds", id*10+j))
				if err != nil {
					errCh <- err
					return
				}
			}
		}(i)
	}

	wg.Wait()
	close(errCh)

	for err := range errCh {
		t.Errorf("concurrent operation error: %v", err)
	}
}
