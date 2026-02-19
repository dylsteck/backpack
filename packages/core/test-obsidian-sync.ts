/**
 * Test script for Obsidian sync functionality
 * 
 * Usage: bun run packages/core/test-obsidian-sync.ts
 */

import fs from "fs";
import path from "path";
import { getDatabase } from "./src/db/index.js";
import { getConfig, setSourceConfig } from "./src/config/index.js";
import { ObsidianSyncer } from "./src/sync/sources/obsidian.js";
import { createSyncManager } from "./src/sync/manager.js";

const TEST_DIR = path.join(process.cwd(), "test-vault");

/**
 * Create test vault with sample markdown files
 */
async function createTestVault(): Promise<void> {
  console.log("Creating test vault...");

  // Clean up any existing test vault
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }

  // Create vault directory
  fs.mkdirSync(TEST_DIR, { recursive: true });

  // Create note with frontmatter
  fs.writeFileSync(
    path.join(TEST_DIR, "daily-note.md"),
    `---
title: Daily Reflections
tags: [journal, daily]
created: 2024-01-15T10:00:00Z
---

# Morning Thoughts

Today I need to review the [[Q1 Planning]] document.

## Tasks
- [ ] Review #project-alpha timeline
- [ ] Sync with the team on #design-system

Key insight: The integration with [[Project Alpha]] is critical.

#evening #reflection
`,
    "utf-8"
  );

  // Create note with wikilinks
  fs.writeFileSync(
    path.join(TEST_DIR, "q1-planning.md"),
    `---
title: Q1 Planning Document
created: 2024-01-01
---

# Q1 Planning

This document outlines our goals for Q1.

## Key Projects

1. [[Project Alpha]] - Launch by March
2. [[Design System]] - Complete overhaul
3. [[API v2]] - Performance improvements

## Resources

See also: [[Daily Reflections]] for day-to-day notes.
`,
    "utf-8"
  );

  // Create note with inline tags
  fs.writeFileSync(
    path.join(TEST_DIR, "project-alpha.md"),
    `# Project Alpha

Status: #in-progress #high-priority

## Overview

This is our flagship project for Q1. #milestone

## Team

- Alice (Lead) #team-lead
- Bob (Engineering)
- Carol (Design) #design

## Timeline

Target launch: End of March #deadline

## Related

- [[Q1 Planning]]
- [[Design System]]
`,
    "utf-8"
  );

  // Create nested directory
  const nestedDir = path.join(TEST_DIR, "projects", "active");
  fs.mkdirSync(nestedDir, { recursive: true });

  fs.writeFileSync(
    path.join(nestedDir, "design-system.md"),
    `---
title: Design System Overhaul
tags: [design, ui, components]
created: 2024-01-10
---

# Design System Overhaul

Comprehensive redesign of our component library.

## Components

- Button #component
- Card #component
- Modal #component

## Status

Currently in #review phase.

## References

- [[Project Alpha]] will use this system
- [[Q1 Planning]] for timeline
`,
    "utf-8"
  );

  // Create hidden directory that should be skipped
  const hiddenDir = path.join(TEST_DIR, ".obsidian");
  fs.mkdirSync(hiddenDir, { recursive: true });
  fs.writeFileSync(
    path.join(hiddenDir, "workspace.json"),
    '{"layout": "default"}',
    "utf-8"
  );

  // Create a non-markdown file that should be skipped
  fs.writeFileSync(
    path.join(TEST_DIR, "README.txt"),
    "This should be ignored",
    "utf-8"
  );

  console.log(`✓ Created test vault at: ${TEST_DIR}`);
}

/**
 * Run sync test
 */
