import { Command, Flags } from "@oclif/core";
import { getConfig, setConfig, setSecret } from "@cortex/core";

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((o: unknown, key) => {
    if (o && typeof o === "object" && key in o) {
      return (o as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function buildPartialFromPath(path: string, value: unknown): Record<string, unknown> {
  const parts = path.split(".");
  let result: Record<string, unknown> = {};
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = {};
    (current as Record<string, unknown>)[key] = next;
    current = next as Record<string, unknown>;
  }
  (current as Record<string, unknown>)[parts[parts.length - 1]] = value;
  return result;
}

function parseValue(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (!Number.isNaN(num)) return num;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export default class Config extends Command {
  static description = "Manage Cortex configuration";

  static flags = {
    get: Flags.string({ description: "Get config value (dot notation)" }),
    set: Flags.string({ description: "Set config value (key=value)" }),
    "set-secret": Flags.string({ description: "Set secret in keychain (key=value)" }),
    unset: Flags.string({ description: "Remove config value" }),
    json: Flags.boolean({ char: "j", description: "Output as JSON" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Config);

    if (flags["set-secret"]) {
      const [key, ...valueParts] = flags["set-secret"].split("=");
      const value = valueParts.join("=").trim();
      if (!key || value === undefined) {
        this.error("Usage: cortex config --set-secret key=value");
      }
      await setSecret(key.trim(), value);
      this.log(`Set secret ${key.trim()} (stored in keychain)`);
      return;
    }

    if (flags.get) {
      const config = getConfig() as Record<string, unknown>;
      const value = getNested(config, flags.get);
      if (flags.json) {
        this.log(JSON.stringify({ [flags.get]: value }));
      } else {
        this.log(JSON.stringify(value, null, 2));
      }
      return;
    }

    if (flags.set) {
      const eqIndex = flags.set.indexOf("=");
      if (eqIndex === -1) {
        this.error("Usage: cortex config --set key=value");
      }
      const key = flags.set.slice(0, eqIndex).trim();
      const value = parseValue(flags.set.slice(eqIndex + 1).trim());
      const partial = buildPartialFromPath(key, value);
      setConfig(partial as Parameters<typeof setConfig>[0]);
      this.log(`Set ${key} = ${JSON.stringify(value)}`);
      return;
    }

    if (flags.unset) {
      const partial = buildPartialFromPath(flags.unset, undefined);
      setConfig(partial as Parameters<typeof setConfig>[0]);
      this.log(`Unset ${flags.unset}`);
      return;
    }

    const config = getConfig();
    if (flags.json) {
      this.log(JSON.stringify(config, null, 2));
    } else {
      this.log("Current configuration:");
      this.log(JSON.stringify(config, null, 2));
    }
  }
}
