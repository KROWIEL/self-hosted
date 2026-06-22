"use client";

import { useEffect, useMemo, useState } from "react";

import { apiGet } from "../../lib/api";
import { realtimeSocket } from "../../lib/realtime";

type AppItem = { id: string; name: string };
type LogItem = {
  id?: string;
  appId: string;
  stream: string;
  line: string;
  ts: string;
};

export default function LogsPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [history, setHistory] = useState<LogItem[]>([]);
  const [live, setLive] = useState<LogItem[]>([]);

  useEffect(() => {
    void apiGet<AppItem[]>("/apps").then((data) => {
      setApps(data);
      if (data[0]) {
        setSelectedAppId(data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedAppId) {
      return;
    }
    void apiGet<LogItem[]>(`/apps/${selectedAppId}/logs?limit=200`).then((data) => setHistory(data));
  }, [selectedAppId]);

  useEffect(() => {
    realtimeSocket.connect();
    realtimeSocket.on("logs.line", (line: LogItem) => {
      setLive((previous) => [line, ...previous].slice(0, 300));
    });
    return () => {
      realtimeSocket.off("logs.line");
      realtimeSocket.disconnect();
    };
  }, []);

  const combined = useMemo(
    () => [...live.filter((entry) => entry.appId === selectedAppId), ...history].slice(0, 300),
    [live, history, selectedAppId]
  );

  return (
    <>
      <h1>Logs</h1>
      <div className="card">
        <label>
          App
          <select value={selectedAppId} onChange={(event) => setSelectedAppId(event.target.value)}>
            {apps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="card">
        <h3>Live + history (7 days)</h3>
        <div style={{ maxHeight: 540, overflow: "auto", fontFamily: "monospace", fontSize: 13 }}>
          {combined.map((entry, index) => (
            <div key={`${entry.id ?? index}-${entry.ts}`}>
              {new Date(entry.ts).toLocaleString()} [{entry.stream}] {entry.line}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
