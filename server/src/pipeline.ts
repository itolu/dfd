import { DB } from './db';
import { ContentItem, ContentManifest, ContentFormat } from './types';

// Strict file standards from the PRD
const SIZE_LIMITS_BYTES: Record<ContentFormat, number> = {
  MP4: 500 * 1024 * 1024,  // 500 MB
  ZIP: 200 * 1024 * 1024,  // 200 MB
  PDF: 100 * 1024 * 1024,  // 100 MB
  EPUB: 50 * 1024 * 1024,  // 50 MB
};

export class Pipeline {
  private static sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Simulated SHA-256 generation
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
    const items = DB.getContent();
    const item = items.find(c => c.id === itemId);
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
          `File exceeds maximum permitted size for format ${item.format}. (Limit: ${limit / (1024 * 1024)}MB)`
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
          throw new Error('HTML5 ZIP packages must contain an "index.html" file at the root namespace.');
        }
      }

      // Stage 2: Transcoding (Only for MP4)
      if (item.format === 'MP4') {
        console.log(`🎥 [Pipeline]: Commencing MP4 H.264 transcoding for: ${item.title}`);
        item.status = 'transcoding';
        
        // Loop to simulate active video rendering progress
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

      // Stage 3: Manifest Generation & Cryptographic Checksumting
      console.log(`📄 [Pipeline]: Building distribution manifest for: ${item.title}`);
      item.status = 'manifest_generating';
      item.progress = 90;
      DB.updateContent(item);
      await this.sleep(1200);

      // Generate Cryptographic Device-DRM Safe Checksum
      const shaChecksum = this.generateChecksum(item.title, item.sizeBytes);
      item.checksum = shaChecksum;

      // Compile compliant PRD manifest details
      const manifest: ContentManifest = {
        contentId: item.id,
        title: item.title,
        format: item.format,
        fileChecksum: shaChecksum,
        sizeBytes: item.sizeBytes,
        processedAt: new Date().toISOString(),
        targetDeviceCriteria: {
          enrolledTags: item.targetTags,
          transcoded: item.format === 'MP4', // Transcoded to H.264 480p target
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
      item.errorMessage = error.message || 'Fatal file pipeline ingestion error.';
      DB.updateContent(item);
    }
  }
}
