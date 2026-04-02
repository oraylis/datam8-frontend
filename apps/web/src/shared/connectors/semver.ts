type SemVer = { major: number; minor: number; patch: number };

function parseSemver(raw: string): SemVer {
  const v = (raw || "").trim();
  const m = v.match(/^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:[-+].*)?$/);
  if (!m) throw new Error(`Invalid semver: ${raw}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function cmp(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function upperBoundCaret(v: SemVer): SemVer {
  if (v.major > 0) return { major: v.major + 1, minor: 0, patch: 0 };
  if (v.minor > 0) return { major: 0, minor: v.minor + 1, patch: 0 };
  return { major: 0, minor: 0, patch: v.patch + 1 };
}

function upperBoundTilde(v: SemVer): SemVer {
  return { major: v.major, minor: v.minor + 1, patch: 0 };
}

function parseComparators(req: string): Array<{ op: ">=" | "<=" | "==" | ">" | "<"; ver: SemVer }> {
  const parts = req
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const out: Array<{ op: ">=" | "<=" | "==" | ">" | "<"; ver: SemVer }> = [];
  for (const p of parts) {
    const ops = [">=", "<=", "==", ">", "<"] as const;
    const op = ops.find((o) => p.startsWith(o));
    if (!op) throw new Error(`Invalid version comparator: ${p}`);
    out.push({ op, ver: parseSemver(p.slice(op.length).trim()) });
  }
  return out;
}

export function semverSatisfies(version: string, requirement: string | null | undefined): boolean {
  const req = (requirement || "").trim();
  if (!req) return true;
  const v = parseSemver(version);

  if (req.startsWith("^")) {
    const base = parseSemver(req.slice(1).trim());
    const upper = upperBoundCaret(base);
    return cmp(v, base) >= 0 && cmp(v, upper) < 0;
  }
  if (req.startsWith("~")) {
    const base = parseSemver(req.slice(1).trim());
    const upper = upperBoundTilde(base);
    return cmp(v, base) >= 0 && cmp(v, upper) < 0;
  }

  if (/[<>]=?|==/.test(req) || req.includes(",")) {
    for (const c of parseComparators(req)) {
      const ccmp = cmp(v, c.ver);
      if (c.op === ">=" && ccmp < 0) return false;
      if (c.op === "<=" && ccmp > 0) return false;
      if (c.op === ">" && ccmp <= 0) return false;
      if (c.op === "<" && ccmp >= 0) return false;
      if (c.op === "==" && ccmp !== 0) return false;
    }
    return true;
  }

  return cmp(v, parseSemver(req)) === 0;
}

