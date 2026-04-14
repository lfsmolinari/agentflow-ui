---
name: security-review-checklist
description: Use when performing security review, threat modeling, or OWASP-aligned analysis on code changes.
---

## Purpose

Provides a systematic security review framework covering threat modeling, OWASP-aligned analysis, and vulnerability assessment for code changes.

## When to Use

Use this skill during security review to ensure systematic coverage of security concerns.

## Review Order

1. **Attack surface** — What data enters, exits, or crosses trust boundaries?
2. **Input validation** — Are all inputs validated and sanitized?
3. **Authentication and authorization** — Are access controls correct?
4. **Data protection** — Is sensitive data handled securely?
5. **Dependencies** — Are third-party libraries safe?
6. **Configuration** — Are security settings correct?

## Threat Model (Lightweight)

For each change, identify:

- **Data flow**: What data enters the system, where does it go, and who can access it?
- **Trust boundaries**: Where does trusted code interact with untrusted input?
- **Assets at risk**: What could an attacker gain access to if this code is vulnerable?
- **Threat actors**: Who might exploit this? (external user, internal user, automated bot)

## OWASP Top 10 Quick Check

| Category | Check | Applies? |
|---|---|---|
| A01: Broken Access Control | Are authorization checks present and correct? | |
| A02: Cryptographic Failures | Is sensitive data encrypted properly? | |
| A03: Injection | Are queries parameterized? Is user input sanitized? | |
| A04: Insecure Design | Does the design have security controls built in? | |
| A05: Security Misconfiguration | Are defaults secure? Are unnecessary features disabled? | |
| A06: Vulnerable Components | Are dependencies up to date and free of known CVEs? | |
| A07: Authentication Failures | Are auth mechanisms robust (rate limiting, MFA)? | |
| A08: Data Integrity Failures | Is deserialization controlled? Are updates verified? | |
| A09: Logging Failures | Are security events logged without exposing secrets? | |
| A10: SSRF | Are outbound requests validated against allowlists? | |

## Finding Format

For each finding:

```
### [Severity]: [Title]

**OWASP**: [Category, e.g., A03: Injection]
**Location**: [file:line]
**Description**: [What the vulnerability is]
**Impact**: [What could happen if exploited]
**Fix**: [Suggested remediation approach]
```

Severity levels:
- **Critical** — Exploitable now, high impact, fix before merge
- **High** — Likely exploitable, significant impact, fix before merge
- **Medium** — Exploitable under specific conditions, fix soon
- **Low** — Minor risk or defense-in-depth improvement

## Output Format

Follow the structured report format defined in the Security agent:

1. **Summary** — what was reviewed, overall security posture assessment
2. **Threat Model table** — data flows, trust boundaries, assets at risk, and threat actors
3. **Spec Security Coverage table** — each security requirement mapped to Met / Unmet / Partial
4. **Metrics** — attack surfaces reviewed, dependencies changed, CVEs found
5. **Findings table** — severity-rated (🔴🟠🟡🔵), OWASP category, file:line, vulnerability, impact, and suggested fix
6. **Dependency Risks table** — packages, versions, CVEs, and recommended actions
7. **Recommended Actions** — checkboxes separating must-fix from advisory
8. **Risk Level** — Low / Medium / High / Critical with one-line justification

## Checklist

- [ ] All user inputs are validated and sanitized
- [ ] Authentication and authorization are correct
- [ ] Secrets and credentials are not exposed
- [ ] Dependencies are from trusted sources with no known CVEs
- [ ] OWASP Top 10 categories relevant to the change are checked
- [ ] Findings are classified by severity with justification
- [ ] Must-fix (Critical/High) is separated from advisory (Medium/Low)
