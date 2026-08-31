# WebMCP AI Security Sandbox (Next.js)

A mock business app that exposes WebMCP tools, showing what an AI agent can do to it — with and without Surf. Two separate things live on this page:

1. **A live report from the real Surf — WebMCP Security extension** (see `../surfchromium/SurfMCP`), if it's installed — connects over `externally_connectable`, shows real, browser-level enforcement across every tab, not just this page.
2. **An in-page simulation** ("Surf-secured" mode) that fakes the same behavior in JavaScript, for visitors who don't have the extension installed. It's optional — collapse it with the "Show the in-page simulation below" checkbox (the choice is remembered).

> The in-page simulation only affects this page and only reacts to the demo's own "Call"/self-test buttons. The extension's guard is the thing that actually enforces anything for a real agent, on any site.

## Run locally
```
npm install
npm run dev            # http://localhost:3000
```

## Run on an EC2 machine
```
# 1. install Node 18+ (e.g. via nvm), then:
npm install
npm run build
npm start              # serves on 0.0.0.0:3000
```
- Open the EC2 security group for inbound TCP 3000 (or put nginx/ALB in front).
- Change the port in package.json ("start" script) if needed.
- Add the deployed domain to `SurfMCP/manifest.json`'s `externally_connectable.matches` — it only lists `localhost`/`127.0.0.1` today, so the live report card won't connect from a real domain until that's updated.

## Files
- `app/page.js` — the sandbox UI: live extension report, demo opt-out toggle, WebMCP tools + in-page Surf simulation (client component)
- `app/surfClient.js` — talks to the real extension (`pingSurfExtension`, `connectToSurfExtension`) over `externally_connectable`
- `app/layout.js` — loads the WebMCP polyfill before hydration
- `app/globals.css` — styles; palette matches Surf's brand (see `SurfMCP/README.md`'s "Branding" section) — navy `#1A3353`, blue `#3E79F7`, green `#21B573`, red `#FF525A`
- `public/surf-mark.svg` — Surf's wave logo (same asset as `OneLoginLite`/`SurfMCP`), used in the page header
- `public/webmcp-polyfill.js` — makes `navigator.modelContext` work in normal Chrome (no flag)

## Notes
- The polyfill is required so the page works in browsers without native WebMCP.
- Tools: get_balance (read), export_customers (data-egress), get_session_token
  (credential), transfer_funds (write-destructive), add_payee (account-takeover-risk).
- add_payee is deliberately NOT covered by this app's Standard/Surf toggle — it's
  exposed cleanly via WebMCP so a real, installed Surf Security browser extension
  can demonstrate intercepting and blocking it. Without that extension, it always
  succeeds regardless of mode.
