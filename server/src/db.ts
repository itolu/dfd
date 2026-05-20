import fs from 'fs';
import path from 'path';
import { ContentItem, EdgeBox, SyncLog, CreatorStats } from './types';

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

interface DatabaseSchema {
  stats: CreatorStats;
  content: ContentItem[];
  boxes: EdgeBox[];
  syncLogs: SyncLog[];
}

const DEFAULT_STATS: CreatorStats = {
  totalStorageUsedBytes: 348127390, // ~332 MB
  storageLimitBytes: 5368709120,    // 5 GB
  totalUploads: 4,
  successRate: 100,
  activeBoxesCount: 3,
};

const DEFAULT_CONTENT: ContentItem[] = [
  {
    id: 'c-001',
    title: 'Introductory Algebra: Equations & Inequalities',
    description: 'Core secondary school math module detailing linear and quadratic equation solving procedures.',
    format: 'MP4',
    fileName: 'intro_algebra_1080p.mp4',
    sizeBytes: 184549376, // 176 MB
    status: 'ready',
    progress: 100,
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    targetTags: ['math', 'secondary-school', 'algebra'],
    manifest: {
      contentId: 'c-001',
      title: 'Introductory Algebra: Equations & Inequalities',
      format: 'MP4',
      fileChecksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      sizeBytes: 184549376,
      processedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      targetDeviceCriteria: {
        enrolledTags: ['math', 'secondary-school'],
        transcoded: true // Flag indicating it was automatically scaled to 480p H.264
      }
    }
  },
  {
    id: 'c-002',
    title: 'Interactive Physics: Wave Mechanics Lab',
    description: 'HTML5 self-contained simulation enabling students to analyze refraction and frequency behaviors offline.',
    format: 'ZIP',
    fileName: 'physics_waves_lab.zip',
    sizeBytes: 110100480, // 105 MB
    status: 'ready',
    progress: 100,
    checksum: '9d21bc3ff6cfa2b9ad78e1c6628e078e0c128ff0b1d568c0788ebc07e01d2d0c',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    targetTags: ['physics', 'science', 'interactive'],
    manifest: {
      contentId: 'c-002',
      title: 'Interactive Physics: Wave Mechanics Lab',
      format: 'ZIP',
      fileChecksum: '9d21bc3ff6cfa2b9ad78e1c6628e078e0c128ff0b1d568c0788ebc07e01d2d0c',
      sizeBytes: 110100480,
      processedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      targetDeviceCriteria: {
        enrolledTags: ['physics', 'science'],
        transcoded: false
      }
    }
  },
  {
    id: 'c-003',
    title: 'West African Civilizations: A Historical Guide',
    description: 'High-density educational textbook covering historical trading empires (Mali, Songhai, Ghana).',
    format: 'PDF',
    fileName: 'wa_civilizations_vol1.pdf',
    sizeBytes: 47185920, // 45 MB
    status: 'ready',
    progress: 100,
    checksum: 'a81d89b01c3e1e2ff3a4d80a1c9e88bf0a012ff1875c71b12b5e0c52eb6f7df2',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    targetTags: ['history', 'social-studies', 'west-africa'],
    manifest: {
      contentId: 'c-003',
      title: 'West African Civilizations: A Historical Guide',
      format: 'PDF',
      fileChecksum: 'a81d89b01c3e1e2ff3a4d80a1c9e88bf0a012ff1875c71b12b5e0c52eb6f7df2',
      sizeBytes: 47185920,
      processedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      targetDeviceCriteria: {
        enrolledTags: ['history', 'social-studies'],
        transcoded: false
      }
    }
  },
  {
    id: 'c-004',
    title: 'Primary English Reading Anthology: Fables & Tales',
    description: 'EPUB compiled collection of standard reading comprehension exercises for early primary levels.',
    format: 'EPUB',
    fileName: 'primary_english_reading.epub',
    sizeBytes: 6291456, // 6 MB
    status: 'ready',
    progress: 100,
    checksum: '1bc98fd02ad1cf239dfc82307bdc8dfd93f18e9c1c5e62bf078c12b7f0e91da2',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    targetTags: ['english', 'primary-school', 'reading'],
    manifest: {
      contentId: 'c-004',
      title: 'Primary English Reading Anthology: Fables & Tales',
      format: 'EPUB',
      fileChecksum: '1bc98fd02ad1cf239dfc82307bdc8dfd93f18e9c1c5e62bf078c12b7f0e91da2',
      sizeBytes: 6291456,
      processedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      targetDeviceCriteria: {
        enrolledTags: ['english', 'primary-school'],
        transcoded: false
      }
    }
  }
];

