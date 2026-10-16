import type { ChildProcessWithoutNullStreams } from 'node:child_process';
type Ready = { baseUrl: string; version: string };
export function waitForBackendReady(proc: ChildProcessWithoutNullStreams, timeoutMs?: number, signal?: AbortSignal): Promise<Ready>;
export function waitForBackendHealth(baseUrl: string, token: string, timeoutMs?: number, signal?: AbortSignal): Promise<void>;
