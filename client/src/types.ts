export type ContentFormat = 'MP4' | 'ZIP' | 'PDF' | 'EPUB';

export type ProcessingStatus = 'queued' | 'validating' | 'transcoding' | 'manifest_generating' | 'ready' | 'failed';

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  format: ContentFormat;
  fileName: string;
  sizeBytes: number;
  status: ProcessingStatus;
  progress: number; // 0 to 100
  errorMessage?: string;
  checksum?: string;
  createdAt: string;
  targetTags: string[];
  manifest?: ContentManifest;
}

export interface ContentManifest {
  contentId: string;
  title: string;
  format: ContentFormat;
  fileChecksum: string;
  sizeBytes: number;
  processedAt: string;
  targetDeviceCriteria: {
    enrolledTags: string[];
    transcoded: boolean;
  };
}

export interface EdgeBox {
  id: string;
  name: string;
  deviceCertificateId: string;
  syncSchedule: string; // e.g. "02:00"
  lastSyncTime?: string;
  status: 'online' | 'offline';
  enrolledTags: string[];
}

export interface SyncLog {
  id: string;
  boxId: string;
  boxName: string;
  timestamp: string;
  type: 'delta' | 'full';
  status: 'success' | 'failed';
  filesSynced: number;
  dataTransferMb: number;
}

export interface CreatorStats {
  totalStorageUsedBytes: number;
  storageLimitBytes: number; // e.g. 5 GB
  totalUploads: number;
  successRate: number; // e.g. 98
  activeBoxesCount: number;
}
