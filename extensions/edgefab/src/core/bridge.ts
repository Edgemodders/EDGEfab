// REDbridge for EDGEfab: one call function, from whichever bridge is there (docs/tools-together.md, rule 4).
// In VS Code it is REDcode's (REDcodeApi.bridge()); the MCP server starts its own when it needs one, found
// as EDGEmat finds it (edgemat.* or redcode.* settings, PATH).

import { BridgeClient, isGameFolder, resolveBridge, resolveGame, vscodeUserSettings, type BridgeCall } from "@edgemodders/edgemat-core";

/**
 * The call function of a running BridgeClient (REDcode's or EDGEmat's copy). Its wrappers differ between
 * copies (EDGEmat's import has no template yet), so EDGEfab calls REDbridge's methods by name.
 */
export function callOf(client: unknown): BridgeCall {
  const c = client as { call?: (method: string, params?: Record<string, unknown>) => Promise<unknown> };
  if (typeof c?.call !== "function") throw new Error("That REDbridge client can't take calls by name.");
  return (method, params) => c.call!.call(client, method, params);
}

/** Starts a REDbridge with the game loaded, for tools outside VS Code. */
export async function startBridge(log: (line: string) => void = () => undefined): Promise<{ client: BridgeClient; call: BridgeCall }> {
  const settings = vscodeUserSettings();
  const game = await resolveGame(settings, {}, true);
  if (!game || !isGameFolder(game.path)) throw new Error("No Cyberpunk 2077 folder found. Set redcode.gamePath in VS Code.");
  const choice = resolveBridge(settings);
  if (!choice) throw new Error("REDbridge.exe not found. Set redcode.bridgePath in VS Code, or put REDbridge on PATH.");
  log(`starting ${choice.exe} for ${game.path}`);
  const client = new BridgeClient({ exe: choice.exe, gamePath: game.path, dotnetRoot: choice.dotnetRoot });
  client.on("log", (line: string) => log(`bridge | ${line}`));
  client.start();
  const info = await client.info();
  if (!info.gameLoaded) await client.load(game.path);
  return { client, call: callOf(client) };
}
