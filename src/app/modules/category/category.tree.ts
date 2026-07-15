export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
}

export interface CategoryTreeNode extends CategoryRow {
  children: CategoryTreeNode[];
}

export const buildCategoryTree = (rows: CategoryRow[]): CategoryTreeNode[] => {
  const nodesById = new Map<string, CategoryTreeNode>();
  for (const row of rows) {
    nodesById.set(row.id, { ...row, children: [] });
  }

  const roots: CategoryTreeNode[] = [];
  for (const node of nodesById.values()) {
    const parent = node.parentId ? nodesById.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
};

export const dfsFindNode = (
  roots: CategoryTreeNode[],
  targetId: string,
): CategoryTreeNode | null => {
  const stack: CategoryTreeNode[] = [...roots];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.id === targetId) {
      return node;
    }
    for (const child of node.children) {
      stack.push(child);
    }
  }

  return null;
};

export const dfsCollectSubtreeIds = (
  roots: CategoryTreeNode[],
  rootId: string,
): string[] => {
  const subtreeRoot = dfsFindNode(roots, rootId);
  if (!subtreeRoot) {
    return [];
  }

  const ids: string[] = [];
  const stack: CategoryTreeNode[] = [subtreeRoot];

  while (stack.length > 0) {
    const node = stack.pop()!;
    ids.push(node.id);
    for (const child of node.children) {
      stack.push(child);
    }
  }

  return ids;
};
