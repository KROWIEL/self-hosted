# License activation server (seller-side)

Reference implementation of the online-activation endpoint the panel calls on a
heartbeat. **This is seller infrastructure — never distribute it (or the private
signing key) to customers.** Customers only need their license key.

It uses only Node built-ins and a JSON file for state, so you can run it on any
tiny VM behind HTTPS (put it behind a reverse proxy such as Caddy/Traefik).

## Run

```bash
# Uses ../license-issuer/keys/public.pem by default, or set LICENSE_PUBLIC_KEY.
PORT=8787 DEFAULT_SEATS=3 npm start
```

Then point each distributed panel at it:

```
LICENSE_ACTIVATION_URL=https://activate.your-domain.com/activate
```

## Protocol

Request (POST `/activate`):

```json
{ "key": "<license key>", "instanceId": "<uuid>", "product": "self-hosted", "version": "1" }
```

Response:

```json
{ "ok": true, "tier": "pro", "exp": 0 }
// or
{ "ok": false, "reason": "revoked" }   // rejected | expired | revoked | seat_limit
```

## Enforcement

- **Signature + expiry** are verified with the public key (offline math).
- **Revocation:** add the license `sub` (customer/order id) to `revoked.json`
  (a JSON array of strings) to kill a key — the next heartbeat locks paid modules
  within the panel's grace window.
- **Seat limit:** per key, `payload.seats` (if the issuer set it) else
  `DEFAULT_SEATS`. Extra installs get `seat_limit`.

State is written to `state.json` (gitignored). For production, swap the JSON
store for a real database and add auth/rate-limiting to the endpoint.
