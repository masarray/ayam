# Contributing

Contributions are welcome.

## Local workflow

```bash
npm install
npm run verify
npm run build
npm run dev
```

## Pull request checklist

- Keep the game fast on low-end laptops and mobile browsers.
- Do not add heavy assets unless they are lazy-loaded.
- Document all third-party assets in `THIRD_PARTY_NOTICES.md`.
- Do not use third-party game names, logos, characters, or copyrighted artwork.
- Keep `npm run build` passing.

## Coding style

The project is intentionally small and plain JavaScript-based. Prefer readable modules, explicit naming, and simple logic over clever abstractions.
