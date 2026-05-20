import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DB } from './db';
import { Pipeline } from './pipeline';
import { ContentItem, ContentFormat, SyncLog } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 2. Creator Stats
app.get('/api/creator/stats', (req: Request, res: Response) => {
  try {
    const stats = DB.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
});

// 3. Get all uploaded content items
app.get('/api/content', (req: Request, res: Response) => {
  try {
    const content = DB.getContent();
    res.json(content);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve content list.' });
  }
});

// 4. Ingest new asset upload (supports dual real-small & simulated-large payload triggers)
app.post('/api/content/upload', (req: Request, res: Response) => {
  try {
    const { title, description, format, fileName, sizeBytes, targetTags } = req.body;

    if (!title || !format || !fileName || sizeBytes === undefined) {
      return res.status(400).json({ error: 'Missing required upload parameters.' });
    }

    const validFormats: ContentFormat[] = ['MP4', 'ZIP', 'PDF', 'EPUB'];
    if (!validFormats.includes(format as ContentFormat)) {
      return res.status(400).json({ error: 'Invalid content format.' });
    }

    // Initialize content item in queued state
    const newItem: ContentItem = {
      id: `c-${Date.now()}`,
      title,
      description: description || '',
      format: format as ContentFormat,
      fileName,
      sizeBytes: Number(sizeBytes),
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
      targetTags: Array.isArray(targetTags) ? targetTags : [],
    };

    // Save to database
    DB.addContent(newItem);

    // Asynchronously dispatch pipeline execution (unblocked background execution)
    Pipeline.processAsset(newItem.id);

    // Return the staged item immediately
    res.status(201).json(newItem);
  } catch (err: any) {
    res.status(500).json({ error: 'Ingestion upload failed.' });
  }
});

// 5. Edge Box registry
app.get('/api/boxes', (req: Request, res: Response) => {
  try {
    const boxes = DB.getBoxes();
    res.json(boxes);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve edge boxes.' });
  }
});

// 6. Edge Box Sync Logs
app.get('/api/sync-logs', (req: Request, res: Response) => {
  try {
    const logs = DB.getSyncLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve sync logs.' });
  }
});

// 7. Trigger a simulated Edge Box sync schedule event
app.post('/api/boxes/sync', (req: Request, res: Response) => {
  try {
    const { boxId, syncType } = req.body;

    if (!boxId) {
      return res.status(400).json({ error: 'Missing boxId.' });
    }

    const boxes = DB.getBoxes();
    const box = boxes.find(b => b.id === boxId);
    if (!box) {
      return res.status(404).json({ error: 'Edge Box not found.' });
    }

    // Determine target files based on box enrolledTags
    const content = DB.getContent().filter(c => c.status === 'ready');
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
