import type { Category, Sticker } from '../models/types';

export interface FlattenedCategory {
  category: Category;
  depth: number;
}

function indexChildren(categories: Category[]): Map<string | null, Category[]> {
  const children = new Map<string | null, Category[]>();
  for (const category of categories) {
    const parentId = category.parentId ?? null;
    const siblings = children.get(parentId);
    if (siblings) siblings.push(category);
    else children.set(parentId, [category]);
  }
  return children;
}

/** Children of a folder. null means top-level. */
export function getChildren(categories: Category[], parentId: string | null): Category[] {
  return categories.filter((c) => (c.parentId ?? null) === parentId);
}

export function getVisibleChildren(children: Category[], expanded: boolean, collapsedLimit = 4): Category[] {
  return expanded ? children : children.slice(0, collapsedLimit);
}

/** Index once instead of scanning the full category list for every descendant. */
export function getDescendantIds(categoryId: string, categories: Category[]): string[] {
  const children = indexChildren(categories);
  const visited = new Set<string>();
  const stack = [categoryId];
  while (stack.length) {
    const id = stack.pop()!;
    if (!id || visited.has(id)) continue;
    visited.add(id);
    for (const child of children.get(id) ?? []) stack.push(child.id);
  }
  return [...visited];
}

/** Iterative traversal also tolerates deep or cyclic imported category data. */
export function flattenCategoryTree(categories: Category[], parentId: string | null = null, depth = 0): FlattenedCategory[] {
  const children = indexChildren(categories);
  const result: FlattenedCategory[] = [];
  const visited = new Set<string>();
  const stack = (children.get(parentId) ?? []).map(category => ({ category, depth })).reverse();
  while (stack.length) {
    const entry = stack.pop()!;
    if (visited.has(entry.category.id)) continue;
    visited.add(entry.category.id);
    result.push(entry);
    const descendants = children.get(entry.category.id) ?? [];
    for (let i = descendants.length - 1; i >= 0; i--) {
      stack.push({ category: descendants[i], depth: entry.depth + 1 });
    }
  }
  return result;
}

export function getCategoryPath(categoryId: string | null, categories: Category[]): Category[] {
  const byId = new Map(categories.map(category => [category.id, category]));
  const result: Category[] = [];
  const visited = new Set<string>();
  let current = categoryId ? byId.get(categoryId) : undefined;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    result.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return result.reverse();
}

/** Count direct stickers once, then add each folder's count to its ancestors. */
export function countStickersByCategory(stickers: Sticker[], categories: Category[]): Record<string, number> {
  const byId = new Map(categories.map(category => [category.id, category]));
  const direct = new Map<string, number>();
  for (const sticker of stickers) {
    if (sticker.categoryId && byId.has(sticker.categoryId)) {
      direct.set(sticker.categoryId, (direct.get(sticker.categoryId) ?? 0) + 1);
    }
  }
  const counts: Record<string, number> = Object.create(null);
  for (const [id, count] of direct) {
    const visited = new Set<string>();
    let current = byId.get(id);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      counts[current.id] = (counts[current.id] ?? 0) + count;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return counts;
}

/** Category matches belong to the sticker itself, not unrelated folders. */
export function searchStickers(stickers: Sticker[], categories: Category[], query: string): Sticker[] {
  const q = query.trim().toLowerCase();
  if (!q) return stickers;
  const matchingCategories = new Set(categories.filter(c => c.name.toLowerCase().includes(q)).map(c => c.id));
  return stickers.filter(sticker =>
    sticker.name.toLowerCase().includes(q) ||
    sticker.tags.some(tag => tag.toLowerCase().includes(q)) ||
    (sticker.categoryId != null && matchingCategories.has(sticker.categoryId)),
  );
}

/** Search every level; callers display the full path to distinguish duplicate names. */
export function searchCategories(categories: Category[], query: string): Category[] {
  const q = query.trim().toLowerCase();
  return q ? categories.filter(c => c.name.toLowerCase().includes(q)) : categories;
}

export function getPickerRows(categories: Category[], expandedIds: Set<string>, query: string) {
  const q = query.trim().toLowerCase();
  const parents = new Set(categories.map(c => c.parentId));
  return flattenCategoryTree(categories)
    .filter(({ category }) => q
      ? category.name.toLowerCase().includes(q)
      : getCategoryPath(category.id, categories).slice(0, -1).every(c => expandedIds.has(c.id)))
    .map(row => ({ ...row, hasChildren: parents.has(row.category.id) }));
}
