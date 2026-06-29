package docker

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os/exec"
	"strings"
)

// Client wraps Docker operations via the docker CLI.
// MVP choice: shelling out keeps the agent dependency-free and readable.
// Can be swapped for the Docker SDK later without changing callers.
type Client struct{}

func New() *Client { return &Client{} }

// BuildImage builds an image from a context dir using a specific Dockerfile,
// passing build-args to override base images. Build output streams to w.
func (c *Client) BuildImage(ctx context.Context, contextDir, dockerfile, tag string, buildArgs map[string]string, w io.Writer) error {
	args := []string{"build", "-t", tag, "-f", dockerfile}
	for k, v := range buildArgs {
		args = append(args, "--build-arg", fmt.Sprintf("%s=%s", k, v))
	}
	args = append(args, contextDir)
	return c.run(ctx, w, args...)
}

// RunContainer (re)creates and starts a container for a service.
// Returns the new container ID.
func (c *Client) RunContainer(ctx context.Context, opts RunOptions, w io.Writer) (string, error) {
	_ = c.run(ctx, io.Discard, "rm", "-f", opts.Name)

	args := []string{"run", "-d", "--name", opts.Name, "--restart", "unless-stopped"}
	if opts.Network != "" {
		args = append(args, "--network", opts.Network)
	}
	// Dev convenience: publish the service port to the host so it can be
	// reached directly at localhost:<port> without a reverse proxy.
	if opts.PublishPort > 0 {
		args = append(args, "-p", fmt.Sprintf("%d:%d", opts.PublishPort, opts.PublishPort))
	}
	if opts.MemLimitMb > 0 {
		args = append(args, "--memory", fmt.Sprintf("%dm", opts.MemLimitMb))
	}
	if opts.CPULimit > 0 {
		args = append(args, "--cpus", fmt.Sprintf("%.2f", float64(opts.CPULimit)/100.0))
	}
	for k, v := range opts.Env {
		args = append(args, "-e", fmt.Sprintf("%s=%s", k, v))
	}
	for _, l := range opts.Labels {
		args = append(args, "--label", l)
	}
	args = append(args, opts.Image)

	fmt.Fprintf(w, ">> starting container %s from %s\n", opts.Name, opts.Image)
	id, err := c.runCapture(ctx, w, args...)
	if err != nil {
		return "", err
	}
	return id, nil
}

// Remove force-removes a container (ignores "no such container").
func (c *Client) Remove(ctx context.Context, name string) error {
	return c.run(ctx, io.Discard, "rm", "-f", name)
}

func (c *Client) Power(ctx context.Context, name, action string) error {
	switch action {
	case "start":
		return c.run(ctx, io.Discard, "start", name)
	case "stop":
		return c.run(ctx, io.Discard, "stop", name)
	case "restart":
		return c.run(ctx, io.Discard, "restart", name)
	case "kill":
		return c.run(ctx, io.Discard, "kill", name)
	default:
		return fmt.Errorf("unknown power action: %s", action)
	}
}

// Logs streams container logs to w (follow mode).
func (c *Client) Logs(ctx context.Context, name string, w io.Writer) error {
	return c.run(ctx, w, "logs", "-f", "--tail", "200", name)
}

// Stats returns a one-shot resource snapshot as a JSON line ({{json .}}).
func (c *Client) Stats(ctx context.Context, name string) (string, error) {
	return c.runCapture(ctx, io.Discard, "stats", "--no-stream", "--format", "{{json .}}", name)
}

// Inspect returns a single formatted field from `docker inspect`.
func (c *Client) Inspect(ctx context.Context, name, format string) (string, error) {
	return c.runCapture(ctx, io.Discard, "inspect", "--format", format, name)
}

func (c *Client) run(ctx context.Context, w io.Writer, args ...string) error {
	cmd := exec.CommandContext(ctx, "docker", args...)
	cmd.Stdout = w
	cmd.Stderr = w
	return cmd.Run()
}

// runCapture runs docker and returns trimmed stdout, streaming stderr to w.
func (c *Client) runCapture(ctx context.Context, w io.Writer, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "docker", args...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = w
	err := cmd.Run()
	return strings.TrimSpace(out.String()), err
}

type RunOptions struct {
	Name        string
	Image       string
	Network     string
	MemLimitMb  int
	CPULimit    int // percent of one core
	PublishPort int // host port to publish (0 = none); maps host->container 1:1
	Env         map[string]string
	Labels      []string
}
