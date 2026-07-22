import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

let version;
try {
    version = execSync('git rev-parse --short HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
} catch {
    version = Date.now().toString(36);
}

writeFileSync(
    join(__dirname, '..', 'public', 'version.json'),
    JSON.stringify({ version, builtAt: new Date().toISOString() })
);

console.log(`Generated version.json — version: ${version}`);
