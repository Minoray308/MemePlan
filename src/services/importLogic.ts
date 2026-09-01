import type { Sticker } from '../models/types';
import type { ImportResult } from './importService';

/** Applies an optional destination category before imported stickers enter the store. */
export function assignCategoryToImportResult(
  result: ImportResult,
  categoryId: string | null | undefined,
): ImportResult {
  if (categoryId === undefined || result.imported.length === 0) return result;
  return {
    ...result,
    imported: result.imported.map<Sticker>((sticker) => ({ ...sticker, categoryId })),
  };
}
