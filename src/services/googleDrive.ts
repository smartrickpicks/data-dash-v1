import { DriveFile, DriveFolder, DriveProjectMeta } from '../types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

const SPREADSHEET_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.google-apps.spreadsheet',
];

const GOOGLE_SHEETS_MIME = 'application/vnd.google-apps.spreadsheet';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_MIME = 'text/csv';
const JSON_MIME = 'application/json';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function driveRequest(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(`${DRIVE_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `Drive API error: ${response.status}`);
  }

  return response;
}

export async function listSpreadsheetFiles(accessToken: string): Promise<DriveFile[]> {
  const mimeQuery = SPREADSHEET_MIME_TYPES.map((mime) => `mimeType='${mime}'`).join(' or ');
  const query = `(${mimeQuery}) and trashed=false`;

  const response = await driveRequest(
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size,iconLink,webViewLink)&orderBy=modifiedTime desc&pageSize=100`,
    accessToken
  );

  const data = await response.json();
  return data.files || [];
}

export async function searchFiles(accessToken: string, searchTerm: string): Promise<DriveFile[]> {
  const mimeQuery = SPREADSHEET_MIME_TYPES.map((mime) => `mimeType='${mime}'`).join(' or ');
  const nameQuery = `name contains '${searchTerm.replace(/'/g, "\\'")}'`;
  const query = `(${mimeQuery}) and ${nameQuery} and trashed=false`;

  const response = await driveRequest(
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size,iconLink,webViewLink)&orderBy=modifiedTime desc&pageSize=50`,
    accessToken
  );

  const data = await response.json();
  return data.files || [];
}

export async function downloadFile(accessToken: string, fileId: string, mimeType: string): Promise<Blob> {
  if (mimeType === GOOGLE_SHEETS_MIME) {
    const response = await driveRequest(
      `/files/${fileId}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`,
      accessToken
    );
    return response.blob();
  }

  const response = await driveRequest(`/files/${fileId}?alt=media`, accessToken);
  return response.blob();
}

export async function getFileMetadata(accessToken: string, fileId: string): Promise<DriveFile> {
  const response = await driveRequest(
    `/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,iconLink,webViewLink`,
    accessToken
  );
  return response.json();
}

export async function createFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<DriveFolder> {
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: FOLDER_MIME,
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || 'Failed to create folder');
  }

  const data = await response.json();

  const folderResponse = await driveRequest(
    `/files/${data.id}?fields=id,name,webViewLink`,
    accessToken
  );

  return folderResponse.json();
}

export async function findExistingProjectFolder(
  accessToken: string,
  projectFolderName: string
): Promise<DriveFolder | null> {
  const query = `name='${projectFolderName.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`;

  const response = await driveRequest(
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&pageSize=1`,
    accessToken
  );

  const data = await response.json();
  return data.files?.[0] || null;
}

export async function createProjectFolderStructure(
  accessToken: string,
  sourceFileName: string
): Promise<{
  projectFolder: DriveFolder;
  sourceFolder: DriveFolder;
  exportsFolder: DriveFolder;
  changeLogsFolder: DriveFolder;
}> {
  const projectFolderName = `DataDash - ${sourceFileName.replace(/\.[^/.]+$/, '')}`;

  const existingFolder = await findExistingProjectFolder(accessToken, projectFolderName);

  let projectFolder: DriveFolder;
  let sourceFolder: DriveFolder;
  let exportsFolder: DriveFolder;
  let changeLogsFolder: DriveFolder;

  if (existingFolder) {
    projectFolder = existingFolder;

    const subfolders = await listSubfolders(accessToken, projectFolder.id);

    sourceFolder = subfolders.find((f) => f.name === 'SOURCE') ||
      await createFolder(accessToken, 'SOURCE', projectFolder.id);
    exportsFolder = subfolders.find((f) => f.name === 'EXPORTS') ||
      await createFolder(accessToken, 'EXPORTS', projectFolder.id);
    changeLogsFolder = subfolders.find((f) => f.name === 'CHANGE LOGS') ||
      await createFolder(accessToken, 'CHANGE LOGS', projectFolder.id);
  } else {
    projectFolder = await createFolder(accessToken, projectFolderName);
    sourceFolder = await createFolder(accessToken, 'SOURCE', projectFolder.id);
    exportsFolder = await createFolder(accessToken, 'EXPORTS', projectFolder.id);
    changeLogsFolder = await createFolder(accessToken, 'CHANGE LOGS', projectFolder.id);
  }

  return {
    projectFolder,
    sourceFolder,
    exportsFolder,
    changeLogsFolder,
  };
}

async function listSubfolders(accessToken: string, parentId: string): Promise<DriveFolder[]> {
  const query = `'${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`;

  const response = await driveRequest(
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)`,
    accessToken
  );

  const data = await response.json();
  return data.files || [];
}

export async function copyFileToDrive(
  accessToken: string,
  sourceFileId: string,
  destinationFolderId: string,
  newName?: string
): Promise<DriveFile> {
  const metadata: { parents: string[]; name?: string } = {
    parents: [destinationFolderId],
  };

  if (newName) {
    metadata.name = newName;
  }

  const response = await fetch(`${DRIVE_API_BASE}/files/${sourceFileId}/copy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || 'Failed to copy file');
  }

  return response.json();
}

