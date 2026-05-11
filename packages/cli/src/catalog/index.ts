import type { Codemod } from './types.js';
import { v6Codemods } from './v6/index.js';

// v7 codemods are imported and registered as they are built (Tasks 8–13).
const v7Codemods: Codemod[] = [];

export const catalog: Codemod[] = [...v6Codemods, ...v7Codemods];

export function getCatalog(packages = ['mongodb']): Codemod[] {
  return catalog.filter(c => c.packages.some(p => packages.includes(p)));
}

export function getById(id: string): Codemod | undefined {
  return catalog.find(c => c.id === id);
}
