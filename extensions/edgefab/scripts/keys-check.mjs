// The keys check (EDGEfab #10): the MCP server reads the Tripo and OpenAI keys from REDcode's shared key store
// through its own REDbridge started with --keys, after the environment. Run against the built server, with a
// stand-in REDbridge (JSON-RPC over stdio, keys in memory, as REDbridge 0.18.0 answers keys.*), so no real key,
// store or AI service is touched and nothing is spent.
//
//   npm run build && node extensions/edgefab/scripts/keys-check.mjs

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const server = path.resolve(here, "../../../packages/edgefab-mcp/dist/server.cjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-keys-"));

/** The stand-in: seeded from argv (seed=<service>:<key>), "old" answers keys.* as unknown; every call written to calls.jsonl. */
const stub = `
const fs = require("fs");
const calls = process.argv.find((a) => a.startsWith("calls=")).slice(6);
const keys = Object.create(null);
for (const a of process.argv) if (a.startsWith("seed=")) { const [s, k] = a.slice(5).split(":"); keys[s] = k; }
const old = process.argv.includes("old");
const keysOn = process.argv.includes("--keys");
let buf = Buffer.alloc(0);
const send = (m) => { const b = Buffer.from(JSON.stringify(m)); process.stdout.write("Content-Length: " + b.length + "\\r\\n\\r\\n"); process.stdout.write(b); };
const info = (s) => ({ service: s, name: s, set: s in keys, source: s in keys ? "file" : null, env: s.toUpperCase() + "_API_KEY", last4: s in keys ? keys[s].slice(-4) : null, unreadable: false });
process.stdin.on("data", (c) => {
  buf = Buffer.concat([buf, c]);
  for (;;) {
    const end = buf.indexOf("\\r\\n\\r\\n");
    if (end < 0) return;
    const n = Number(/Content-Length: (\\d+)/.exec(buf.subarray(0, end).toString())[1]);
    if (buf.length < end + 4 + n) return;
    const m = JSON.parse(buf.subarray(end + 4, end + 4 + n).toString());
    buf = buf.subarray(end + 4 + n);
    const p = m.params || {};
    fs.appendFileSync(calls, JSON.stringify({ method: m.method, service: p.service, tool: p.tool, keysOn }) + "\\n");
    if (old) { send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "Method not found" } }); continue; }
    if (m.method === "keys.get") send({ jsonrpc: "2.0", id: m.id, result: { service: p.service, key: keys[p.service] ?? null, source: p.service in keys ? "file" : null, unreadable: false } });
    else if (m.method === "keys.info") send({ jsonrpc: "2.0", id: m.id, result: info(p.service) });
    else send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "Method not found" } });
  }
});
`;

let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed++;
};