const DEFAULT_BOXES: EdgeBox[] = [
  {
    id: 'box-01',
    name: 'Kano Central Edge Node',
    deviceCertificateId: 'eb-cert-kano-001-active',
    syncSchedule: '02:00',
    lastSyncTime: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), // 18 hrs ago (approx 02:00 local)
    status: 'online',
    enrolledTags: ['math', 'secondary-school', 'english', 'primary-school', 'algebra']
  },
  {
    id: 'box-02',
    name: 'Enugu Rural Secondary School Hub',
    deviceCertificateId: 'eb-cert-enugu-014-active',
    syncSchedule: '01:30',
    lastSyncTime: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
    status: 'offline',
    enrolledTags: ['math', 'secondary-school', 'history', 'social-studies', 'west-africa']
  },
  {
    id: 'box-03',
    name: 'Ibadan Smart Learning Center',
    deviceCertificateId: 'eb-cert-ibadan-007-active',
    syncSchedule: '03:00',
    lastSyncTime: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
    status: 'online',
    enrolledTags: ['physics', 'science', 'interactive', 'history', 'social-studies']
  }
];

const DEFAULT_SYNC_LOGS: SyncLog[] = [
  {
    id: 'log-001',
    boxId: 'box-01',
    boxName: 'Kano Central Edge Node',
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    type: 'delta',
    status: 'success',
    filesSynced: 2,
    dataTransferMb: 182.0
  },
  {
    id: 'log-002',
    boxId: 'box-03',
    boxName: 'Ibadan Smart Learning Center',
    timestamp: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
    type: 'delta',
    status: 'success',
    filesSynced: 1,
    dataTransferMb: 105.0
  },
  {
    id: 'log-003',
    boxId: 'box-02',
    boxName: 'Enugu Rural Secondary School Hub',
    timestamp: new Date(Date.now() - 43 * 60 * 60 * 1000).toISOString(),
    type: 'full',
    status: 'success',
    filesSynced: 3,
    dataTransferMb: 326.5
  }
];

export class DB {
  private static ensureDbExists() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initialSchema: DatabaseSchema = {
        stats: DEFAULT_STATS,
        content: DEFAULT_CONTENT,
        boxes: DEFAULT_BOXES,
        syncLogs: DEFAULT_SYNC_LOGS
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialSchema, null, 2), 'utf-8');
    }
  }

  private static read(): DatabaseSchema {
    this.ensureDbExists();
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  }

  private static write(data: DatabaseSchema) {
    this.ensureDbExists();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  public static getStats(): CreatorStats {
    const data = this.read();
    return data.stats;
  }

  public static getBoxes(): EdgeBox[] {
    const data = this.read();
    return data.boxes;
  }

  public static getSyncLogs(): SyncLog[] {
    const data = this.read();
    return data.syncLogs;
  }

  public static getContent(): ContentItem[] {
    const data = this.read();
    return data.content;
  }

  public static addContent(item: ContentItem): ContentItem {
    const data = this.read();
    data.content.unshift(item); // Add to the top of list
    
    // Recalculate stats based on content change
    const totalBytes = data.content
      .filter(c => c.status === 'ready')
      .reduce((sum, c) => sum + c.sizeBytes, 0);
    
    const successCount = data.content.filter(c => c.status === 'ready').length;
    const totalCount = data.content.length;
    
    data.stats.totalStorageUsedBytes = totalBytes;
    data.stats.totalUploads = totalCount;
    data.stats.successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
    
    this.write(data);
    return item;
  }

  public static updateContent(item: ContentItem): ContentItem {
    const data = this.read();
    const index = data.content.findIndex(c => c.id === item.id);
    if (index !== -1) {
      data.content[index] = item;
      
      // Re-evaluate stats
      const totalBytes = data.content
        .filter(c => c.status === 'ready')
        .reduce((sum, c) => sum + c.sizeBytes, 0);
      
      const successCount = data.content.filter(c => c.status === 'ready').length;
      const totalCount = data.content.length;
      
      data.stats.totalStorageUsedBytes = totalBytes;
      data.stats.successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
      
      this.write(data);
    }
    return item;
  }

  public static addSyncLog(log: SyncLog) {
    const data = this.read();
    data.syncLogs.unshift(log);
    
    // Update matching box sync timestamp
    const box = data.boxes.find(b => b.id === log.boxId);
    if (box) {
      box.lastSyncTime = log.timestamp;
    }
    
    this.write(data);
  }
}
