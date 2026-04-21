/** .env.local を読み込んで process.env に注入（最小実装） */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    throw new Error(".env.local が見つかりません: " + path);
  }
  const text = readFileSync(path, "utf-8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
