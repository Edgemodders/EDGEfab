// The no-key reasons (EDGEfab #10, after REDcode's keys.status, f6c7cbf): when REDcode's store gives no key,
// EDGEfab says why instead of opening a password box when the modder chose Don't Allow, or closed REDcode's
// question while a key is set. Runs the pure rule from src/keyStore.ts, bundled here; no VS Code, no key.
//
//   node extensions/edgefab/scripts/keys-reason-check.mjs

import { build } from "esbuild";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-reason-")), "keyStore.mjs");
await build({ entryPoints: [path.join(here, "../src/keyStore.ts")], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "silent" });
const { noKeyReason } = await import(pathToFileURL(out).href);

let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed++;
};
const s = (set, access, unreadable = false) => ({ service: "tripo", set, source: set ? "file" : null, unreadable, access });
const why = (st) => noKeyReason(st, "Tripo", "EDGEfab", "try");

check(why(undefined) === undefined, "an older REDcode (no status): no reason, ask for a key as before");
check(/You chose Don't Allow/.test(why(s(true, "denied")) ?? "") && /Forget Tool Permissions for Keys/.test(why(s(true, "denied"))), "denied, key set: says Don't Allow and how to change it");
check(/Don't Allow/.test(why(s(false, "denied")) ?? ""), "denied, no key: still no password box");
check(/closed without an answer/.test(why(s(true, "unasked")) ?? "") && /Try again and choose Allow/.test(why(s(true, "unasked"))), "set, question closed: try again and Allow (a box would replace the key)");
check(why(s(false, "unasked")) === undefined, "no key, not asked: the password box");
check(why(s(true, "unasked", true)) === undefined, "set but unreadable (another Windows user): the password box");
check(why(s(false, "allowed")) === undefined, "allowed, no key (removed since): the password box");
check(!/undefined/.test(why(s(true, "denied"))), "the words are whole");

fs.rmSync(path.dirname(out), { recursive: true, force: true });
console.log(failed ? `${failed} FAILED` : "all passed");
process.exit(failed ? 1 : 0);
