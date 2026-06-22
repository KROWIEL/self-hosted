"use client";

import { useEffect, useState } from "react";

import { apiGet, apiSend } from "../../lib/api";
import { realtimeSocket } from "../../lib/realtime";

type AppItem = {
  id: string;
  name: string;
  branch: string;
};

type DeployProgressEvent = {
  appId: string;
  deployJobId: string;
  stage: string;
  message: string;
};

export default function DeployPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [gitRefByApp, setGitRefByApp] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<DeployProgressEvent[]>([]);

  useEffect(() => {
    void apiGet<AppItem[]>("/apps").then((data) => setApps(data));
  }, []);

  useEffect(() => {
    realtimeSocket.connect();
    realtimeSocket.on("deploy.progress", (event: DeployProgressEvent) => {
      setEvents((previous) => [event, ...previous].slice(0, 100));
    });
    return () => {
      realtimeSocket.off("deploy.progress");
      realtimeSocket.disconnect();
    };
  }, []);

  const deploy = async (appId: string) => {
    await apiSend(`/apps/${appId}/deploy`, "POST", {
      gitRef: gitRefByApp[appId] || undefined
    });
  };

  const rollback = async (appId: string) => {
    await apiSend(`/apps/${appId}/rollback`, "POST", {
      gitRef: gitRefByApp[appId] || undefined
    });
  };

  return (
    <>
      <h1>Deploy</h1>
      <div className="card">
        {apps.map((app) => (
          <div className="card" key={app.id}>
            <strong>{app.name}</strong>
            <div>Default branch: {app.branch}</div>
            <label>
              Git ref (optional)
              <input
                value={gitRefByApp[app.id] ?? ""}
                onChange={(event) =>
                  setGitRefByApp((previous) => ({
                    ...previous,
                    [app.id]: event.target.value
                  }))
                }
                placeholder="main / tag / commit"
              />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => void deploy(app.id)}>Deploy</button>
              <button onClick={() => void rollback(app.id)}>Rollback</button>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Deploy progress</h3>
        {events.map((event, index) => (
          <div key={`${event.deployJobId}-${event.stage}-${index}`}>
            [{event.stage}] {event.message}
          </div>
        ))}
      </div>
    </>
  );
}