export async function uploadFileToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: Blob | ArrayBuffer | string,
  mimeType: string
): Promise<DriveFile> {
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );

  const contentBlob = content instanceof Blob
    ? content
    : typeof content === 'string'
      ? new Blob([content], { type: mimeType })
      : new Blob([content], { type: mimeType });

  form.append('file', contentBlob);

  const response = await fetch(
    `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || 'Failed to upload file');
  }

  return response.json();
}

export async function updateFileInDrive(
  accessToken: string,
  fileId: string,
  content: Blob | ArrayBuffer | string,
  mimeType: string
): Promise<DriveFile> {
  const contentBlob = content instanceof Blob
    ? content
    : typeof content === 'string'
      ? new Blob([content], { type: mimeType })
      : new Blob([content], { type: mimeType });

  const response = await fetch(
    `${UPLOAD_API_BASE}/files/${fileId}?uploadType=media&fields=id,name,mimeType,webViewLink`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType,
      },
      body: contentBlob,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || 'Failed to update file');
  }

  return response.json();
}

export async function findFileInFolder(
  accessToken: string,
  folderId: string,
  fileName: string
): Promise<DriveFile | null> {
  const query = `'${folderId}' in parents and name='${fileName.replace(/'/g, "\\'")}' and trashed=false`;

  const response = await driveRequest(
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink)&pageSize=1`,
    accessToken
  );

  const data = await response.json();
  return data.files?.[0] || null;
}

export async function uploadOrUpdateFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: Blob | ArrayBuffer | string,
  mimeType: string
): Promise<DriveFile> {
  const existingFile = await findFileInFolder(accessToken, folderId, fileName);

  if (existingFile) {
    return updateFileInDrive(accessToken, existingFile.id, content, mimeType);
  }

  return uploadFileToDrive(accessToken, folderId, fileName, content, mimeType);
}

export function buildDriveProjectMeta(
  email: string,
  sourceFile: DriveFile,
  folders: {
    projectFolder: DriveFolder;
    sourceFolder: DriveFolder;
    exportsFolder: DriveFolder;
    changeLogsFolder: DriveFolder;
  }
): DriveProjectMeta {
  return {
    connectedEmail: email,
    sourceFileId: sourceFile.id,
    sourceFileName: sourceFile.name,
    projectFolderId: folders.projectFolder.id,
    sourceFolderId: folders.sourceFolder.id,
    exportsFolderId: folders.exportsFolder.id,
    changeLogsFolderId: folders.changeLogsFolder.id,
    folderUrl: folders.projectFolder.webViewLink,
    sourceCopied: false,
  };
}

export { XLSX_MIME, CSV_MIME, JSON_MIME, GOOGLE_SHEETS_MIME };
