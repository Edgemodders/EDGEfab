// The modder's AI service keys, as far as core goes: a key passed in by the caller, else the service's
// environment variable. The extension keeps its keys in VS Code's own encrypted secret storage and passes them
// in (src/keys.ts); the MCP server, which runs without VS Code, has its environment only.
//
// The EDGE tools' shared key store (keys.mjs) is shelved (owner, 2026-11-11, EDGEfab #4): it decrypted key files
// through PowerShell, and the VS Code Marketplace refused EDGEhack for "suspicious content" with it inside.
// Never print a key, put it on a command line or in a child's environment.

export type KeyService = "tripo" | "openai";

export const KeyServices: Record<KeyService, { name: string; env: string; prefix?: string; from: string }> = {
  tripo: { name: "Tripo", env: "TRIPO_API_KEY", prefix: "tsk_", from: "platform.tripo3d.ai, under API Keys" },
  openai: { name: "OpenAI", env: "OPENAI_API_KEY", prefix: "sk-", from: "platform.openai.com, under API keys" },
};

const Key = /^[\x21-\x7e]{1,4096}$/; // printable ASCII, no spaces or line breaks

/** What is wrong with a typed key, in words, or null. */
export function checkKey(service: KeyService, key: string): string | null {
  const k = key.trim();
  if (!Key.test(k)) return "A key is one line of letters, digits and signs, with no spaces";
  const { name, prefix } = KeyServices[service];
  if (prefix && !k.startsWith(prefix)) return `${name} keys start with ${prefix}`;
  return null;
}

/** The key from the service's environment variable, when set. */
export function envKey(service: KeyService): string | undefined {
  return process.env[KeyServices[service].env]?.trim() || undefined;
}
