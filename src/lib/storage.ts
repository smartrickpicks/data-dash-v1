import { Dataset, RowStatus, FieldStatus, RfiComments, MultiSheetGlossaryConfig, MultiSheetGlossary, ModificationHistory, AnalystRemarks, AnomalyMap, BlacklistEntry, DriveProjectMeta, ContractFailureOverrides, RowReviewStatusMap, FlagMap } from '../types';

const DB_NAME = 'ContractReviewerDB';
const DB_VERSION = 4;

export interface StoredProject {
  id: string;
  fileName: string;
  originalDataset: Dataset;
  currentDataset: Dataset;
  rowStatuses: RowStatus;
  fieldStatuses: FieldStatus;
  rfiComments: RfiComments;
  glossaryConfig: MultiSheetGlossaryConfig | null;
  glossaryEntries: MultiSheetGlossary;
  modificationHistory: ModificationHistory;
  analystRemarks: AnalystRemarks;
  anomalyMap: AnomalyMap;
  contractFailureOverrides: ContractFailureOverrides;
  rowReviewStatuses: RowReviewStatusMap;
  flagMap: FlagMap;
  activeSheetName: string;
  currentRowIndex: number;
  viewMode: 'single' | 'grid';
  driveMeta: DriveProjectMeta | null;
  createdAt: string;
  updatedAt: string;
}

class StorageService {
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

        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('fileName', 'fileName', { unique: false });
          projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('blacklist')) {
          const blacklistStore = db.createObjectStore('blacklist', { keyPath: 'id' });
          blacklistStore.createIndex('value', 'value', { unique: false });
          blacklistStore.createIndex('enabled', 'enabled', { unique: false });
        }
      };
    });
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async saveProject(project: StoredProject): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.put({ ...project, updatedAt: new Date().toISOString() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getProject(id: string): Promise<StoredProject | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllProjects(): Promise<StoredProject[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCurrentProject(): Promise<StoredProject | null> {
    const projects = await this.getAllProjects();
    if (projects.length === 0) return null;

    projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return projects[0];
  }

  async createProject(
    dataset: Dataset,
    modificationHistory: ModificationHistory = {},
    anomalyMap: AnomalyMap = {},
    driveMeta: DriveProjectMeta | null = null
  ): Promise<StoredProject> {
    const project: StoredProject = {
      id: crypto.randomUUID(),
      fileName: dataset.fileName,
      originalDataset: JSON.parse(JSON.stringify(dataset)),
      currentDataset: dataset,
      rowStatuses: {},
      fieldStatuses: {},
      rfiComments: {},
      glossaryConfig: null,
      glossaryEntries: {},
      modificationHistory,
      analystRemarks: {},
      anomalyMap,
      contractFailureOverrides: {},
      rowReviewStatuses: {},
      flagMap: {},
      activeSheetName: dataset.sheets[0]?.name || '',
      currentRowIndex: 0,
      viewMode: 'single',
      driveMeta,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveProject(project);
    return project;
  }

  async updateProject(
    id: string,
    updates: Partial<Omit<StoredProject, 'id' | 'createdAt'>>
  ): Promise<void> {
    const project = await this.getProject(id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }

    const updatedProject = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveProject(updatedProject);
  }

  async getAllBlacklistEntries(): Promise<BlacklistEntry[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['blacklist'], 'readonly');
      const store = transaction.objectStore('blacklist');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveBlacklistEntry(entry: BlacklistEntry): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['blacklist'], 'readwrite');
      const store = transaction.objectStore('blacklist');
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteBlacklistEntry(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['blacklist'], 'readwrite');
      const store = transaction.objectStore('blacklist');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async createBlacklistEntry(
    value: string,
    type: BlacklistEntry['type'] = 'custom',
    matchMode: BlacklistEntry['matchMode'] = 'contains',
    scope: BlacklistEntry['scope'] = 'global',
    fields: string[] = []
  ): Promise<BlacklistEntry> {
    const entry: BlacklistEntry = {
      id: crypto.randomUUID(),
      value,
      type,
      matchMode,
      scope,
      fields,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveBlacklistEntry(entry);
    return entry;
  }

  async updateBlacklistEntry(
    id: string,
    updates: Partial<Omit<BlacklistEntry, 'id' | 'createdAt'>>
  ): Promise<void> {
    const entries = await this.getAllBlacklistEntries();
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      throw new Error(`Blacklist entry with id ${id} not found`);
    }

    const updatedEntry: BlacklistEntry = {
      ...entry,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveBlacklistEntry(updatedEntry);
  }

  async toggleBlacklistEntry(id: string): Promise<void> {
    const entries = await this.getAllBlacklistEntries();
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      throw new Error(`Blacklist entry with id ${id} not found`);
    }

    await this.updateBlacklistEntry(id, { enabled: !entry.enabled });
  }
}

export const storage = new StorageService();
