import serverless from 'serverless-http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';

// ============================================================
// 📦 TYPES (inlined from server/src/types.ts)
// ============================================================

type ContentFormat = 'MP4' | 'ZIP' | 'PDF' | 'EPUB';

type ProcessingStatus = 'queued' | 'validating' | 'transcoding' | 'manifest_generating' | 'ready' | 'failed';

interface ContentManifest {
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

interface ContentItem {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  format: ContentFormat;
  fileName: string;
  sizeBytes: number;
  status: ProcessingStatus;
  progress: number;
  errorMessage?: string;
  checksum?: string;
  createdAt: string;
  targetTags: string[];
  manifest?: ContentManifest;
  approvalStatus?: 'pending' | 'approved';
  uploaderName?: string;
  uploaderRole?: 'Owner' | 'Creator';
}

interface EdgeBox {
  id: string;
  name: string;
  deviceCertificateId: string;
  syncSchedule: string;
  lastSyncTime?: string;
  status: 'online' | 'offline';
  enrolledTags: string[];
}

interface SyncLog {
  id: string;
  creatorId: string;
  boxId: string;
  boxName: string;
  timestamp: string;
  type: 'delta' | 'full';
  status: 'success' | 'failed';
  filesSynced: number;
  dataTransferMb: number;
}

interface CreatorStats {
  totalStorageUsedBytes: number;
  storageLimitBytes: number;
  totalUploads: number;
  successRate: number;
  activeBoxesCount: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  apiKey: string;
  role?: 'Owner' | 'Creator';
  parentId?: string;
  storageLimitBytes?: number;
}

interface Session {
  token: string;
  userId: string;
  expiresAt: string;
}

interface AuthenticatedRequest extends Request {
  user?: User;
  token?: string;
}

interface DatabaseSchema {
  users: User[];
  sessions: Session[];
  content: ContentItem[];
  boxes: EdgeBox[];
  syncLogs: SyncLog[];
}

// ============================================================
// 🔐 CRYPTO HELPERS
// ============================================================

const DEFAULT_SALT = 'ileemore_seed_salt_2026';

function hashPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

// ============================================================
// 💾 IN-MEMORY DATABASE (replaces filesystem-based db.ts)
// ============================================================

const DEFAULT_USERS: User[] = [
  {
    id: 'creator-001',
    name: 'Edtech Labs',
    email: 'creator@ileemore.org',
    passwordHash: hashPassword('password123', DEFAULT_SALT),
    salt: DEFAULT_SALT,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    apiKey: 'sk_live_eed6e8d538e1467ba60e3a4d',
    role: 'Owner',
    storageLimitBytes: 1073741824 // 1 GB
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
    sizeBytes: 184549376,
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
    sizeBytes: 110100480,
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
    sizeBytes: 47185920,
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
    sizeBytes: 6291456,
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

// Module-level in-memory store (persists across warm invocations, resets on cold start)
const db: DatabaseSchema = {
  users: structuredClone(DEFAULT_USERS),
  sessions: [],
  content: structuredClone(DEFAULT_CONTENT),
  boxes: structuredClone(DEFAULT_BOXES),
  syncLogs: structuredClone(DEFAULT_SYNC_LOGS)
};

class DB {
  // --- CRYPTO HELPERS ---
  public static hash(password: string, salt: string): string {
    return hashPassword(password, salt);
  }

  public static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // --- USER AUTH MANAGEMENT ---
  public static createUser(name: string, email: string, passwordPlain: string): User {
    const exists = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
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

    db.users.push(newUser);
    return newUser;
  }

  public static findUserByEmail(email: string): User | null {
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public static findUserById(id: string): User | null {
    return db.users.find(u => u.id === id) || null;
  }

  public static findUserByApiKey(apiKey: string): User | null {
    return db.users.find(u => u.apiKey === apiKey) || null;
  }

  // --- SESSION MANAGEMENT ---
  public static createSession(userId: string): Session {
    const now = Date.now();
    db.sessions = db.sessions.filter(s => new Date(s.expiresAt).getTime() > now);

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const newSession: Session = { token, userId, expiresAt };
    db.sessions.push(newSession);
    return newSession;
  }

  public static findSessionByToken(token: string): Session | null {
    const session = db.sessions.find(s => s.token === token);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      db.sessions = db.sessions.filter(s => s.token !== token);
      return null;
    }

    return session;
  }

  public static deleteSession(token: string): void {
    db.sessions = db.sessions.filter(s => s.token !== token);
  }

  // --- COLLABORATIVE ORGANIZATION RESOLUTION ---
  private static getOrganizationUserIds(userId: string): string[] {
    const user = db.users.find(u => u.id === userId);
    if (!user) return [userId];

    if (user.role === 'Creator' && user.parentId) {
      const parentId = user.parentId;
      const siblingIds = db.users.filter(u => u.parentId === parentId).map(u => u.id);
      return [parentId, ...siblingIds];
    } else {
      const childIds = db.users.filter(u => u.parentId === userId).map(u => u.id);
      return [userId, ...childIds];
    }
  }

  // --- TEAM MEMBER INVITATIONS ---
  public static inviteTeamMember(ownerId: string, name: string, email: string, passwordPlain: string): User {
    const exists = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
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

    db.users.push(newCreator);
    return newCreator;
  }

  public static getTeamMembers(ownerId: string): User[] {
    return db.users.filter(u => u.parentId === ownerId);
  }

  public static buyStorage(ownerId: string, amountGb: number): User {
    const index = db.users.findIndex(u => u.id === ownerId);
    if (index === -1) {
      throw new Error('Owner profile could not be located.');
    }

    const currentLimit = db.users[index].storageLimitBytes !== undefined
      ? db.users[index].storageLimitBytes!
      : 1073741824;

    const upgradeBytes = amountGb * 1073741824;
    db.users[index].storageLimitBytes = currentLimit + upgradeBytes;
    return db.users[index];
  }

  // --- CONTENT APPROVAL WORKFLOW ---
  public static approveContent(contentId: string): ContentItem | null {
    const index = db.content.findIndex(c => c.id === contentId);
    if (index !== -1) {
      db.content[index].approvalStatus = 'approved';
      if (db.content[index].manifest) {
        db.content[index].manifest!.processedAt = new Date().toISOString();
      }
      return db.content[index];
    }
    return null;
  }

  public static rejectContent(contentId: string): boolean {
    const originalLength = db.content.length;
    db.content = db.content.filter(c => c.id !== contentId);
    return db.content.length !== originalLength;
  }

  // --- CONTENT & STATS MANAGEMENT ---
  public static getStats(creatorId: string): CreatorStats {
    const orgUserIds = this.getOrganizationUserIds(creatorId);
    const creatorContent = db.content.filter(c => orgUserIds.includes(c.creatorId));

    const totalBytes = creatorContent
      .filter(c => c.status === 'ready' && c.approvalStatus !== 'pending')
      .reduce((sum, c) => sum + c.sizeBytes, 0);

    const successCount = creatorContent.filter(c => c.status === 'ready').length;
    const totalCount = creatorContent.length;

    let limitBytes = 1073741824;
    const user = db.users.find(u => u.id === creatorId);
    if (user) {
      const ownerId = user.role === 'Creator' && user.parentId ? user.parentId : user.id;
      const owner = db.users.find(u => u.id === ownerId);
      if (owner && owner.storageLimitBytes !== undefined) {
        limitBytes = owner.storageLimitBytes;
      }
    }

    return {
      totalStorageUsedBytes: totalBytes,
      storageLimitBytes: limitBytes,
      totalUploads: totalCount,
      successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100,
      activeBoxesCount: db.boxes.filter(b => b.status === 'online').length
    };
  }

  public static getBoxes(): EdgeBox[] {
    return db.boxes;
  }

  public static getSyncLogs(creatorId: string): SyncLog[] {
    const orgUserIds = this.getOrganizationUserIds(creatorId);
    return db.syncLogs.filter(log => orgUserIds.includes(log.creatorId));
  }

  public static getContent(creatorId: string): ContentItem[] {
    const orgUserIds = this.getOrganizationUserIds(creatorId);
    return db.content.filter(c => orgUserIds.includes(c.creatorId)).map(item => {
      if (!item.approvalStatus) item.approvalStatus = 'approved';
      if (!item.uploaderRole) item.uploaderRole = 'Owner';
      if (!item.uploaderName) item.uploaderName = 'Edtech Labs';
      return item;
    });
  }

  public static getContentItem(id: string): ContentItem | null {
    return db.content.find(c => c.id === id) || null;
  }

  public static getAllContent(): ContentItem[] {
    return db.content;
  }

  public static addContent(item: ContentItem): ContentItem {
    db.content.unshift(item);
    return item;
  }

  public static updateContent(item: ContentItem): ContentItem {
    const index = db.content.findIndex(c => c.id === item.id);
    if (index !== -1) {
      db.content[index] = item;
    }
    return item;
  }

  public static addSyncLog(log: SyncLog) {
    db.syncLogs.unshift(log);

    const box = db.boxes.find(b => b.id === log.boxId);
    if (box) {
      box.lastSyncTime = log.timestamp;
    }
  }
}

// ============================================================
// 🔄 PIPELINE (adapted from server/src/pipeline.ts)
// ============================================================

const SIZE_LIMITS_BYTES: Record<ContentFormat, number> = {
  MP4: 500 * 1024 * 1024,
  ZIP: 200 * 1024 * 1024,
  PDF: 100 * 1024 * 1024,
  EPUB: 50 * 1024 * 1024,
};

class Pipeline {
  private static sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static generateChecksum(title: string, size: number): string {
    const chars = '0123456789abcdef';
    let hash = '';
    const seed = `${title}-${size}-${Date.now()}`;
    for (let i = 0; i < 64; i++) {
      const index = (seed.charCodeAt(i % seed.length) + i) % chars.length;
      hash += chars[index];
    }
    return hash;
  }

  public static async processAsset(itemId: string) {
    const item = DB.getContentItem(itemId);
    if (!item) return;

    try {
      console.log(`🚀 [Pipeline]: Queued asset processing for: ${item.title}`);

      // Stage 1: Queued -> Validating
      item.status = 'validating';
      item.progress = 10;
      DB.updateContent(item);
      await this.sleep(1500);

      // Rule Validation (Size Checks)
      const limit = SIZE_LIMITS_BYTES[item.format];
      if (item.sizeBytes > limit) {
        throw new Error(
          `This file is too large. Max size is ${limit / (1024 * 1024)}MB.`
        );
      }

      // ZIP Boundary Verification
      if (item.format === 'ZIP') {
        const hasIndexHtml = !item.fileName.toLowerCase().includes('no_index') &&
                            (item.fileName.toLowerCase().includes('index.html') ||
                             item.fileName.toLowerCase().endsWith('.zip') ||
                             item.title.toLowerCase().includes('lab') ||
                             item.title.toLowerCase().includes('interactive'));
        if (!hasIndexHtml) {
          throw new Error('ZIP files must contain an "index.html" start page.');
        }
      }

      // Stage 2: Transcoding (Only for MP4)
      if (item.format === 'MP4') {
        console.log(`🎥 [Pipeline]: Commencing MP4 H.264 transcoding for: ${item.title}`);
        item.status = 'transcoding';

        for (let p = 20; p <= 80; p += 20) {
          item.progress = p;
          DB.updateContent(item);
          await this.sleep(1000);
        }
      } else {
        item.progress = 50;
        DB.updateContent(item);
        await this.sleep(1000);
      }

      // Stage 3: Manifest Generation & Cryptographic Checksumming
      console.log(`📄 [Pipeline]: Building distribution manifest for: ${item.title}`);
      item.status = 'manifest_generating';
      item.progress = 90;
      DB.updateContent(item);
      await this.sleep(1200);

      const shaChecksum = this.generateChecksum(item.title, item.sizeBytes);
      item.checksum = shaChecksum;

      const manifest: ContentManifest = {
        contentId: item.id,
        title: item.title,
        format: item.format,
        fileChecksum: shaChecksum,
        sizeBytes: item.sizeBytes,
        processedAt: new Date().toISOString(),
        targetDeviceCriteria: {
          enrolledTags: item.targetTags,
          transcoded: item.format === 'MP4',
        }
      };

      // Stage 4: Process Complete & Staged for Sync
      item.status = 'ready';
      item.progress = 100;
      item.manifest = manifest;

      DB.updateContent(item);
      console.log(`🟢 [Pipeline]: Asset processing completed successfully: ${item.title}`);

    } catch (error: any) {
      console.error(`🔴 [Pipeline]: Asset processing failed for ${item.title}: ${error.message}`);
      item.status = 'failed';
      item.progress = 100;
      item.errorMessage = error.message || 'An error occurred while uploading the file.';
      DB.updateContent(item);
    }
  }
}

// ============================================================
// 🌐 EXPRESS APP
// ============================================================

const app = express();

app.use(cors());
app.use(express.json());

// 🛡️ Authentication Gateway Middleware
const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Authorization token is missing.' });
    }

    const token = authHeader.split(' ')[1];
    let user: User | null = null;

    if (token.startsWith('sk_live_')) {
      user = DB.findUserByApiKey(token);
      if (!user) {
        return res.status(401).json({ error: 'The provided API Secret Key is invalid or deactivated.' });
      }
    } else {
      const session = DB.findSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: 'Session has expired or is invalid. Please log in again.' });
      }
      user = DB.findUserById(session.userId);
      if (!user) {
        return res.status(401).json({ error: 'Authenticated creator profile could not be located.' });
      }
    }

    (req as AuthenticatedRequest).user = user;
    (req as AuthenticatedRequest).token = token;
    next();
  } catch (err: any) {
    console.error('Authentication gateway failure:', err);
    res.status(500).json({ error: 'Internal gateway security check failed.' });
  }
};

