// Where EDGEmat's core comes from until EDGEmat publishes it as @edgemodders/edgemat-core (EDGEmat #7):
// a local checkout of EDGEmat beside this repo, or EDGEMAT_SRC (the checkout's folder). Development builds
// only: the release waits for the package (docs/tools-together.md, rule 1).
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function edgematCore() {
  const checkout = process.env.EDGEMAT_SRC || path.resolve(repo, "..", "EDGEmat");
  const index = path.join(checkout, "extensions", "edgemat", "src", "core", "index.ts");
  if (!fs.existsSync(index)) throw new Error(`EDGEmat's core not found at ${index}. Clone Edgemodders/EDGEmat beside this repo (and npm install there), or set EDGEMAT_SRC.`);
  return index;
}

/** An esbuild plugin that resolves @edgemodders/edgemat-core to EDGEmat's source. */
export const edgematAlias = {
  name: "edgemat-core",
  setup(build) {
    build.onResolve({ filter: /^@edgemodders\/edgemat-core$/ }, () => ({ path: edgematCore() }));
  },
};
