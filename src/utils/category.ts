import type { Category } from '../models/types';

export interface FlattenedCategory {
  category: Category;
  depth: number;
}

/** Children of a folder. `null` means top-level. */
export function getChildren(categories: Category[], parentId: string | null): Category[] {
  return categories.filter((c) => (c.parentId ?? null) === parentId);
}

/** Returns the folder id plus all descendant folder ids. */
export function getDescendantIds(categoryId: string, categories: Category[]): string[] {
  const result: string[] = [];
  const stack = [categoryId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || result.includes(id)) continue;
    result.push(id);
    getChildren(categories, id).forEach((child) => stack.push(child.id));
  }
  return result;
}

/** Flattens a category tree depth-first with indentation depth. */
export function flattenCategoryTree(categories: Category[], parentId: string | null = null, depth = 0): FlattenedCategory[] {
  const result: FlattenedCategory[] = [];
  const children = getChildren(categories, parentId);
  children.forEach((category) => {
    result.push({ category, depth });
    result.push(...flattenCategoryTree(categories, category.id, depth + 1));
  });
  return result;
}

/** Returns the folder path from root to the given category, inclusive. */
export function getCategoryPath(categoryId: string | null, categories: Category[]): Category[] {
  if (!categoryId) return [];
  const result: Category[] = [];
  let current = categories.find((c) => c.id === categoryId);
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    result.unshift(current);
    current = current.parentId ? categories.find((c) => c.id === current?.parentId) : undefined;
  }
  return result;
}
