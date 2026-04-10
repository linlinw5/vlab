import VCenterClient from "./api-client";

const client = new VCenterClient();

export interface Category {
  id: string;
  name: string;
  description: string;
  cardinality: "SINGLE" | "MULTIPLE";
  associable_types: string[];
  used_by: string[];
}

export interface Tag {
  id: string;
  name: string;
  description: string;
  category_id: string;
  used_by: string[];
}

interface TagAttachment {
  tag_id: string;
  object_ids: Array<{ id: string; type: string }>;
}

export async function getAllCategories(): Promise<string[]> {
  return client.get("/api/cis/tagging/category");
}

export async function getCategoryById(categoryId: string): Promise<Category> {
  return client.get<Category>(`/api/cis/tagging/category/${categoryId}`);
}

export async function createCategory(name: string): Promise<string> {
  return client.post("/api/cis/tagging/category", {
    associable_types: ["VirtualMachine"],
    cardinality: "SINGLE",
    description: name,
    name,
  });
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await client.delete(`/api/cis/tagging/category/${categoryId}`);
}

export async function getAllTags(): Promise<string[]> {
  return client.get("/api/cis/tagging/tag");
}

export async function getTagById(tagId: string): Promise<Tag> {
  return client.get<Tag>(`/api/cis/tagging/tag/${tagId}`);
}

export async function createTag(categoryId: string, name: string, description = ""): Promise<string> {
  return client.post("/api/cis/tagging/tag", {
    category_id: categoryId,
    description: description || name,
    name,
  });
}

export async function updateTag(tagId: string, name: string, description = ""): Promise<void> {
  await client.patch(`/api/cis/tagging/tag/${tagId}`, { name, description: description || name });
}

export async function deleteTag(tagId: string): Promise<void> {
  await client.delete(`/api/cis/tagging/tag/${tagId}`);
}

export async function attachTagToVM(vmId: string, tagId: string): Promise<void> {
  await client.post(`/api/cis/tagging/tag-association/${tagId}?action=attach`, {
    object_id: { id: vmId, type: "VirtualMachine" },
  });
}

export async function listAttachedObjectsOnTags(tagId: string): Promise<string[]> {
  const response = await client.post<TagAttachment[]>("/api/cis/tagging/tag-association?action=list-attached-objects-on-tags", {
    tag_ids: [tagId],
  });
  const vmIds: string[] = [];
  for (const item of response) {
    for (const obj of item.object_ids) {
      if (obj.type === "VirtualMachine") vmIds.push(obj.id);
    }
  }
  return vmIds;
}
