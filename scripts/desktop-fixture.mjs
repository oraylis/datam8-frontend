import path from 'node:path';
import { desktopFixture as createFixture } from '../apps/desktop/resources/dev-fixtures.cjs';
export function desktopFixture(root, name) { return createFixture(root, name, path.resolve(import.meta.dirname, '..')); }
