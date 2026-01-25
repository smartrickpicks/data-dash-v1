const DB_NAME = 'ContractCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'contractPdfs';
const MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024;

export interface CachedContract {
  key: string;
  blob: Blob;
  url: string;
  size: number;
  contentType: string;
  fetchedAt: string;
  lastAccessedAt: string;
}

export interface CacheStats {
  count: number;
  totalSize: number;
  maxSize: number;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function buildCacheKey(sheetName: string, rowIndex: number, url: string): string {
  return `${sheetName}_${rowIndex}_${hashString(url)}`;
}

class ContractCacheService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
          store.createIndex('fetchedAt', 'fetchedAt', { unique: false });
        }
      };
    });
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Contract cache database not initialized');
    }
    return this.db;
  }

  async getCachedContract(sheetName: string, rowIndex: number, url: string): Promise<CachedContract | null> {
    const db = await this.ensureDb();
    const key = buildCacheKey(sheetName, rowIndex, url);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as CachedContract | undefined;
        if (result) {
          result.lastAccessedAt = new Date().toISOString();
          store.put(result);
        }
        resolve(result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async cacheContract(
    sheetName: string,
    rowIndex: number,
    url: string,
    blob: Blob,
    contentType: string
  ): Promise<void> {
    const db = await this.ensureDb();
    const key = buildCacheKey(sheetName, rowIndex, url);
    const now = new Date().toISOString();

    const stats = await this.getCacheStats();
    if (stats.totalSize + blob.size > MAX_CACHE_SIZE_BYTES) {
      await this.evictLRU(blob.size);
    }

    const entry: CachedContract = {
      key,
      blob,
      url,
      size: blob.size,
      contentType,
      fetchedAt: now,
      lastAccessedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearContractCache(sheetName: string, rowIndex: number, url: string): Promise<void> {
    const db = await this.ensureDb();
    const key = buildCacheKey(sheetName, rowIndex, url);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllContractCaches(): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCacheStats(): Promise<CacheStats> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CachedContract[];
        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
        resolve({
          count: entries.length,
          totalSize,
          maxSize: MAX_CACHE_SIZE_BYTES,
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async evictLRU(neededSpace: number): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('lastAccessedAt');
      const request = index.openCursor();

      let freedSpace = 0;
      const keysToDelete: string[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && freedSpace < neededSpace) {
          const entry = cursor.value as CachedContract;
          keysToDelete.push(entry.key);
          freedSpace += entry.size;
          cursor.continue();
        } else {
          keysToDelete.forEach((key) => store.delete(key));
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCachedKeys(): Promise<string[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }
}

export const contractCache = new ContractCacheService();

export function formatCacheSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
