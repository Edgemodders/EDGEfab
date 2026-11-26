// Checks that EDGEFAB_REDBRIDGE reaches the REDbridge the MCP server starts for game files (fab_add, the Library),
// not only its key store (EDGEchat #5). Uses the built core package.
// Usage: node scripts/bridge-env-check.mjs <REDbridge.exe>   (run `npm run build` at the repo root first)
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const core = createRequire(import.meta.url)(path.join(here, "..", "..", "..", "packages", "edgefab-core", "dist", "index.cjs"));
const real = process.argv[2];
if (!real) {
  console.log("Usage: node scripts/bridge-env-check.mjs <REDbridge.exe>");
  process.exit(2);
}
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed++;
};

process.env.EDGEFAB_REDBRIDGE = path.join(path.parse(real).root, "nowhere", "REDbridge.exe");
try {
  await core.startBridge();
  check(false, "a path with no REDbridge is refused");
} catch (e) {
  check(/EDGEFAB_REDBRIDGE names .*no REDbridge\.exe there/.test(e.message), `a path with no REDbridge is refused: ${e.message}`);
}

process.env.EDGEFAB_REDBRIDGE = path.dirname(real);
const lines = [];
const b = await core.startBridge((l) => lines.push(l));
check(lines[0]?.startsWith(`starting ${path.resolve(real)}`), `a folder finds REDbridge.exe in it: ${lines[0]}`);
const info = await b.client.info();
check(info.gameLoaded === true, "the game is loaded");
b.client.stop?.();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
