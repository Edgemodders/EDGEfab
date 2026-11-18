// Builds a scratch Desk, Library and project for the wiki's screenshots (EDGEweb, docs/wiki/edgefab), from
// read-only copies of the props on the real Desk (change `names` to the ones there). Needs the game, for REDbridge.
// Usage, after npm run build: node tools/shots/setup.cjs <a scratch folder, such as ..\Projects\EDGEfab_WikiShots>
// Nothing here touches the real Desk or Library: EDGEFAB_DATA and EDGE_LIBRARY_CONFIG point into ROOT.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.argv[2];
const REAL = path.join(process.env.LOCALAPPDATA, "EDGEfab", "desk");
fs.rmSync(ROOT, { recursive: true, force: true });
fs.mkdirSync(ROOT, { recursive: true });
process.env.EDGEFAB_DATA = path.join(ROOT, "edgefab");
process.env.EDGE_LIBRARY_CONFIG = path.join(ROOT, "library.json");
delete process.env.OPENAI_API_KEY;
delete process.env.TRIPO_API_KEY;
const core = require(path.join(__dirname, "..", "..", "extensions", "edgefab", "dist", "core.js"));

(async () => {
  const desk = core.deskDir();
  fs.mkdirSync(desk, { recursive: true });
  const names = {
    "red_vending": "Neon vending machine",
    "vending_e2e": "Street vending machine",
    "a_battered_cyberpunk_vending_machine_wit": "Battered vending machine",
    "a_rusty_blue_oil_drum": "Rusty blue oil drum",
  };
  const folders = {};
  for (const [from, title] of Object.entries(names)) {
    const copy = path.join(desk, `${from}.prop.asset`);
    fs.cpSync(path.join(REAL, `${from}.prop.asset`), copy, { recursive: true });
    const r = await core.renameItem(copy, title, { version: "0.1.0" });
    folders[title] = r.folder;
    console.log("desk:", path.basename(r.folder));
  }
  core.writeSettings({ tripoPlan: "paid" });

  const lib = path.join(ROOT, "EDGE Library");
  for (const f of ["Production/Props", "Development", "Models"]) fs.mkdirSync(path.join(lib, f), { recursive: true });
  core.setLibraryRoot(lib);
  core.setModderFolder("nightowl");
  fs.copyFileSync(path.join(REAL, "vending_e2e.prop.asset", "source", "raw", "vending_e2e", "original.glb"), path.join(lib, "Models", "kiosk_from_store.glb"));

  const proj = path.join(ROOT, "NeonProps");
  fs.mkdirSync(path.join(proj, "source", "archive"), { recursive: true });
  fs.mkdirSync(path.join(proj, "source", "raw"), { recursive: true });
  fs.writeFileSync(path.join(proj, "NeonProps.cpmodproj"), `<?xml version="1.0" encoding="utf-8"?>\n<CP77Mod xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n  <Name>NeonProps</Name>\n  <ModName>NeonProps</ModName>\n  <Author></Author>\n  <Email />\n  <Description />\n  <Version>1.0.0</Version>\n</CP77Mod>\n`);

  const bridge = await core.startBridge();
  try {
    const added = await core.addToLibrary({ item: folders["Street vending machine"], root: lib, folder: "Production/Props", useGamePath: false, modder: "nightowl", call: bridge.call, tool: "EDGEfab 0.1.0" });
    console.log("library:", added.rel, "version", added.version);
    const r = await core.addToProject({ item: folders["Neon vending machine"], project: core.projectFolders(proj), call: bridge.call });
    console.log("project:", r.entity, r.materials.length, "materials");
  } finally {
    bridge.client.stop();
  }
  console.log("done");
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
