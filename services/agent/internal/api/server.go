package api

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/self-hosted/agent/internal/builder"
	"github.com/self-hosted/agent/internal/config"
	"github.com/self-hosted/agent/internal/docker"
)

type Server struct {
	cfg     config.Config
	docker  *docker.Client
	builder *builder.Builder
	mux     *http.ServeMux
}

func NewServer(cfg config.Config) *Server {
	d := docker.New()
	s := &Server{
		cfg:     cfg,
		docker:  d,
		builder: builder.New(d, cfg.WorkDir),
		mux:     http.NewServeMux(),
	}
	s.routes()
	return s
}

func (s *Server) Run() error {
	addr := fmt.Sprintf(":%d", s.cfg.Port)
	return http.ListenAndServe(addr, s.auth(s.mux))
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /api/system", s.handleSystem)
	s.mux.HandleFunc("POST /api/servers/{uuid}/build", s.handleBuild)
	s.mux.HandleFunc("POST /api/inspect", s.handleInspect)
	s.mux.HandleFunc("POST /api/servers/{uuid}/run", s.handleRun)
	s.mux.HandleFunc("POST /api/servers/{uuid}/power", s.handlePower)
	s.mux.HandleFunc("DELETE /api/servers/{uuid}", s.handleRemove)
	s.mux.HandleFunc("GET /api/servers/{uuid}/logs", s.handleLogs)
	s.mux.HandleFunc("GET /api/servers/{uuid}/stats", s.handleStats)
	s.mux.HandleFunc("POST /api/servers/{uuid}/gc", s.handleGC)
	s.mux.HandleFunc("GET /api/servers/{uuid}/exec", s.handleExec)
	s.mux.HandleFunc("POST /api/databases", s.handleDBCreate)
	s.mux.HandleFunc("POST /api/databases/power", s.handleDBPower)
	s.mux.HandleFunc("POST /api/databases/status", s.handleDBStatus)
	s.mux.HandleFunc("DELETE /api/databases", s.handleDBRemove)
	s.mux.HandleFunc("POST /api/databases/schema", s.handleDBSchema)
	s.mux.HandleFunc("POST /api/databases/grant", s.handleDBGrant)
	s.mux.HandleFunc("DELETE /api/volumes", s.handleVolumeRemove)
	s.mux.HandleFunc("POST /api/backups", s.handleBackupCreate)
	s.mux.HandleFunc("POST /api/backups/restore", s.handleBackupRestore)
	s.mux.HandleFunc("GET /api/backups/download", s.handleBackupDownload)
	s.mux.HandleFunc("DELETE /api/backups", s.handleBackupDelete)
}

