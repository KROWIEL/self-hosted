"use client";

import { useEffect, useState } from "react";

import { apiGet } from "../lib/api";
import { realtimeSocket } from "../lib/realtime";

type DashboardData = {
  health: { status: string; now: string } | null;
  nodes: Array<{ id: string; name: string; status: string }>;
  apps: Array<{ id: string; name: string; status: string }>;
  routes: Array<{ id: string; domain: string; status: string }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    health: null,
    nodes: [],
    apps: [],
    routes: []
  });
  const [liveNodeState, setLiveNodeState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void Promise.all([
      apiGet<{ status: string; now: string }>("/health"),
      apiGet<Array<{ id: string; name: string; status: string }>>("/nodes"),
      apiGet<Array<{ id: string; name: string; status: string }>>("/apps"),
      apiGet<Array<{ id: string; domain: string; status: string }>>("/routes")
    ]).then(([health, nodes, apps, routes]) => {
      setData({ health, nodes, apps, routes });
    });
  }, []);

  useEffect(() => {
    realtimeSocket.connect();
    realtimeSocket.on("node.status", (event: { nodeId: string; connected: boolean }) => {
      setLiveNodeState((previous) => ({
        ...previous,
        [event.nodeId]: event.connected
      }));
    });
    return () => {
      realtimeSocket.off("node.status");
      realtimeSocket.disconnect();
    };
  }, []);

  return (
    <>
      <h1>Dashboard</h1>
      <div className="grid">
        <div className="card">
          <h3>API</h3>
          <div>Status: {data.health?.status ?? "unknown"}</div>
          <div>Time: {data.health?.now ?? "-"}</div>
        </div>
        <div className="card">
          <h3>Nodes</h3>
          <div>Total: {data.nodes.length}</div>
          {data.nodes.map((node) => (
            <div key={node.id}>
              {node.name} - {liveNodeState[node.id] ? "connected" : node.status}
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Apps</h3>
          <div>Total: {data.apps.length}</div>
          {data.apps.slice(0, 5).map((app) => (
            <div key={app.id}>
              {app.name} - {app.status}
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Routes</h3>
          <div>Total: {data.routes.length}</div>
          {data.routes.slice(0, 5).map((route) => (
            <div key={route.id}>
              {route.domain} - {route.status}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
