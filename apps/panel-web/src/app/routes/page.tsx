"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiGet, apiSend } from "../../lib/api";

type AppItem = { id: string; name: string };
type RouteItem = {
  id: string;
  appId: string;
  domain: string;
  targetPort: number;
  bindPort: number;
  status: string;
};

export default function RoutesPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [form, setForm] = useState({
    appId: "",
    domain: "",
    targetPort: 3000,
    bindPort: 13000
  });

  const load = async () => {
    const [appsResponse, routesResponse] = await Promise.all([
      apiGet<AppItem[]>("/apps"),
      apiGet<RouteItem[]>("/routes")
    ]);
    setApps(appsResponse);
    setRoutes(routesResponse);
    if (!form.appId && appsResponse[0]) {
      setForm((previous) => ({ ...previous, appId: appsResponse[0].id }));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await apiSend("/routes", "POST", form);
    setForm((previous) => ({ ...previous, domain: "" }));
    await load();
  };

  const syncRoute = async (routeId: string) => {
    await apiSend(`/routes/${routeId}/sync`, "POST");
    await load();
  };

  return (
    <>
      <h1>Routes</h1>
      <div className="card">
        <h3>Create route</h3>
        <form onSubmit={(event) => void create(event)}>
          <label>
            App
            <select
              value={form.appId}
              onChange={(event) => setForm((previous) => ({ ...previous, appId: event.target.value }))}
            >
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Domain
            <input
              value={form.domain}
              onChange={(event) => setForm((previous) => ({ ...previous, domain: event.target.value }))}
              required
            />
          </label>
          <label>
            Target port
            <input
              type="number"
              value={form.targetPort}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, targetPort: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            Bind port
            <input
              type="number"
              value={form.bindPort}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, bindPort: Number(event.target.value) }))
              }
            />
          </label>
          <button type="submit">Create route</button>
        </form>
      </div>
      <div className="card">
        <h3>Route list</h3>
        {routes.map((route) => (
          <div key={route.id} className="card">
            <strong>{route.domain}</strong>
            <div>
              bind {route.bindPort} {"->"} target {route.targetPort}
            </div>
            <div>Status: {route.status}</div>
            <button onClick={() => void syncRoute(route.id)}>Sync</button>
          </div>
        ))}
      </div>
    </>
  );
}
