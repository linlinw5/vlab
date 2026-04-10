/**
 * Persists the vCenter CIS category ID and default group tag ID to a local JSON file.
 * Both are created once on startup and reused forever.
 */
import fs from "fs";
import path from "path";
import { createCategory, getAllCategories, getCategoryById, createTag, getAllTags, getTagById } from "./cis-operations";
import { config } from "../../config";
import { logDebug } from "../../lib/logger";

const STORE_PATH = path.resolve(process.cwd(), "data", "vcenter-state.json");

interface VCenterState {
  categoryId: string;
  defaultGroupTagId: string;
}

function readStore(): VCenterState | null {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw) as VCenterState;
  } catch {
    return null;
  }
}

function writeStore(state: VCenterState): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

export function getCategoryId(): string {
  const store = readStore();
  if (!store?.categoryId) {
    throw new Error("vCenter category not initialized. Call initVCenterCategory() on startup.");
  }
  return store.categoryId;
}

export function getDefaultGroupTagId(): string {
  const store = readStore();
  if (!store?.defaultGroupTagId) {
    throw new Error("vCenter default group tag not initialized. Call initVCenterCategory() on startup.");
  }
  return store.defaultGroupTagId;
}

const CATEGORY_NAME = config.vcenter.categoryName;
const DEFAULT_GROUP_NAME = config.vcenter.defaultGroupName;

export async function initVCenterCategory(): Promise<void> {
  const existing = readStore();

  // Determine categoryId
  let categoryId: string;
  if (existing?.categoryId) {
    logDebug("vmware", "vcenter_category_init", {
      message: "Category already initialized",
      categoryId: existing.categoryId,
    });
    categoryId = existing.categoryId;
  } else {
    // Search vCenter for an existing category with the same name
    const allIds = await getAllCategories();
    let found: string | null = null;
    for (const id of allIds) {
      const cat = await getCategoryById(id);
      if (cat.name === CATEGORY_NAME) {
        found = id;
        break;
      }
    }

    if (found) {
      logDebug("vmware", "vcenter_category_init", { message: "Found existing category", categoryId: found });
      categoryId = found;
    } else {
      logDebug("vmware", "vcenter_category_init", { message: "Creating CIS category" });
      categoryId = await createCategory(CATEGORY_NAME);
      logDebug("vmware", "vcenter_category_init", { message: "Category created", categoryId });
    }
  }

  // Determine defaultGroupTagId
  let defaultGroupTagId: string;
  if (existing?.defaultGroupTagId) {
    logDebug("vmware", "vcenter_default_group_tag_init", {
      message: "Default group tag already initialized",
      defaultGroupTagId: existing.defaultGroupTagId,
    });
    defaultGroupTagId = existing.defaultGroupTagId;
  } else {
    // Search vCenter for an existing tag with the default group name under this category
    const allTagIds = await getAllTags();
    let found: string | null = null;
    for (const id of allTagIds) {
      const tag = await getTagById(id);
      if (tag.name === DEFAULT_GROUP_NAME && tag.category_id === categoryId) {
        found = id;
        break;
      }
    }

    if (found) {
      logDebug("vmware", "vcenter_default_group_tag_init", {
        message: "Found existing default group tag",
        defaultGroupTagId: found,
      });
      defaultGroupTagId = found;
    } else {
      logDebug("vmware", "vcenter_default_group_tag_init", { message: "Creating default group tag" });
      defaultGroupTagId = await createTag(categoryId, DEFAULT_GROUP_NAME, "System Default Group - DO NOT DELETE");
      logDebug("vmware", "vcenter_default_group_tag_init", { message: "Default group tag created", defaultGroupTagId });
    }
  }

  // Only write if something changed
  if (existing?.categoryId !== categoryId || existing?.defaultGroupTagId !== defaultGroupTagId) {
    writeStore({ categoryId, defaultGroupTagId });
  }
}
