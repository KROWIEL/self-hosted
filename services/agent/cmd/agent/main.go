package main

import (
	"log"

	"github.com/self-hosted/agent/internal/api"
	"github.com/self-hosted/agent/internal/config"
)

func main() {
	cfg := config.Load()
	srv := api.NewServer(cfg)

	log.Printf("agent listening on :%d", cfg.Port)
	if err := srv.Run(); err != nil {
		log.Fatalf("agent stopped: %v", err)
	}
}