// 1. Health check (Public Endpoint)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==========================================
// 📂 AUTHENTICATION CONTROLLERS (Public)
// ==========================================

// 2. Creator Registration
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All registration parameters (name, email, password) are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters in length.' });
    }

    const user = DB.createUser(name, email, password);
    const session = DB.createSession(user.id);

    const { passwordHash, salt, ...userProfile } = user;

    res.status(201).json({
      message: 'Creator profile provisioned successfully.',
      token: session.token,
      user: userProfile
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

// 3. Creator Sign In
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password credentials are required.' });
    }

    const user = DB.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password credentials.' });
    }

    const inputHash = DB.hash(password, user.salt);
    if (inputHash !== user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password credentials.' });
    }

    const session = DB.createSession(user.id);
    const { passwordHash, salt, ...userProfile } = user;

    res.json({
      message: 'Sign in successful.',
      token: session.token,
      user: userProfile
    });
  } catch (err: any) {
    console.error('Sign in operation failed error:', err);
    res.status(500).json({ error: 'Sign in operation failed.' });
  }
});

// 4. Creator Sign Out (Invalidate session)
app.post('/api/auth/logout', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      DB.deleteSession(token);
    }
    res.json({ message: 'Sign out successful. Token invalidated.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Sign out operation failed.' });
  }
});

