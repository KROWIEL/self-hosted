"use client";

import Link from "next/link";
import { PropsWithChildren, useEffect, useState } from "react";

import { apiGet } from "../lib/api";
import { API_BASE_URL } from "../lib/config";

type MeResponse = {
  user: {
    id: string;
    displayName?: string;
    githubLogin?: string;
    roleNames: string[];
  } | null;
};

export function AppShell({ children }: PropsWithChildren) {
  const [me, setMe] = useState<MeResponse["user"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<MeResponse>("/auth/me")
      .then((response) => setMe(response.user))
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  const loginUrl = `${API_BASE_URL}/auth/github/start`;
  const logout = async () => {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
    location.reload();
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>self-hosted</h2>
        <p>control plane</p>
        {loading ? (
          <p>Loading user...</p>
        ) : me ? (
          <div className="card">
            <strong>{me.displayName ?? me.githubLogin}</strong>
            <div style={{ marginTop: 6 }}>roles: {me.roleNames.join(", ")}</div>
            <button style={{ marginTop: 8 }} onClick={() => void logout()}>
              Logout
            </button>
          </div>
        ) : (
          <div className="card">
            <a href={loginUrl}>Login with GitHub</a>
          </div>
        )}

        <nav style={{ display: "grid", gap: 8 }}>
          <Link href="/">Dashboard</Link>
          <Link href="/apps">Apps</Link>
          <Link href="/routes">Routes</Link>
          <Link href="/deploy">Deploy</Link>
          <Link href="/logs">Logs</Link>
          <Link href="/users-roles">Users & Roles</Link>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
