import { getVisibleChildren } from '../src/utils/category';
import { assignCategoryToImportResult } from '../src/services/importLogic';
import type { Category, Sticker } from '../src/models/types';

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (condition) console.log('  PASS  ' + label);
  else {
    failures += 1;
    console.error('  FAIL  ' + label);
  }
}

function sameValues(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

const children: Category[] = Array.from({ length: 6 }, (_, index) => ({
  id: `category-${index}`,
  name: `分类 ${index}`,
  icon: 'folder-outline',
  parentId: 'parent',
  createdAt: index,
  updatedAt: index,
  isSystem: false,
}));

assert(
  sameValues(getVisibleChildren(children, false).map((category) => category.id), [
    'category-0',
    'category-1',
    'category-2',
    'category-3',
  ]),
  '收起时只显示前四个子分类',
);
assert(
  sameValues(
    getVisibleChildren(children, true).map((category) => category.id),
    children.map((category) => category.id),
  ),
  '展开时显示全部子分类',
);

const sticker: Sticker = {
  id: 'sticker-1',
  name: '测试表情',
  localUri: 'file:///sticker.png',
  thumbnailUri: 'file:///sticker.png',
  fileType: 'png',
  fileSize: 1,
  createdAt: 1,
  updatedAt: 1,
  lastUsedAt: null,
  useCount: 0,
  isFavorite: false,
  categoryId: null,
  tags: [],
  md5: null,
};

const categorized = assignCategoryToImportResult(
  { imported: [sticker], duplicates: 0, failed: 0 },
  'category-current',
);
assert(categorized.imported[0].categoryId === 'category-current', '导入表情写入当前分类');
assert(sticker.categoryId === null, '分类赋值不修改原始导入对象');

if (failures > 0) {
  console.error(`${failures} category flow test(s) FAILED`);
  ((globalThis as unknown) as { process?: { exit(code: number): void } }).process?.exit(1);
} else {
  console.log('All category flow tests passed.');
}
