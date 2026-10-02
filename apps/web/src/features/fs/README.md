# Filesystem Picker (Web)

Legacy filesystem context for server-side browsing. The current pinned Generator
does not register `/fs/list`, and the active solution dialog uses the startup-bound
workspace instead. This README describes the retained context, not a working picker.

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

