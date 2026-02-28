/**
 * QMD (Quick Markdown Database) integration for vector embeddings
 * Uses qmd CLI for embedding generation and semantic search
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const COLLECTION_NAME = "backpack";
const MAX_TEXT_LENGTH = 8000;

export interface QmdIndexItem {
  id: string;
  text: string;
}

export interface QmdSearchResult {
  id: string;
  score: number;
}

/**
 * Sanitize text for embedding - truncate and clean
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

/**
 * Check if qmd is available in PATH
 */
export async function isQmdAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("which", ["qmd"], { stdio: "pipe" });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

/**
 * Index items for embedding via QMD
 */
export async function indexItems(
  items: QmdIndexItem[],
  options?: { collection?: string; model?: string }
): Promise<void> {
  if (items.length === 0) return;

  const collection = options?.collection ?? COLLECTION_NAME;
  const model = options?.model ?? "text-embedding-3-small";

  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `backpack-embed-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);

  try {
    const lines = items.map((item) =>
      JSON.stringify({ id: item.id, text: sanitizeText(item.text) })
    );
    fs.writeFileSync(tmpFile, lines.join("\n"), "utf8");

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        "qmd",
        ["embed", "--input", tmpFile, "--collection", collection, "--model", model],
        { stdio: ["pipe", "pipe", "pipe"] }
      );

      let stderr = "";
      proc.stderr?.on("data", (d) => (stderr += d.toString()));

      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`qmd embed failed (${code}): ${stderr || "unknown error"}`));
        }
      });
      proc.on("error", (err) => reject(err));
    });
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Search vectors via QMD
 */
export async function searchVectors(
  query: string,
  limit: number = 10,
  options?: { collection?: string }
): Promise<QmdSearchResult[]> {
  const collection = options?.collection ?? COLLECTION_NAME;

  const result = await new Promise<string>((resolve, reject) => {
    const proc = spawn(
      "qmd",
      ["search", query, "--collection", collection, "--limit", String(limit), "--json"],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`qmd search failed (${code}): ${stderr || "unknown error"}`));
      }
    });
    proc.on("error", (err) => reject(err));
  });

  try {
    const parsed = JSON.parse(result.trim());
    if (Array.isArray(parsed)) {
      return parsed.map((r: { id?: string; score?: number }) => ({
        id: r.id ?? "",
        score: typeof r.score === "number" ? r.score : 0,
      }));
    }
    if (parsed.results && Array.isArray(parsed.results)) {
      return parsed.results.map((r: { id?: string; score?: number }) => ({
        id: r.id ?? "",
        score: typeof r.score === "number" ? r.score : 0,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export const qmdClient = {
  indexItems,
  searchVectors,
  isQmdAvailable,
  sanitizeText,
};
