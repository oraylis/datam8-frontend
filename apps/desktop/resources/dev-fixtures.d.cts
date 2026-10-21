import type { Server } from "node:http";
import type { Release } from "./update-policy.cjs";
export function releaseFixture(version?: string, body?: string): Release;
export function demoReleaseServer(currentVersion?: string): Server;
export function desktopFixture(root: string, name: string, repoRoot: string): string;
