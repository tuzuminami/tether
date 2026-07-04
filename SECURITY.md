# Security Policy

## Supported Versions

The project is pre-1.0. Security fixes target the latest `main` branch until versioned releases begin.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately to the repository owner. Do not open a public issue containing secrets, production conversation data, private operator material, exploit payloads, or direct personal identifiers.

## Security Expectations

- Use a production authentication adapter before internet exposure.
- Keep tenant IDs scoped by authenticated principals.
- Do not send raw secrets or full conversation transcripts in event payloads.
- Run `npm run check:private-boundary` before commits, packages, images, or releases.