// 5. Creator Profile Check
app.get('/api/auth/me', authenticateUser, (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const { passwordHash, salt, ...userProfile } = user;
  res.json(userProfile);
});

// ==========================================
// 📂 PORTAL CONTROLLERS (Secure / Gated)
// ==========================================

// 6. Creator Stats
app.get('/api/creator/stats', authenticateUser, (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const stats = DB.getStats(user.id);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve creator workspace metrics.' });
  }
});

// 7. Get all uploaded content items
app.get('/api/content', authenticateUser, (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const content = DB.getContent(user.id);
    res.json(content);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve content list.' });
  }
});

// 8. Ingest new asset upload
app.post('/api/content/upload', authenticateUser, (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { title, description, format, fileName, sizeBytes, targetTags } = req.body;

    if (!title || !format || !fileName || sizeBytes === undefined) {
      return res.status(400).json({ error: 'Missing required upload parameters.' });
    }

    const validFormats: ContentFormat[] = ['MP4', 'ZIP', 'PDF', 'EPUB'];
    if (!validFormats.includes(format as ContentFormat)) {
      return res.status(400).json({ error: 'Invalid content format.' });
    }

    const stats = DB.getStats(user.id);
    const incomingSizeBytes = Number(sizeBytes);
    if (stats.totalStorageUsedBytes + incomingSizeBytes > stats.storageLimitBytes) {
      const limitGb = stats.storageLimitBytes / 1073741824;
      return res.status(400).json({
        error: `Your organization has reached its storage capacity limit (${limitGb} GB). Please purchase additional storage to continue sending files.`
      });
    }

    const uploaderRole = user.role || 'Owner';
    const approvalStatus = uploaderRole === 'Owner' ? 'approved' : 'pending';

    const newItem: ContentItem = {
      id: `c-${Date.now()}`,
      creatorId: user.id,
      title,
      description: description || '',
      format: format as ContentFormat,
      fileName,
      sizeBytes: Number(sizeBytes),
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
      targetTags: Array.isArray(targetTags) ? targetTags : [],
      approvalStatus,
      uploaderName: user.name,
      uploaderRole
    };

    DB.addContent(newItem);

    // Asynchronously dispatch pipeline execution
    Pipeline.processAsset(newItem.id);

    res.status(201).json(newItem);
  } catch (err: any) {
    res.status(500).json({ error: 'Ingestion upload failed.' });
  }
});

