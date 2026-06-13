import type { EggVariable } from "@prisma/client";

/** Merges egg variable defaults with user-supplied overrides. */
export function buildEnvironment(
  variables: EggVariable[],
  overrides: Record<string, string>
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const v of variables) {
    env[v.envVariable] = overrides[v.envVariable] ?? v.defaultValue;
  }
  return env;
}

/** Replaces {{VAR}} placeholders in the startup command. */
export function resolveStartup(startup: string, env: Record<string, string>): string {
  return startup.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => env[key] ?? "");
}
