# Filesystem Picker (Web)

Server-side filesystem browsing for selecting `.dm8s` solutions in browser/server modes.

## Entry Points
- `FileSystemContext.tsx` — stores current path, entries, loading state; exposes `loadFs(path?)`.
- Consumed by the solution picker dialog in `AppShell` to display directories and `.dm8s` files.

## Flow
1) `loadFs` calls `GET /fs/list?path=<optional>`; defaults to server CWD when path is omitted.
2) API returns `{ entries: [{ name, path, type: "file" | "dir" }] }` filtered to dirs + `.dm8s`.
3) Context updates `fsEntries`/`fsPath`; picker renders entries for navigation/selection.

## Extending
- Add client-side sorting/filtering if API changes.
- If API adds metadata (mtime, size), surface via the picker UI.
- Keep requests cheap; avoid recursive scans from the client.