// auth enforces the shared daemon token (constant-time compare).
func (s *Server) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if s.cfg.DaemonToken == "" ||
			subtle.ConstantTimeCompare([]byte(token), []byte(s.cfg.DaemonToken)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleSystem(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	resp := map[string]any{"version": "0.1.0"}

	if running, err := s.docker.Ps(ctx, false); err == nil {
		resp["containersRunning"] = countLines(running)
	}
	if all, err := s.docker.Ps(ctx, true); err == nil {
		resp["containersTotal"] = countLines(all)
	}

	// docker system df: one JSON object per resource type (Images, Containers, …).
	if df, err := s.docker.SystemDf(ctx); err == nil {
		for _, line := range strings.Split(strings.TrimSpace(df), "\n") {
			if strings.TrimSpace(line) == "" {
				continue
			}
			var row map[string]string
			if json.Unmarshal([]byte(line), &row) != nil {
				continue
			}
			switch row["Type"] {
			case "Images":
				resp["imagesCount"] = row["TotalCount"]
				resp["imagesSize"] = row["Size"]
				resp["imagesReclaimable"] = row["Reclaimable"]
			case "Local Volumes":
				resp["volumesSize"] = row["Size"]
			case "Build Cache":
				resp["buildCacheSize"] = row["Size"]
			}
		}
	}
	writeJSON(w, resp)
}

// handleGC removes stale images of a service, keeping the currently used one.
func (s *Server) handleGC(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	var body struct {
		KeepImage string `json:"keepImage"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	// Image repo is "svc-" + first 8 chars of the service id (see control plane).
	short := uuid
	if len(short) > 8 {
		short = short[:8]
	}
	repo := "svc-" + short

	out, err := s.docker.ImagesByRepo(r.Context(), repo)
	if err != nil {
		writeJSON(w, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	removed := 0
	for _, ref := range strings.Split(strings.TrimSpace(out), "\n") {
		ref = strings.TrimSpace(ref)
		if ref == "" || ref == body.KeepImage || strings.HasSuffix(ref, ":<none>") {
			continue
		}
		if s.docker.RemoveImage(r.Context(), ref) == nil {
			removed++
		}
	}
	writeJSON(w, map[string]any{"ok": true, "removed": removed})
}

func countLines(s string) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	return len(strings.Split(s, "\n"))
}

type buildBody struct {
	RepoURL           string `json:"repoUrl"`
	Branch            string `json:"branch"`
	PATToken          string `json:"patToken"`
	BuildImage        string `json:"buildImage"`
	RunImage          string `json:"runImage"`
	Dockerfile        string `json:"dockerfile"`
	UseRepoDockerfile bool   `json:"useRepoDockerfile"`
	BuildScript       string `json:"buildScript"`
	ImageTag          string `json:"imageTag"`
}

func (s *Server) handleBuild(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	var body buildBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	// Stream build logs back to the caller as they happen.
	flusher, _ := w.(http.Flusher)
	w.Header().Set("Content-Type", "application/x-ndjson")

	sha, err := s.builder.Build(context.Background(), builder.BuildRequest{
		ServiceID:         uuid,
		RepoURL:           body.RepoURL,
		Branch:            body.Branch,
		PATToken:          body.PATToken,
		BuildImage:        body.BuildImage,
		RunImage:          body.RunImage,
		Dockerfile:        body.Dockerfile,
		UseRepoDockerfile: body.UseRepoDockerfile,
		ImageTag:          body.ImageTag,
	}, &flushWriter{w: w, f: flusher})
	if err != nil {
		writeJSON(w, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, map[string]any{"commitSha": sha})
}

type inspectBody struct {
	RepoURL  string `json:"repoUrl"`
	Branch   string `json:"branch"`
	PATToken string `json:"patToken"`
	WorkID   string `json:"workId"`
}

func (s *Server) handleInspect(w http.ResponseWriter, r *http.Request) {
	var body inspectBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	res, err := s.builder.Inspect(context.Background(), builder.InspectRequest{
		WorkID:   body.WorkID,
		RepoURL:  body.RepoURL,
		Branch:   body.Branch,
		PATToken: body.PATToken,
	})
	if err != nil {
		writeJSON(w, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, res)
}

type volumeMount struct {
	Name      string `json:"name"`
	MountPath string `json:"mountPath"`
}

type runBody struct {
	Image    string            `json:"image"`
	Port     int               `json:"port"`
	CPULimit int               `json:"cpuLimit"`
	MemLimit int               `json:"memLimit"`
	Env      map[string]string `json:"env"`
	Domain   string            `json:"domain"`
	HTTPS    bool              `json:"https"`
	Network  string            `json:"network"`
	Volumes  []volumeMount     `json:"volumes"`
}

func (s *Server) handleRun(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	var body runBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	network := body.Network
	if network == "" {
		network = s.cfg.Network
	}

	// Dev: publish the port to the host so the app is reachable at
	// localhost:<port> without Traefik. Disabled by default.
	publishPort := 0
	if os.Getenv("AGENT_PUBLISH_PORTS") == "1" {
		publishPort = body.Port
	}

	mounts := make([]docker.VolumeMount, 0, len(body.Volumes))
	for _, v := range body.Volumes {
		mounts = append(mounts, docker.VolumeMount{Name: v.Name, MountPath: v.MountPath})
	}

	name := containerName(uuid)
	opts := docker.RunOptions{
		Name:        name,
		Image:       body.Image,
		Network:     network,
		MemLimitMb:  body.MemLimit,
		CPULimit:    body.CPULimit,
		PublishPort: publishPort,
		Env:         body.Env,
		Labels:      traefikLabels(uuid, body.Domain, body.Port, body.HTTPS),
		Volumes:     mounts,
	}

	// Capture progress so the HTTP response stays valid JSON.
	var progress bytes.Buffer
	id, err := s.docker.RunContainer(context.Background(), opts, &progress)
	if err != nil {
		writeJSON(w, map[string]any{
			"ok":    false,
			"error": err.Error(),
			"log":   progress.String(),
		})
		return
	}
	writeJSON(w, map[string]any{"ok": true, "containerId": id})
}

// traefikLabels wires a service container into the Traefik reverse proxy.
// Returns no labels when no domain is attached (internal-only service).
func traefikLabels(uuid, domain string, port int, https bool) []string {
	if domain == "" {
		return nil
	}
	router := "svc-" + uuid
	labels := []string{
		"traefik.enable=true",
		fmt.Sprintf("traefik.http.routers.%s.rule=Host(`%s`)", router, domain),
		fmt.Sprintf("traefik.http.services.%s.loadbalancer.server.port=%d", router, port),
	}
	if https {
		labels = append(labels,
			fmt.Sprintf("traefik.http.routers.%s.entrypoints=websecure", router),
			fmt.Sprintf("traefik.http.routers.%s.tls.certresolver=letsencrypt", router),
		)
	} else {
		labels = append(labels, fmt.Sprintf("traefik.http.routers.%s.entrypoints=web", router))
	}
	return labels
}

func (s *Server) handleRemove(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	if err := s.docker.Remove(context.Background(), containerName(uuid)); err != nil {
		writeJSON(w, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

type powerBody struct {
	Action string `json:"action"`
}

func (s *Server) handlePower(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	var body powerBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := s.docker.Power(context.Background(), containerName(uuid), body.Action); err != nil {
		writeJSON(w, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

func (s *Server) handleLogs(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	flusher, _ := w.(http.Flusher)
	_ = s.docker.Logs(r.Context(), containerName(uuid), &flushWriter{w: w, f: flusher})
}

// handleStats returns a live resource + health snapshot for a service container.
func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	name := containerName(uuid)
	ctx := r.Context()

	state, err := s.docker.Inspect(ctx, name, "{{.State.Status}}")
	if err != nil || state == "" {
		writeJSON(w, map[string]any{"running": false, "state": "missing"})
		return
	}
	health, _ := s.docker.Inspect(ctx, name,
		"{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}")

	resp := map[string]any{
		"running": state == "running",
		"state":   state,
		"health":  strings.TrimSpace(health),
	}

	if state == "running" {
		if raw, err := s.docker.Stats(ctx, name); err == nil && raw != "" {
			var stat map[string]string
			if json.Unmarshal([]byte(raw), &stat) == nil {
				resp["cpuPerc"] = stat["CPUPerc"]
				resp["memUsage"] = stat["MemUsage"]
				resp["memPerc"] = stat["MemPerc"]
				resp["netIO"] = stat["NetIO"]
				resp["blockIO"] = stat["BlockIO"]
				resp["pids"] = stat["PIDs"]
			}
		}
	}
	writeJSON(w, resp)
}

func containerName(uuid string) string { return "svc-" + uuid }

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

type flushWriter struct {
	w http.ResponseWriter
	f http.Flusher
}

func (fw *flushWriter) Write(p []byte) (int, error) {
	n, err := fw.w.Write(p)
	if fw.f != nil {
		fw.f.Flush()
	}
	return n, err
}
