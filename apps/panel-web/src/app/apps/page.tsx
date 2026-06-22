"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiGet, apiSend } from "../../lib/api";

type AppItem = {
  id: string;
  nodeId: string;
  name: string;
  repoUrl: string;
  branch: string;
  composePath: string;
  serviceName: string;
  healthcheckUrl?: string;
  cpuLimit: string;
  memoryLimit: string;
  status: string;
};

type NodeItem = { id: string; name: string };

const initialForm = {
  nodeId: "",
  name: "",
  repoUrl: "",
  branch: "main",
  composePath: "docker-compose.yml",
  serviceName: "app",
  healthcheckUrl: "",
  cpuLimit: "1",
  memoryLimit: "512m"
};

export default function AppsPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  const load = async () => {
    const [appsResponse, nodesResponse] = await Promise.all([
      apiGet<AppItem[]>("/apps"),
      apiGet<NodeItem[]>("/nodes")
    ]);
    setApps(appsResponse);
    setNodes(nodesResponse);
    if (!form.nodeId && nodesResponse[0]) {
      setForm((previous) => ({ ...previous, nodeId: nodesResponse[0].id }));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      await apiSend("/apps", "POST", {
        ...form,
        envVars: [],
        gitCredential: undefined
      });
      setForm((previous) => ({
        ...previous,
        name: "",
        repoUrl: ""
      }));
      await load();
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const control = async (appId: string, action: "start" | "stop" | "restart") => {
    await apiSend(`/apps/${appId}/${action}`, "POST");
    await load();
  };

  return (
    <>
      <h1>Apps</h1>
      <div className="card">
        <h3>Create app</h3>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Node
            <select
              value={form.nodeId}
              onChange={(event) => setForm((previous) => ({ ...previous, nodeId: event.target.value }))}
            >
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              required
            />
          </label>
          <label>
            Repo URL
            <input
              value={form.repoUrl}
              onChange={(event) => setForm((previous) => ({ ...previous, repoUrl: event.target.value }))}
              required
            />
          </label>
          <label>
            Branch
            <input
              value={form.branch}
              onChange={(event) => setForm((previous) => ({ ...previous, branch: event.target.value }))}
              required
            />
          </label>
          <label>
            Compose path
            <input
              value={form.composePath}
              onChange={(event) => setForm((previous) => ({ ...previous, composePath: event.target.value }))}
              required
            />
          </label>
          <label>
            Service name
            <input
              value={form.serviceName}
              onChange={(event) => setForm((previous) => ({ ...previous, serviceName: event.target.value }))}
              required
            />
          </label>
          <label>
            Healthcheck URL
            <input
              value={form.healthcheckUrl}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, healthcheckUrl: event.target.value }))
              }
            />
          </label>
          <label>
            CPU limit
            <input
              value={form.cpuLimit}
              onChange={(event) => setForm((previous) => ({ ...previous, cpuLimit: event.target.value }))}
              required
            />
          </label>
          <label>
            Memory limit
            <input
              value={form.memoryLimit}
              onChange={(event) => setForm((previous) => ({ ...previous, memoryLimit: event.target.value }))}
              required
            />
          </label>
          <button type="submit">Create app</button>
          {error ? <p>{error}</p> : null}
        </form>
      </div>
      <div className="card">
        <h3>Registered apps</h3>
        {apps.map((app) => (
          <div key={app.id} className="card">
            <strong>{app.name}</strong>
            <div>Status: {app.status}</div>
            <div>Repo: {app.repoUrl}</div>
            <div>Limits: CPU {app.cpuLimit}, Memory {app.memoryLimit}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => void control(app.id, "start")}>Start</button>
              <button onClick={() => void control(app.id, "stop")}>Stop</button>
              <button onClick={() => void control(app.id, "restart")}>Restart</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
