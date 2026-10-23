export type StoredLandingPageObject = {
  bytes: Uint8Array;
  url: string;
};

export interface LandingPageMediaStorage {
  put(pathname: string, body: Uint8Array, contentType: string): Promise<{ url: string; storageKey?: string }>;
  get(pathname: string): Promise<StoredLandingPageObject | null>;
  delete(pathname: string): Promise<void>;
}

export function createFakeLandingPageMediaStorage(): LandingPageMediaStorage & {
  objects: Map<string, { body: Uint8Array; contentType: string }>;
  failNextPut(): void;
  failNextDelete(): void;
} {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();
  let failPut = false;
  let failDelete = false;
  return {
    objects,
    failNextPut() {
      failPut = true;
    },
    failNextDelete() {
      failDelete = true;
    },
    async put(pathname, body, contentType) {
      if (failPut) {
        failPut = false;
        throw new Error("landing media put failed");
      }
      objects.set(pathname, { body, contentType });
      return { url: `https://media.example.test/${pathname}` };
    },
    async get(pathname) {
      const object = objects.get(pathname);
      if (!object) return null;
      return { bytes: object.body, url: `https://media.example.test/${pathname}` };
    },
    async delete(pathname) {
      if (failDelete) {
        failDelete = false;
        throw new Error("landing media delete failed");
      }
      objects.delete(pathname);
    },
  };
}
