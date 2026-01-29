#!/usr/bin/env bun
/**
 * Syncs version from package.json to all other files that need it.
 * Run with: bun scripts/sync-version.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const rootDir = join(import.meta.dir, "..");
const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8"));
const version = pkg.version;

console.log(`Syncing version ${version} to all files...`);

// Files to update (path relative to root, and the JSON key path)
const jsonFiles = [
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
];

for (const file of jsonFiles) {
  const filePath = join(rootDir, file);
  try {
    const content = JSON.parse(readFileSync(filePath, "utf-8"));

    // Update root version
    if (content.version) {
      content.version = version;
    }

    // Update metadata.version if exists
    if (content.metadata?.version) {
      content.metadata.version = version;
    }

    // Update plugins[].version if exists
    if (content.plugins) {
      for (const plugin of content.plugins) {
        if (plugin.version) {
          plugin.version = version;
        }
      }
    }

    writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n");
    console.log(`  ✓ ${file}`);
  } catch (err) {
    console.error(`  ✗ ${file}: ${err}`);
  }
}

console.log("Done!");
