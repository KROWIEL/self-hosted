package config

import (
	"os"
	"strconv"
)

// Config holds agent runtime configuration sourced from environment.
type Config struct {
	Port int
	// DaemonToken is the bearer token the control plane must present.
	// MVP: shared token. Later: verify RSA-signed JWT with the panel's public key.
	DaemonToken string
	// WorkDir is where repos are cloned during builds (prefer tmpfs in prod).
	WorkDir string
	// Network is the default Docker network deployed services join.
	Network string
}

func Load() Config {
	return Config{
		Port:        envInt("AGENT_PORT", 8443),
		DaemonToken: os.Getenv("AGENT_DAEMON_TOKEN"),
		WorkDir:     envStr("AGENT_WORKDIR", "/tmp/agent-builds"),
		Network:     envStr("AGENT_NETWORK", "bridge"),
	}
}

func envStr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
