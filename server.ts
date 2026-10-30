import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for high-res photos and video uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Trust proxy for reverse proxies in Cloud Run / dev environments
  app.set('trust proxy', true);

  // Serve static uploads with CORS & Cross-Origin-Resource-Policy headers
  app.use('/uploads', (_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(uploadsDir));

  // Serve preset avatars directory
  const avatarsDir = path.join(process.cwd(), 'public', 'avatars');
  app.use('/avatars', (_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(avatarsDir));

  // Serve downloadable project archives (.zip / .tar.gz / .exe) with forced download header
  const downloadsDir = path.join(process.cwd(), 'public', 'downloads');

  const sendAttachment = (filePath: string, filename: string, res: express.Response) => {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (filename.endsWith('.exe')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    } else if (filename.endsWith('.zip')) {
      res.setHeader('Content-Type', 'application/zip');
    } else if (filename.endsWith('.tar.gz')) {
      res.setHeader('Content-Type', 'application/gzip');
    }
    return res.sendFile(filePath);
  };

  app.get('/downloads/:filename', (req, res, next) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(downloadsDir, filename);
    if (fs.existsSync(filePath)) {
      return sendAttachment(filePath, filename, res);
    }
    next();
  });

  app.get('/api/download/exe', (_req, res) => {
    const filePath = path.join(downloadsDir, 'FS_Chat.exe');
    if (fs.existsSync(filePath)) {
      return sendAttachment(filePath, 'FS_Chat.exe', res);
    }
    res.status(404).send('File not found');
  });

  app.get('/api/download/zip', (_req, res) => {
    const filePath = path.join(downloadsDir, 'FS_Chat-Windows.zip');
    if (fs.existsSync(filePath)) {
      return sendAttachment(filePath, 'FS_Chat-Windows.zip', res);
    }
    res.status(404).send('File not found');
  });
  app.use('/downloads', (_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(downloadsDir));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Browser Config Path helper
  const getBrowserConfigFile = () => {
    const localAppData = process.env.LOCALAPPDATA || process.env.USERPROFILE || process.env.HOME || process.cwd();
    const appDir = path.join(localAppData, 'FS_Chat');
    if (!fs.existsSync(appDir)) {
      try { fs.mkdirSync(appDir, { recursive: true }); } catch (_) {}
    }
    return path.join(appDir, 'browser_config.json');
  };

  const getLocalBrowserConfigFile = () => {
    return path.join(process.cwd(), 'browser_config.json');
  };

  // GET /api/browser-config
  app.get('/api/browser-config', (_req, res) => {
    try {
      const primaryFile = getBrowserConfigFile();
      const localFile = getLocalBrowserConfigFile();
      let raw: string | null = null;
      if (fs.existsSync(primaryFile)) {
        raw = fs.readFileSync(primaryFile, 'utf-8');
      } else if (fs.existsSync(localFile)) {
        raw = fs.readFileSync(localFile, 'utf-8');
      }

      if (raw) {
        const parsed = JSON.parse(raw);
        return res.json({ success: true, config: parsed });
      }

      return res.json({
        success: true,
        config: {
          browser: 'auto',
          rememberChoice: true,
          updatedAt: Date.now()
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error reading config';
      return res.status(500).json({ error: message });
    }
  });

  // POST /api/browser-config
  app.post('/api/browser-config', (req, res) => {
    try {
      const { browser = 'auto', rememberChoice = true } = req.body;
      const config = {
        browser,
        rememberChoice: Boolean(rememberChoice),
        updatedAt: Date.now()
      };
      const json = JSON.stringify(config, null, 2);

      // Save to both %LOCALAPPDATA%/FS_Chat and ./browser_config.json
      try {
        const primaryFile = getBrowserConfigFile();
        fs.writeFileSync(primaryFile, json, 'utf-8');
      } catch (e) {
        console.warn('Could not write primary browser_config:', e);
      }

      try {
        const localFile = getLocalBrowserConfigFile();
        fs.writeFileSync(localFile, json, 'utf-8');
      } catch (e) {
        console.warn('Could not write local browser_config:', e);
      }

      return res.json({ success: true, config });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error writing config';
      return res.status(500).json({ error: message });
    }
  });

  // Media Upload Endpoint: handles photos & videos from local device & stores online
  app.post('/api/upload', (req, res) => {
    try {
      const { fileData, fileName } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: 'Missing fileData' });
      }

      let buffer: Buffer;
      let extension = 'jpg';

      if (fileData.startsWith('data:')) {
        const matches = fileData.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mime = matches[1];
          const extFromMime = mime.split('/')[1]?.split(';')[0];
          if (extFromMime) {
            extension = extFromMime === 'jpeg' ? 'jpg' : extFromMime;
          }
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(fileData, 'base64');
        }
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }

      if (fileName && fileName.includes('.')) {
        const ext = fileName.split('.').pop();
        if (ext) extension = ext.toLowerCase();
      }

      // Generate unique name
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const savedFileName = `media-${uniqueSuffix}.${extension}`;
      const filePath = path.join(uploadsDir, savedFileName);

      fs.writeFileSync(filePath, buffer);

      // Construct online URL with forwarded headers support
      const forwardedHost = req.get('x-forwarded-host');
      const host = forwardedHost || req.get('host') || `localhost:${PORT}`;
      const protoHeader = req.get('x-forwarded-proto');
      const protocol = protoHeader || (req.secure ? 'https' : (req.protocol || 'https'));
      const onlineUrl = `${protocol}://${host}/uploads/${savedFileName}`;

      return res.json({
        success: true,
        url: onlineUrl,
        relativePath: `/uploads/${savedFileName}`,
        fileName: savedFileName,
        size: buffer.length
      });
    } catch (err: unknown) {
      console.error('Upload error:', err);
      const message = err instanceof Error ? err.message : 'Failed to save file';
      return res.status(500).json({ error: message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