async function runTest(): Promise<void> {
  console.log("\n=== Obsidian Sync Test ===\n");

  // Step 1: Create test vault
  await createTestVault();

  // Step 2: Initialize database
  const dbPath = path.join(process.cwd(), "test-sync.db");
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  const db = getDatabase(dbPath);
  console.log(`✓ Initialized test database: ${dbPath}`);

  // Step 3: Set up config
  const config = getConfig();
  setSourceConfig("obsidian", {
    type: "obsidian",
    enabled: true,
    config: {
      vaultPath: TEST_DIR,
    },
  });
  console.log("✓ Configured Obsidian source");

  // Step 4: Create sync manager and register Obsidian syncer
  const manager = createSyncManager(db);
  const obsidianSyncer = new ObsidianSyncer(db, {
    vaultPath: TEST_DIR,
  });
  manager.register(obsidianSyncer);
  console.log("✓ Registered Obsidian syncer");

  // Step 5: Run first sync
  console.log("\n--- First Sync (Full) ---");
  const result1 = await manager.syncSource("obsidian", {
    onProgress: (progress) => {
      console.log(`  ${progress.status}: ${progress.itemsFound} found, ${progress.itemsAdded} added, ${progress.itemsUpdated} updated`);
    },
  });

  console.log(`\nResult: ${result1.status}`);
  console.log(`  Items found: ${result1.itemsFound}`);
  console.log(`  Items added: ${result1.itemsAdded}`);
  console.log(`  Items updated: ${result1.itemsUpdated}`);
  console.log(`  Errors: ${result1.errors.length}`);

  if (result1.errors.length > 0) {
    console.log("  Error details:", result1.errors);
  }

  // Step 6: Verify database contents
  console.log("\n--- Database Verification ---");
  const items = await db.query.timelineItems.findMany({
    where: (items, { eq }) => eq(items.source, "obsidian"),
  });

  console.log(`Total items in database: ${items.length}`);

  for (const item of items) {
    console.log(`\n  [${item.externalId}]`);
    console.log(`    Title: ${item.title}`);
    console.log(`    Type: ${item.type}`);
    
    if (item.rawData) {
      const raw = JSON.parse(item.rawData);
      console.log(`    Tags: ${raw.tags?.join(", ") || "none"}`);
      console.log(`    Wikilinks: ${raw.wikilinks?.join(", ") || "none"}`);
      console.log(`    File size: ${raw.fileSize} bytes`);
    }
  }

  // Step 7: Test incremental sync
  console.log("\n--- Incremental Sync Test ---");
  
  // Modify one file (wait a bit to ensure mtime changes)
  await new Promise((resolve) => setTimeout(resolve, 100));
  const filePath = path.join(TEST_DIR, "daily-note.md");
  const modifiedContent = fs.readFileSync(filePath, "utf-8");
  fs.writeFileSync(
    filePath,
    modifiedContent + "\n\n# Evening Update\n\nAdded more content here.",
    "utf-8"
  );
  // Force sync to ensure file is written
  fs.fsyncSync?.(fs.openSync(filePath, 'r+'));
  console.log("✓ Modified daily-note.md");
  // Verify the write
  const verifyContent = fs.readFileSync(filePath, "utf-8");
  console.log(`  File now has ${verifyContent.length} chars, contains 'Evening Update': ${verifyContent.includes("Evening Update")}`);

  // Add a new file
  fs.writeFileSync(
    path.join(TEST_DIR, "new-note.md"),
    `# New Note

This is a newly created file.

#new-tag
`,
    "utf-8"
  );
  console.log("✓ Created new-note.md");

  // Run sync again
  console.log("\n--- Second Sync (Incremental) ---");
  const result2 = await manager.syncSource("obsidian", {
    onProgress: (progress) => {
      console.log(`  ${progress.status}: ${progress.itemsFound} found, ${progress.itemsAdded} added, ${progress.itemsUpdated} updated`);
    },
  });

  console.log(`\nResult: ${result2.status}`);
  console.log(`  Items found: ${result2.itemsFound}`);
  console.log(`  Items added: ${result2.itemsAdded}`);
  console.log(`  Items updated: ${result2.itemsUpdated}`);
  console.log(`  Expected: 1 updated (daily-note), 1 added (new-note), 2 unchanged`);

  // Step 8: Verify incremental sync worked
  const itemsAfter = await db.query.timelineItems.findMany({
    where: (items, { eq }) => eq(items.source, "obsidian"),
  });
  console.log(`\nTotal items after second sync: ${itemsAfter.length}`);

  // Find the updated daily note
  const dailyNote = itemsAfter.find((i) => i.externalId === "daily-note.md");
  if (dailyNote) {
    console.log("\n✓ Daily note was updated");
    console.log(`  Content length: ${dailyNote.content?.length} chars`);
    console.log(`  Contains 'Evening Update': ${dailyNote.content?.includes("Evening Update")}`);
  }

  // Find the new note
  const newNote = itemsAfter.find((i) => i.externalId === "new-note.md");
  if (newNote) {
    console.log("\n✓ New note was added");
    console.log(`  Title: ${newNote.title}`);
    if (newNote.rawData) {
      const raw = JSON.parse(newNote.rawData);
      console.log(`  Tags: ${raw.tags?.join(", ")}`);
    }
  }

  // Step 9: Verify wikilinks and tags parsing
  console.log("\n--- Metadata Verification ---");
  
  const q1Planning = itemsAfter.find((i) => i.externalId === "q1-planning.md");
  if (q1Planning?.rawData) {
    const raw = JSON.parse(q1Planning.rawData);
    console.log("Q1 Planning:");
    console.log(`  Wikilinks found: ${raw.wikilinks?.length || 0}`);
    console.log(`  Expected wikilinks: Project Alpha, Design System, API v2, Daily Reflections`);
    
    const expectedLinks = ["Project Alpha", "Design System", "API v2", "Daily Reflections"];
    const hasAllLinks = expectedLinks.every((link) => 
      raw.wikilinks?.includes(link)
    );
    console.log(`  ✓ All wikilinks present: ${hasAllLinks}`);
  }

  const projectAlpha = itemsAfter.find((i) => i.externalId === "project-alpha.md");
  if (projectAlpha?.rawData) {
    const raw = JSON.parse(projectAlpha.rawData);
    console.log("\nProject Alpha:");
    console.log(`  Tags found: ${raw.tags?.length || 0}`);
    const expectedTags = ["in-progress", "high-priority", "milestone", "team-lead", "design", "deadline"];
    const hasAllTags = expectedTags.every((tag) => 
      raw.tags?.includes(tag)
    );
    console.log(`  Expected tags: ${expectedTags.join(", ")}`);
    console.log(`  ✓ All tags present: ${hasAllTags}`);
  }

  // Cleanup
  console.log("\n--- Cleanup ---");
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
    console.log("✓ Removed test vault");
  }
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log("✓ Removed test database");
  }

  console.log("\n=== Test Complete ===");
  
  // Return success/failure
  const success = 
    itemsAfter.length === 5 && // 4 original + 1 new - hidden file skipped
    result2.itemsAdded === 1 && // new-note.md
    result2.itemsUpdated === 1; // daily-note.md

  if (success) {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests failed");
    console.log(`  Expected 5 items, got ${itemsAfter.length}`);
    console.log(`  Expected 1 added, got ${result2.itemsAdded}`);
    console.log(`  Expected 1 updated, got ${result2.itemsUpdated}`);
    process.exit(1);
  }
}

// Run test
runTest().catch((error) => {
  console.error("Test failed with error:", error);
  process.exit(1);
});
