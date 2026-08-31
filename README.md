# WebMCP AI Security Sandbox (Next.js)

A mock business app that exposes WebMCP tools, showing what an AI agent can do
to it with and without Surf's security layer (data masking, action confirmation,
credential isolation) plus an "AI Agent Risk Audit" report.

> Note: the "Surf" layer here is an in-page demonstration. In production the
> same policy engine lives in the browser/extension. This app *demonstrates*
> the behavior; it does not enforce it on agents that don't load this page.

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

## Files
- app/page.js        – the sandbox UI + WebMCP tools + Surf wrapper (client component)
- app/layout.js      – loads the WebMCP polyfill before hydration
- app/globals.css    – styles
- public/webmcp-polyfill.js – makes navigator.modelContext work in normal Chrome (no flag)

## Notes
- The polyfill is required so the page works in browsers without native WebMCP.
- Tools: get_balance (read), export_customers (data-egress), get_session_token
  (credential), transfer_funds (write-destructive), add_payee (account-takeover-risk).
- add_payee is deliberately NOT covered by this app's Standard/Surf toggle — it's
  exposed cleanly via WebMCP so a real, installed Surf Security browser extension
  can demonstrate intercepting and blocking it. Without that extension, it always
  succeeds regardless of mode.
