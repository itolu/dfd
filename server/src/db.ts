import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ContentItem, EdgeBox, SyncLog, CreatorStats, User, Session } from './types';

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

interface DatabaseSchema {
  users: User[];
  sessions: Session[];
  content: ContentItem[];
  boxes: EdgeBox[];
  syncLogs: SyncLog[];
}

const DEFAULT_SALT = 'ileemore_seed_salt_2026';

function hashPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

const DEFAULT_USERS: User[] = [
  {
    id: 'creator-001',
    name: 'Edtech Labs',
    email: 'creator@ileemore.org',
    passwordHash: hashPassword('password123', DEFAULT_SALT),
    salt: DEFAULT_SALT,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    apiKey: 'sk_live_eed6e8d538e1467ba60e3a4d',
    role: 'Owner',
    storageLimitBytes: 1073741824 // 1 GB default free capacity
  }
];

const DEFAULT_CONTENT: ContentItem[] = [
  {
    id: 'c-001',
    creatorId: 'creator-001',
    title: 'Introduction to Algebra',
    description: 'A helpful guide explaining how to solve math equations and algebra problems.',
    format: 'MP4',
    fileName: 'intro_algebra_1080p.mp4',
    sizeBytes: 184549376, // 176 MB
    status: 'ready',
    progress: 100,
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    targetTags: ['math', 'secondary-school', 'algebra'],
    manifest: {
      contentId: 'c-001',
      title: 'Introduction to Algebra',
      format: 'MP4',
      fileChecksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      sizeBytes: 184549376,
      processedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      targetDeviceCriteria: {
        enrolledTags: ['math', 'secondary-school'],
        transcoded: true
      }
    }
  },
  {
    id: 'c-002',
    creatorId: 'creator-001',
    title: 'Physics Science Lab',
    description: 'An interactive lab game to help students learn about physics waves offline.',
    format: 'ZIP',
    fileName: 'physics_waves_lab.zip',
    sizeBytes: 110100480, // 105 MB
    status: 'ready',
    progress: 100,
    checksum: '9d21bc3ff6cfa2b9ad78e1c6628e078e0c128ff0b1d568c0788ebc07e01d2d0c',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    targetTags: ['physics', 'science', 'interactive'],
    manifest: {
      contentId: 'c-002',
      title: 'Physics Science Lab',
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
    creatorId: 'creator-001',
    title: 'History of West Africa',
    description: 'A history book about the empires and kingdoms of West Africa.',
    format: 'PDF',
    fileName: 'wa_civilizations_vol1.pdf',
    sizeBytes: 47185920, // 45 MB
    status: 'ready',
    progress: 100,
    checksum: 'a81d89b01c3e1e2ff3a4d80a1c9e88bf0a012ff1875c71b12b5e0c52eb6f7df2',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    targetTags: ['history', 'social-studies', 'west-africa'],
    manifest: {
      contentId: 'c-003',
      title: 'History of West Africa',
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
    creatorId: 'creator-001',
    title: 'English Storybook',
    description: 'A collection of stories and reading exercises for primary school children.',
    format: 'EPUB',
    fileName: 'primary_english_reading.epub',
    sizeBytes: 6291456, // 6 MB
    status: 'ready',
    progress: 100,
    checksum: '1bc98fd02ad1cf239dfc82307bdc8dfd93f18e9c1c5e62bf078c12b7f0e91da2',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    targetTags: ['english', 'primary-school', 'reading'],
    manifest: {
      contentId: 'c-004',
      title: 'English Storybook',
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
    id: 'box-02',
    name: 'Progressive Intellectual College, Oke Igbo Ondo',
    deviceCertificateId: 'eb-cert-enugu-014-active',
    syncSchedule: '01:30',
    lastSyncTime: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
    status: 'online',
    enrolledTags: ['math', 'secondary-school', 'history', 'social-studies', 'west-africa', 'ondo-node']
  },
  {
    id: 'box-03',
    name: 'The Smart School, Ibadan',
    deviceCertificateId: 'eb-cert-ibadan-007-active',
    syncSchedule: '03:00',
    lastSyncTime: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
    status: 'online',
    enrolledTags: ['physics', 'science', 'interactive', 'history', 'social-studies', 'ibadan-node']
  }
];

const DEFAULT_SYNC_LOGS: SyncLog[] = [
  {
    id: 'log-002',
    creatorId: 'creator-001',
    boxId: 'box-03',
    boxName: 'The Smart School, Ibadan',
    timestamp: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
    type: 'delta',
    status: 'success',
    filesSynced: 1,
    dataTransferMb: 105.0
  },
  {
    id: 'log-003',
    creatorId: 'creator-001',
    boxId: 'box-02',
    boxName: 'Progressive Intellectual College, Oke Igbo Ondo',
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
        users: DEFAULT_USERS,
        sessions: [],
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

  // --- CRYPTO HELPERS ---
  public static hash(password: string, salt: string): string {
    return hashPassword(password, salt);
  }

  public static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // --- USER AUTH MANAGEMENT ---
  public static createUser(name: string, email: string, passwordPlain: string): User {
    const data = this.read();
    
    // Check duplication
    const exists = data.users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      throw new Error('A creator with this email address already exists.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const apiKey = `sk_live_${crypto.randomBytes(12).toString('hex')}`;
    const newUser: User = {
      id: `creator-${Date.now()}`,
      name,
      email: email.toLowerCase(),
      passwordHash: hashPassword(passwordPlain, salt),
      salt,
      createdAt: new Date().toISOString(),
      apiKey
    };

    data.users.push(newUser);
    this.write(data);
    return newUser;
  }

  public static findUserByEmail(email: string): User | null {
    const data = this.read();
    const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    return user || null;
  }

  public static findUserById(id: string): User | null {
    const data = this.read();
    const user = data.users.find(u => u.id === id);
    return user || null;
  }

  public static findUserByApiKey(apiKey: string): User | null {
    const data = this.read();
    const user = data.users.find(u => u.apiKey === apiKey);
    return user || null;
  }

  // --- SESSION MANAGEMENT ---
  public static createSession(userId: string): Session {
    const data = this.read();
    
    // Cleanup expired sessions while we are here
    const now = Date.now();
    data.sessions = data.sessions.filter(s => new Date(s.expiresAt).getTime() > now);

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 Days
    
    const newSession: Session = {
      token,
      userId,
      expiresAt
    };

    data.sessions.push(newSession);
    this.write(data);
    return newSession;
  }

  public static findSessionByToken(token: string): Session | null {
    const data = this.read();
    const session = data.sessions.find(s => s.token === token);
    if (!session) return null;

    // Check expiration
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      // Clean it up
      data.sessions = data.sessions.filter(s => s.token !== token);
      this.write(data);
      return null;
    }

    return session;
  }

  public static deleteSession(token: string): void {
    const data = this.read();
    data.sessions = data.sessions.filter(s => s.token !== token);
    this.write(data);
  }

  // --- COLLABORATIVE ORGANIZATION RESOLUTION ---
  private static getOrganizationUserIds(userId: string): string[] {
    const data = this.read();
    const user = data.users.find(u => u.id === userId);
    if (!user) return [userId];

    if (user.role === 'Creator' && user.parentId) {
      const parentId = user.parentId;
      const siblingIds = data.users.filter(u => u.parentId === parentId).map(u => u.id);
      return [parentId, ...siblingIds];
    } else {
      // Owner
      const childIds = data.users.filter(u => u.parentId === userId).map(u => u.id);
      return [userId, ...childIds];
    }
  }

  // --- TEAM MEMBER INVITATIONS ---
  public static inviteTeamMember(ownerId: string, name: string, email: string, passwordPlain: string): User {
    const data = this.read();
    const exists = data.users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      throw new Error('A user with this email address already exists.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const apiKey = `sk_live_${crypto.randomBytes(12).toString('hex')}`;
    const newCreator: User = {
      id: `creator-${Date.now()}`,
      name,
      email: email.toLowerCase(),
      passwordHash: hashPassword(passwordPlain, salt),
      salt,
      createdAt: new Date().toISOString(),
      apiKey,
      role: 'Creator',
      parentId: ownerId
    };

    data.users.push(newCreator);
    this.write(data);
    return newCreator;
  }

  public static getTeamMembers(ownerId: string): User[] {
    const data = this.read();
    return data.users.filter(u => u.parentId === ownerId);
  }

  public static buyStorage(ownerId: string, amountGb: number): User {
    const data = this.read();
    const index = data.users.findIndex(u => u.id === ownerId);
    if (index === -1) {
      throw new Error('Owner profile could not be located.');
    }
    
    const currentLimit = data.users[index].storageLimitBytes !== undefined 
      ? data.users[index].storageLimitBytes! 
      : 1073741824;
    
    const upgradeBytes = amountGb * 1073741824;
    data.users[index].storageLimitBytes = currentLimit + upgradeBytes;
    this.write(data);
    return data.users[index];
  }

  // --- CONTENT APPROVAL WORKFLOW ---
  public static approveContent(contentId: string): ContentItem | null {
    const data = this.read();
    const index = data.content.findIndex(c => c.id === contentId);
    if (index !== -1) {
      data.content[index].approvalStatus = 'approved';
      if (data.content[index].manifest) {
        data.content[index].manifest!.processedAt = new Date().toISOString();
      }
      this.write(data);
      return data.content[index];
    }
    return null;
  }

  public static rejectContent(contentId: string): boolean {
    const data = this.read();
    const originalLength = data.content.length;
    data.content = data.content.filter(c => c.id !== contentId);
    if (data.content.length !== originalLength) {
      this.write(data);
      return true;
    }
    return false;
  }

  // --- CONTENT & STATS MANAGEMENT ---
  public static getStats(creatorId: string): CreatorStats {
    const data = this.read();
    const orgUserIds = this.getOrganizationUserIds(creatorId);
    const creatorContent = data.content.filter(c => orgUserIds.includes(c.creatorId));
    
    const totalBytes = creatorContent
      .filter(c => c.status === 'ready' && c.approvalStatus !== 'pending')
      .reduce((sum, c) => sum + c.sizeBytes, 0);
    
    const successCount = creatorContent.filter(c => c.status === 'ready').length;
    const totalCount = creatorContent.length;
    
    // Resolve organization storage limit (free default: 1 GB = 1073741824 bytes)
    let limitBytes = 1073741824;
    const user = data.users.find(u => u.id === creatorId);
    if (user) {
      const ownerId = user.role === 'Creator' && user.parentId ? user.parentId : user.id;
      const owner = data.users.find(u => u.id === ownerId);
      if (owner && owner.storageLimitBytes !== undefined) {
        limitBytes = owner.storageLimitBytes;
      }
    }
    
    return {
      totalStorageUsedBytes: totalBytes,
      storageLimitBytes: limitBytes,
      totalUploads: totalCount,
      successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100,
      activeBoxesCount: data.boxes.filter(b => b.status === 'online').length
    };
  }

  public static getBoxes(): EdgeBox[] {
    const data = this.read();
    return data.boxes;
  }

  public static getSyncLogs(creatorId: string): SyncLog[] {
    const data = this.read();
    const orgUserIds = this.getOrganizationUserIds(creatorId);
    return data.syncLogs.filter(log => orgUserIds.includes(log.creatorId));
  }

  public static getContent(creatorId: string): ContentItem[] {
    const data = this.read();
    const orgUserIds = this.getOrganizationUserIds(creatorId);
    return data.content.filter(c => orgUserIds.includes(c.creatorId)).map(item => {
      if (!item.approvalStatus) item.approvalStatus = 'approved';
      if (!item.uploaderRole) item.uploaderRole = 'Owner';
      if (!item.uploaderName) item.uploaderName = 'Edtech Labs';
      return item;
    });
  }

  public static getContentItem(id: string): ContentItem | null {
    const data = this.read();
    return data.content.find(c => c.id === id) || null;
  }

  public static getAllContent(): ContentItem[] {
    const data = this.read();
    return data.content;
  }

  public static addContent(item: ContentItem): ContentItem {
    const data = this.read();
    data.content.unshift(item); // Add to the top of list
    this.write(data);
    return item;
  }

  public static updateContent(item: ContentItem): ContentItem {
    const data = this.read();
    const index = data.content.findIndex(c => c.id === item.id);
    if (index !== -1) {
      data.content[index] = item;
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
