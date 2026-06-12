# Release Notes (Desktop Backend Runtime)

Desktop no longer depends on `datam8.exe` as the primary runtime.

Release artifacts should provide a Python runtime/module path where `python -m datam8 serve` works.

Minimum runtime checks:

- Backend startup/readiness line parsing
- `GET /health`
- authenticated `GET /config`
- synchronous `POST /generate`

Packaged desktop artifacts must also pass the bundled runtime smoke check:

```sh
npm run test:runtime:packaged -- --release-dir apps/desktop/release
```

This validates the exact `resources/python-runtime` copy that Electron starts in production.
