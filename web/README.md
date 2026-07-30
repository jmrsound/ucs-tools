# UCS Tagger

The standalone browser surface for `ucs-tools`.

Users describe a sound in plain language and get a short, inspectable list of
likely UCS v8.2.1 categories. The finder runs entirely in the browser against
the public UCS list bundled at `public/ucs_v8.2.1.csv`.

## Principles

- Suggestions, not automatic classification.
- Every result exposes the public-list fields that caused it to surface.
- No account, audio upload, hosted model, or server-side classifier.
- The Python package remains an exact, format-only toolkit.

## Develop

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run lint
npm run build
npm run build:standalone
```

The matcher tests read the Python package's canonical CSV so the web copy cannot
quietly drift from the bundled catalog.

`build:standalone` produces a static, subpath-safe bundle in
`standalone-dist/`. That is the artifact served at
`https://murphyryan.com/ucs-tagger/`.
