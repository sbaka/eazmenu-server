---
description: "Run an OWASP-aligned security audit on an eazmenu repo — covers auth, input validation, injection, secrets, API surface, payments, and dependencies"
argument-hint: "Which repo? admin, customer, server, shared, or all"
agent: "agent"
tools: ["read/readFile", "search/fileSearch", "agent/runSubagent", "search/codebase", "context7/*"]
---

# Security Audit — eazmenu

Audit the **{{repo}}** repository for security vulnerabilities. If no repo is specified or "all" is given, audit all four: admin, customer, server, shared.

This is a multi-package TypeScript project:
- **admin** — React (Vite) merchant dashboard
- **customer** — React (Vite) public menu/ordering app
- **server** — Express API with Drizzle ORM, Supabase auth, Stripe billing
- **shared** — Drizzle schemas, Zod validation, shared types

Use the `Explore` subagent to scan each target repo thoroughly before reporting.

## Audit Categories

Work through every category below. For each finding, report the file path, line number, what's wrong, and a concrete fix.

### 1. Authentication & Authorization

- Auth middleware applied to all protected routes
- No endpoints missing ownership checks (e.g. `checkRestaurantOwnership`)
- JWT/token handling: expiry enforcement, no secrets in source
- Customer vs. merchant route isolation (`customerOnlyRoutes`)
- OAuth callback validation

### 2. Input Validation & Schema Safety

- Drizzle-Zod schemas match DB column types (watch for enum fields leaking array prototype — e.g. `insertSubscriptionSchema` status field)
- Request body/query/param validation before DB operations
- Dangerous `as any` casts that suppress type safety
- Integer overflow or NaN checks on numeric params (`restaurantId`, `categoryId`, etc.)

### 3. Injection & XSS

- Raw SQL or string interpolation in queries (should use parameterized Drizzle queries)
- `dangerouslySetInnerHTML` in React components without sanitization
- User-generated content rendered without escaping
- Command injection via unsanitized input passed to `child_process` or similar

### 4. API Surface & Transport

- CORS locked to expected origins, no wildcard in production
- Rate limiting on auth, payment, and high-cost endpoints
- Response bodies don't leak internal fields (DB IDs, hashed passwords, full error stacks)
- Helmet CSP directives appropriate for the app
- CSRF protection on state-changing requests

### 5. Secrets & Environment

- No hardcoded API keys, DB URLs, Stripe secrets, or Supabase keys in source
- `.env` / `.env.local` listed in `.gitignore`
- No secrets bundled into client-side builds (check Vite `import.meta.env` usage)
- Service role keys not exposed to client

### 6. Payment & Subscription Logic

- Stripe webhook signature verification present and correct
- No client-supplied price/plan IDs trusted without server validation
- Subscription status transitions can't be manipulated via API
- Race conditions in concurrent webhook handling

### 7. File Upload & Storage

- Magic byte validation (not just MIME type)
- File size limits enforced
- Uploaded file paths can't be used for path traversal
- Signed URL expiry is reasonable

### 8. Session & Cookie Security

- `httpOnly`, `secure`, `sameSite` flags set on all cookies
- Session IDs use cryptographic randomness
- Session fixation prevention

### 9. Dependencies

- Flag known-vulnerable package patterns (outdated `jsonwebtoken`, `express` < 4.19, etc.)
- Unused dependencies that expand attack surface

## Output Format

Group findings by severity. Use this structure:

```
## Critical
- **[path/to/file.ts:42]** What's wrong → How to fix it

## High
...

## Medium
...

## Low
...

## Summary
X critical, Y high, Z medium, W low findings across N files.
```

Skip empty severity levels. Be specific — cite exact lines, not vague descriptions.