// 8b. Content Approval Workflows (Owner only)
app.post('/api/content/:id/approve', authenticateUser, (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const isOwner = user.role === 'Owner' || !user.role;
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden. Only organization owners can approve content.' });
    }

    const contentId = req.params.id;
    const approvedItem = DB.approveContent(contentId);
    if (!approvedItem) {
      return res.status(404).json({ error: 'Content item not found.' });
    }

    res.json({
      message: 'Content approved and published successfully.',
      content: approvedItem
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Approval failed.' });
  }
});

app.post('/api/content/:id/reject', authenticateUser, (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const isOwner = user.role === 'Owner' || !user.role;
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden. Only organization owners can reject content.' });
    }

    const contentId = req.params.id;
    const success = DB.rejectContent(contentId);
    if (!success) {
      return res.status(404).json({ error: 'Content item not found.' });
    }

    res.json({
      message: 'Content item rejected and removed successfully.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Rejection failed.' });
  }
});

// 8c. Team Management (Owner only)
app.post('/api/team/invite', authenticateUser, (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const isOwner = user.role === 'Owner' || !user.role;
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden. Only organization owners can invite team members.' });
    }

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required parameters: name, email, password.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const newMember = DB.inviteTeamMember(user.id, name, email, password);
    const { passwordHash, salt, ...memberProfile } = newMember;

    res.status(201).json({
      message: 'Team member successfully invited and registered.',
      user: memberProfile
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Invitation failed.' });
  }
});

