export type PrivateStorage = {
  put(pathname: string, body: Uint8Array): Promise<void>;
  get(pathname: string): Promise<Uint8Array | null>;
  del(pathname: string): Promise<void>;
};

export function createMemoryStorage(): PrivateStorage & { objects: Map<string, Uint8Array>; deleted: string[] } {
  const objects = new Map<string, Uint8Array>();
  const deleted: string[] = [];
  return {
    objects,
    deleted,
    async put(pathname, body) {
      objects.set(pathname, body);
    },
    async get(pathname) {
      return objects.get(pathname) ?? null;
    },
    async del(pathname) {
      objects.delete(pathname);
      deleted.push(pathname);
    },
  };
}

export async function deletePrivateObjects(storage: PrivateStorage, paths: Array<string | null | undefined>): Promise<void> {
  for (const pathname of paths) {
    if (!pathname) continue;
    await storage.del(pathname);
  }
}
