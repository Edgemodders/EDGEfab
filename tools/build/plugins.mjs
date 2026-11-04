// esbuild plugins shared by the extension's and the MCP server's builds.
import * as fs from "node:fs";

/** glTF-Transform's texture compression uses sharp, a native image library; EDGEfab doesn't compress textures. */
export const noSharp = {
  name: "no-sharp",
  setup(build) {
    build.onResolve({ filter: /^sharp$/ }, () => ({ path: "sharp", namespace: "stub" }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "module.exports = undefined;" }));
  },
};

/** mikktspace reads its WebAssembly from a file beside its script; this puts the bytes in the bundle instead,
 *  so each bundle (the MCP server above all) is one file. */
export const inlineMikktspace = {
  name: "inline-mikktspace",
  setup(build) {
    build.onLoad({ filter: /mikktspace_main\.js$/ }, (args) => {
      const source = fs.readFileSync(args.path, "utf8").replace(/\r\n/g, "\n");
      const read = "const path = require('path').join(__dirname, 'mikktspace_main_bg.wasm');\nconst bytes = require('fs').readFileSync(path);";
      if (!source.includes(read)) throw new Error("mikktspace changed how it loads its WebAssembly: update tools/build/plugins.mjs");
      const wasm = fs.readFileSync(args.path.replace(/mikktspace_main\.js$/, "mikktspace_main_bg.wasm")).toString("base64");
      return { contents: source.replace(read, `const bytes = Buffer.from("${wasm}", "base64");`), loader: "js" };
    });
  },
};
