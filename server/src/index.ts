import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DB } from './db';
import { Pipeline } from './pipeline';
import { ContentItem, ContentFormat, SyncLog, User } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Extend express Request to support custom authenticated keys
export interface AuthenticatedRequest extends Request {
  user?: User;
  token?: string;
}

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
app.get('/api/health', (req: Request, res: Response) => {
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

    // Omit sensitive credential markers in response
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

    // Enforce storage capacity limits based on the organization's tier
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

    // Initialize content item in queued state associated with this creator
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

    // Save to database
    DB.addContent(newItem);

    // Asynchronously dispatch pipeline execution
    Pipeline.processAsset(newItem.id);

    // Return the staged item immediately
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
app.get('/api/boxes', authenticateUser, (req: Request, res: Response) => {
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

    // Determine target files based on box enrolledTags and creator content
    // Only synchronize files that are BOTH ready AND approved!
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

app.listen(PORT, () => {
  console.log(`⚡️[server]: Ileemore Creator Portal Backend running at http://localhost:${PORT}`);
});
