import type { ChildProcess } from 'node:child_process';
export function terminateChild(proc: ChildProcess, graceMs?: number): Promise<void>;
