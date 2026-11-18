// Release notes from docs/changelog.md, the one changelog (the same way as REDnode's
// tools/release/notes.mjs). The release workflow uses it, and stops when the version has no section.
//
//   node tools/release/notes.mjs [version]              markdown for the GitHub release, with the install lines
//   node tools/release/notes.mjs [version] --nexus      the section's short Nexus summary (below), for
//                                                       Nexus's changelog field; stops when there is none
//   node tools/release/notes.mjs --extension            writes extensions/edgefab/CHANGELOG.md, the
//                                                       extension's Changelog tab (vscode:prepublish runs it)
//   --out <file>                                        writes the notes to a file (UTF-8)
//
// The version defaults to the extension's package.json version.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const nexus = args.includes("--nexus");
const extension = args.includes("--extension");
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
const versionFile = "extensions/edgefab/package.json";
const version = args.find((a) => !a.startsWith("--")) ?? JSON.parse(readFileSync(root + versionFile, "utf8")).version;
const changelog = "docs/changelog.md";
const lines = readFileSync(root + changelog, "utf8").split(/\r?\n/);
const Docs = "https://edgemodders.github.io/EDGEfab/";

if (extension) {
  // Every section from Unreleased down, without the page's own notes on keeping it; an empty Unreleased is left out.
  const first = lines.findIndex((line) => line.startsWith("## "));
  const sections = [];
  for (let i = first; i >= 0 && i < lines.length; ) {
    let end = lines.findIndex((line, j) => j > i && line.startsWith("## "));
    if (end < 0) end = lines.length;
    const body = withoutNexus(lines.slice(i + 1, end));
    if (!(/^## Unreleased/.test(lines[i]) && !body.some((line) => line.trim()))) sections.push(lines[i], ...body);
    i = end < lines.length ? end : -1;
  }
  const text = `# Changelog\n\nWhat changed in each EDGEfab release. Also on the docs site: ${Docs}changelog.html\n\n${sections.join("\n").trim()}\n`;
  writeFileSync(root + "extensions/edgefab/CHANGELOG.md", text, "utf8");
  console.log("extensions/edgefab/CHANGELOG.md written from docs/changelog.md");
  process.exit(0);
}

// "## 0.2.0" or "## 0.2.0 (2026-10-20)" or "## 0.1.0 (2026-10-16), M1 Library"
const heading = new RegExp(`^## ${version.replace(/\./g, "\\.")}(\\s|,|$)`);
const start = lines.findIndex((line) => heading.test(line));
if (start < 0) {
  console.error(`${changelog} has no section for ${version}: rename Unreleased to "## ${version} (date)" first`);
  process.exit(1);
}
let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
if (end < 0) end = lines.length;
const section = lines.slice(start + 1, end);
if (!section.some((line) => line.trim())) {
  console.error(`${changelog}: the section for ${version} is empty`);
  process.exit(1);
}

if (nexus) {
  // Nexus shows each line of a version's changelog as one entry, as plain text in a small field, and
  // cannot edit it once posted. So its lines are a short summary written by hand in the section, not
  // the section itself (EDGEfab #8; the rules are EDGErepo's, README "Nexus changelogs"):
  //
  //   <!-- nexus
  //   New: Generate from Words: a picture first, then the 3D model
  //   Fixed: A renamed prop kept its old file names
  //   -->
  //
  // An HTML comment, so GitHub and the docs site show none of it. Each line starts with New:,
  // Changed:, Fixed:, Removed:, Other: or Needs:, has no markdown and at most NEXUS_LINE characters; at
  // most NEXUS_LINES lines. A "Full changelog" line with the link is added at the end.
  const NEXUS_LINE = 120;
  const NEXUS_LINES = 12;
  const open = section.findIndex((line) => line.trim() === "<!-- nexus");
  const close = open < 0 ? -1 : section.findIndex((line, i) => i > open && line.trim() === "-->");
  if (open < 0 || close < 0) {
    console.error(`${changelog}: the section for ${version} has no Nexus summary. Add one under its heading:

<!-- nexus
New: one short line per change, at most ${NEXUS_LINE} characters
-->`);
    process.exit(1);
  }
  const summary = section.slice(open + 1, close).map((line) => line.trim()).filter(Boolean);
  const wrong = [];
  if (!summary.length) wrong.push("it is empty");
  if (summary.length > NEXUS_LINES) wrong.push(`${summary.length} lines, at most ${NEXUS_LINES}`);
  for (const line of summary) {
    const short = line.length > 50 ? `${line.slice(0, 50)}...` : line;
    if (!/^(New|Changed|Fixed|Removed|Other|Needs): \S/.test(line)) wrong.push(`"${short}" does not start with New:, Changed:, Fixed:, Removed:, Other: or Needs:`);
    if (line.length > NEXUS_LINE) wrong.push(`"${short}" is ${line.length} characters, at most ${NEXUS_LINE}`);
    if (/`|\*\*|\]\(|^#|^- /.test(line)) wrong.push(`"${short}" has markdown`);
  }
  if (wrong.length) {
    console.error(`${changelog}: the Nexus summary for ${version}:\n- ${wrong.join("\n- ")}`);
    process.exit(1);
  }
  write([...summary, `Full changelog: ${Docs}changelog.html`].join("\n"));
} else {
  write(`${withoutNexus(section).join("\n").trim()}

**Install:** in VS Code's Extensions view, search for **EDGEfab** and press **Install** ([VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=edgemodders.edgefab), [Open VSX](https://open-vsx.org/extension/edgemodders/edgefab)). Or download \`edgefab-${version}.vsix\` below and run \`code --install-extension edgefab-${version}.vsix\`. Windows only. Generate with Tripo needs your own Tripo API key; Add to Project needs [REDcode](https://github.com/Edgemodders/REDcode).

**For AI assistants:** the extension carries EDGEfab's MCP server. In VS Code, run **EDGEfab: Connect an Assistant (MCP)...** to connect Claude Code; agents inside VS Code 1.101 or later see the tools with no setup. Without VS Code: [\`@edgemodders/edgefab-mcp\`](https://www.npmjs.com/package/@edgemodders/edgefab-mcp) on npm, or \`edgefab-mcp-${version}.cjs\` below, one file for Node.js 20 or later.

Docs: ${Docs} (changelog: ${Docs}changelog.html)`);
}

// A section without its Nexus summary (the <!-- nexus ... --> block): for GitHub and the extension's tab.
function withoutNexus(section) {
  const kept = [];
  let inBlock = false;
  for (const line of section) {
    if (!inBlock && line.trim() === "<!-- nexus") inBlock = true;
    else if (inBlock && line.trim() === "-->") inBlock = false;
    else if (!inBlock) kept.push(line);
  }
  return kept;
}

function write(text) {
  if (out) writeFileSync(out, text + "\n", "utf8");
  else console.log(text);
}
