// The modder's AI service keys, as far as core goes: a key passed in by the caller, else the service's
// environment variable. The extension reads its keys from REDcode's Keys (or, with an older REDcode, VS Code's
// secret storage) and passes them in (src/keys.ts); the MCP server reads REDcode's Keys through its own REDbridge
// (src/keyStore.ts, EDGEfab #10). Core reads no key file: REDbridge keeps the store.
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
