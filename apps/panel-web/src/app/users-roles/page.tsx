"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiGet, apiSend } from "../../lib/api";

type Role = { id: string; name: string; permissions: Array<{ permission: { key: string } }> };
type Permission = { id: string; key: string };
type User = {
  id: string;
  displayName?: string;
  githubLogin?: string;
  email?: string;
  isActive: boolean;
  roles: Array<{ role: { name: string } }>;
};

export default function UsersRolesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [invite, setInvite] = useState({
    githubLogin: "",
    email: "",
    roleName: "viewer"
  });

  const load = async () => {
    const [usersResponse, rolesResponse, permissionsResponse] = await Promise.all([
      apiGet<User[]>("/users"),
      apiGet<Role[]>("/roles"),
      apiGet<Permission[]>("/permissions")
    ]);
    setUsers(usersResponse);
    setRoles(rolesResponse);
    setPermissions(permissionsResponse);
  };

  useEffect(() => {
    void load();
  }, []);

  const inviteUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await apiSend("/users/invite", "POST", {
      githubLogin: invite.githubLogin || undefined,
      email: invite.email || undefined,
      roleName: invite.roleName
    });
    setInvite((previous) => ({ ...previous, githubLogin: "", email: "" }));
    await load();
  };

  const assignRole = async (userId: string, roleName: string) => {
    await apiSend(`/users/${userId}/roles`, "PATCH", { roles: [roleName] });
    await load();
  };

  const toggleActive = async (user: User) => {
    await apiSend(`/users/${user.id}/active`, "PATCH", { isActive: !user.isActive });
    await load();
  };

  return (
    <>
      <h1>Users & Roles</h1>
      <div className="card">
        <h3>Invite (allowlist)</h3>
        <form onSubmit={(event) => void inviteUser(event)}>
          <label>
            GitHub login
            <input
              value={invite.githubLogin}
              onChange={(event) =>
                setInvite((previous) => ({ ...previous, githubLogin: event.target.value }))
              }
            />
          </label>
          <label>
            Email
            <input
              value={invite.email}
              onChange={(event) => setInvite((previous) => ({ ...previous, email: event.target.value }))}
            />
          </label>
          <label>
            Role
            <select
              value={invite.roleName}
              onChange={(event) => setInvite((previous) => ({ ...previous, roleName: event.target.value }))}
            >
              <option value="admin">admin</option>
              <option value="operator">operator</option>
              <option value="viewer">viewer</option>
            </select>
          </label>
          <button type="submit">Create invite</button>
        </form>
      </div>
      <div className="card">
        <h3>Users</h3>
        {users.map((user) => (
          <div key={user.id} className="card">
            <div>
              <strong>{user.displayName ?? user.githubLogin ?? user.email}</strong>
            </div>
            <div>Roles: {user.roles.map((entry) => entry.role.name).join(", ")}</div>
            <div>Status: {user.isActive ? "active" : "disabled"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => void assignRole(user.id, "admin")}>Set admin</button>
              <button onClick={() => void assignRole(user.id, "operator")}>Set operator</button>
              <button onClick={() => void assignRole(user.id, "viewer")}>Set viewer</button>
              <button onClick={() => void toggleActive(user)}>
                {user.isActive ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Roles</h3>
        {roles.map((role) => (
          <div key={role.id}>
            {role.name}: {role.permissions.map((item) => item.permission.key).join(", ")}
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Permissions ({permissions.length})</h3>
        <div>{permissions.map((permission) => permission.key).join(", ")}</div>
      </div>
    </>
  );
}