app.get('/api/team', authenticateUser, (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const isOwner = user.role === 'Owner' || !user.role;
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden. Only organization owners can view the team list.' });
    }

    const members = DB.getTeamMembers(user.id);
    const profiles = members.map(({ passwordHash, salt, ...profile }) => profile);
    res.json(profiles);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve team members.' });
  }
});

// 8d. Storage Purchase Endpoint (Owner only)
app.post('/api/creator/buy-storage', authenticateUser, (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const isOwner = user.role === 'Owner' || !user.role;
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden. Only organization owners can purchase additional storage.' });
    }

    const { amountGb } = req.body;
    if (amountGb === undefined || isNaN(Number(amountGb)) || Number(amountGb) <= 0) {
      return res.status(400).json({ error: 'Amount of GB to purchase must be a positive number.' });
    }

    const updatedUser = DB.buyStorage(user.id, Number(amountGb));
    const stats = DB.getStats(user.id);

    res.json({
      message: `Successfully purchased ${amountGb} GB of additional storage!`,
      storageLimitBytes: updatedUser.storageLimitBytes,
      stats
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Storage purchase failed.' });
  }
});

// 9. Edge Box registry (Global hardware directory)
app.get('/api/boxes', authenticateUser, (_req: Request, res: Response) => {
  try {
    const boxes = DB.getBoxes();
    res.json(boxes);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve edge boxes.' });
  }
});

// 10. Edge Box Sync Logs
app.get('/api/sync-logs', authenticateUser, (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const logs = DB.getSyncLogs(user.id);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve sync logs.' });
  }
});

// 11. Trigger a simulated Edge Box sync schedule event
app.post('/api/boxes/sync', authenticateUser, (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { boxId, syncType } = req.body;

    if (!boxId) {
      return res.status(400).json({ error: 'Missing boxId.' });
    }

    const boxes = DB.getBoxes();
    const box = boxes.find(b => b.id === boxId);
    if (!box) {
      return res.status(404).json({ error: 'Edge Box not found.' });
    }

    const content = DB.getContent(user.id).filter(c => c.status === 'ready' && c.approvalStatus === 'approved');
    const matchedContent = content.filter(item =>
      item.targetTags.some(tag => box.enrolledTags.includes(tag))
    );

    const filesCount = matchedContent.length || 1;
    const sizeSumBytes = matchedContent.reduce((sum, item) => sum + item.sizeBytes, 0);
    const sizeMb = sizeSumBytes > 0
      ? Math.round((sizeSumBytes / (1024 * 1024)) * 100) / 100
      : Math.round((Math.random() * 80 + 10) * 100) / 100;

    const newLog: SyncLog = {
      id: `log-${Date.now()}`,
      creatorId: user.id,
      boxId,
      boxName: box.name,
      timestamp: new Date().toISOString(),
      type: syncType === 'full' ? 'full' : 'delta',
      status: 'success',
      filesSynced: filesCount,
      dataTransferMb: sizeMb
    };

    DB.addSyncLog(newLog);

    res.status(201).json(newLog);
  } catch (err: any) {
    res.status(500).json({ error: 'Sync triggering failed.' });
  }
});

// ============================================================
// 🚀 EXPORT HANDLER (Netlify Functions v2 via serverless-http)
// ============================================================

export const handler = serverless(app);