/** Starts the server with a stand-in (its args after the script) and the given key variables; returns a client and the stand-in's calls. */
async function start(name, stubArgs, env = {}) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  const calls = path.join(dir, "calls.jsonl");
  const bridge = path.join(dir, "bridge.cjs");
  // The stand-in's own arguments ride on its file: a wrapper that adds them, since the server passes only the script.
  fs.writeFileSync(path.join(dir, "stub.cjs"), stub);
  fs.writeFileSync(bridge, `process.argv.push(${[...stubArgs, `calls=${calls}`].map((a) => JSON.stringify(a)).join(", ")});\nrequire(${JSON.stringify(path.join(dir, "stub.cjs"))});\n`);
  const base = { ...process.env };
  // Never a real key in the child: the owner may have them in the environment.
  delete base.TRIPO_API_KEY;
  delete base.OPENAI_API_KEY;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [server],
    env: { ...base, ...env, EDGEFAB_REDBRIDGE: bridge, EDGEFAB_DATA: path.join(dir, "data"), EDGE_LIBRARY_CONFIG: path.join(dir, "library.json") },
    stderr: "ignore",
  });
  const client = new Client({ name: "keys-check", version: "1" });
  await client.connect(transport);
  const read = () => (fs.existsSync(calls) ? fs.readFileSync(calls, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  const call = async (tool, args = {}) => {
    const r = await client.callTool({ name: tool, arguments: args });
    const text = r.content?.[0]?.text ?? "";
    return { error: !!r.isError, text, json: r.isError ? undefined : JSON.parse(text) };
  };
  return { client, call, calls: read };
}

// 1. Keys in the store, none in the environment: status says both come from REDcode's Keys, read with --keys, and shows no key.
{
  const s = await start("store", ["seed=openai:sk-test-OPENAI-0001"]);
  const r = await s.call("fab_tripo");
  check(!r.error && /REDcode's Keys/.test(r.json.pictures) && /set/.test(r.json.pictures), "status: the OpenAI key is set, from REDcode's Keys");
  check(!r.error && /not set/.test(r.json.key) && /REDcode's Keys view/.test(r.json.key), "status: no Tripo key, and where to set one (REDcode's Keys view)");
  check(!r.text.includes("sk-test-OPENAI-0001") && !r.text.includes("0001"), "status never shows the key or its end");
  check(s.calls().every((c) => c.keysOn) && s.calls().some((c) => c.method === "keys.info"), "REDbridge was started with --keys, and status asked keys.info only");
  check(!s.calls().some((c) => c.method === "keys.get"), "status reads no key (no keys.get)");
  // A picture with no Tripo needed: fab_picture asks keys.get for openai under "EDGEfab MCP". The stand-in key would go to
  // OpenAI, so this asks for a picture change of an item that doesn't exist: the key is read first, then the item refused.
  const p = await s.call("fab_picture", { words: "make it red", prop: "no such prop", from: 1 });
  const got = s.calls().filter((c) => c.method === "keys.get");
  check(got.length === 1 && got[0].service === "openai" && got[0].tool === "EDGEfab MCP", "fab_picture reads the OpenAI key with keys.get, as \"EDGEfab MCP\"");
  check(p.error && !/API key/.test(p.text), `then goes on with the key (here it stops at the missing prop: ${p.text.slice(0, 70)})`);
  await s.client.close();
}

// 2. No key anywhere: plain words that name REDcode's Keys, nothing spent.
{
  const s = await start("none", []);
  const p = await s.call("fab_picture", { words: "a rusty oil drum" });
  check(p.error && /No OpenAI API key is set/.test(p.text) && /REDcode's Keys view, Set Key on OpenAI/.test(p.text), `fab_picture without a key: ${p.text.slice(0, 90)}`);
  const m = await s.call("fab_make", { from: "tripo", prompt: "a rusty oil drum", plan: "paid" });
  check(m.error && /No Tripo API key is set/.test(m.text), "fab_make from words without a key: says no Tripo key is set");
  await s.client.close();
}

// 3. The environment wins: no store call at all.
{
  const s = await start("env", ["seed=openai:sk-test-STORE-0002"], { OPENAI_API_KEY: "sk-test-ENV-0003" });
  const r = await s.call("fab_tripo");
  check(!r.error && /OPENAI_API_KEY in this server's environment/.test(r.json.pictures), "status: OPENAI_API_KEY in the environment wins");
  check(!s.calls().some((c) => c.service === "openai"), "the store isn't asked for a key the environment has");
  await s.client.close();
}

// 4. A REDbridge older than 0.18.0: says to update it.
{
  const s = await start("old", ["old"]);
  const r = await s.call("fab_tripo");
  check(!r.error && /0\.18\.0 or later/.test(r.json.pictures), `an old REDbridge: ${String(r.json?.pictures).slice(0, 100)}`);
  const p = await s.call("fab_picture", { words: "a rusty oil drum" });
  check(p.error && /can't be reached/.test(p.text) && /0\.18\.0/.test(p.text), "fab_picture with an old REDbridge says why, in plain words");
  await s.client.close();
}

fs.rmSync(scratch, { recursive: true, force: true });
console.log(failed ? `${failed} FAILED` : "all passed");
process.exit(failed ? 1 : 0);
