require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
const crypto = require('crypto');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const redisUrl = process.env.REDIS_URL;
const redis = new Redis(redisUrl, {
  tls: (redisUrl && (redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io'))) ? {} : undefined,
});

redis.on('connect', () => {
  console.log('Connected to Redis successfully');
});

redis.on('error', (err) => {
  console.error('Redis Error:', err.message);
});

app.use(express.json());
app.use(express.static('public'));

function generateShortCode(length = 7) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function validateUrl(urlStr, baseUrlStr) {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: false, message: 'originalUrl is required' };
  }

  if (urlStr.length > 2048) {
    return { valid: false, message: 'URL exceeds maximum length of 2048 characters' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(urlStr);
  } catch (err) {
    return { valid: false, message: 'Invalid URL format' };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { valid: false, message: 'Only http and https protocols are allowed' };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    return { valid: false, message: 'Local and loopback URLs are not allowed' };
  }

  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = hostname.match(ipv4Pattern);
  if (ipMatch) {
    const [, oct1, oct2] = ipMatch.map(Number);
    if (
      oct1 === 10 ||
      oct1 === 127 ||
      (oct1 === 172 && oct2 >= 16 && oct2 <= 31) ||
      (oct1 === 192 && oct2 === 168) ||
      (oct1 === 169 && oct2 === 254)
    ) {
      return { valid: false, message: 'Private IP addresses are not allowed' };
    }
  }

  try {
    const parsedBase = new URL(baseUrlStr);
    if (parsedUrl.host === parsedBase.host) {
      return { valid: false, message: 'Self-referencing URLs are not allowed' };
    }
  } catch (e) {}

  return { valid: true };
}

app.post('/api/shorten', async (req, res) => {
  try {
    const { originalUrl } = req.body;
    const validation = validateUrl(originalUrl, BASE_URL);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    let shortCode;
    let link = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (!link && attempts < maxAttempts) {
      attempts++;
      shortCode = generateShortCode(7);
      try {
        link = await prisma.link.create({
          data: {
            shortCode,
            originalUrl,
          },
        });
      } catch (dbError) {
        if (dbError.code === 'P2002' && attempts < maxAttempts) {
          console.warn(`Collision detected on shortCode ${shortCode}, retrying (attempt ${attempts})...`);
          continue;
        }
        throw dbError;
      }
    }

    if (!link) {
      return res.status(500).json({ error: 'Failed to generate a unique short code. Please try again.' });
    }

    try {
      await redis.set(link.shortCode, link.originalUrl, 'EX', 86400);
    } catch (redisError) {
      console.error('Redis pre-cache error:', redisError.message);
    }

    const shortUrl = `${BASE_URL}/${link.shortCode}`;

    res.json({
      shortCode: link.shortCode,
      originalUrl: link.originalUrl,
      shortUrl,
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    let cachedUrl = null;
    try {
      cachedUrl = await redis.get(shortCode);
    } catch (redisError) {
      console.error('Redis get error:', redisError.message);
    }

    if (cachedUrl) {
      console.log('Cache Hit');
      return res.redirect(301, cachedUrl);
    }

    console.log('Cache Miss');

    const link = await prisma.link.findUnique({
      where: { shortCode },
    });

    if (!link) {
      return res.status(404).json({ error: 'Short URL not found' });
    }

    try {
      await redis.set(shortCode, link.originalUrl, 'EX', 86400);
    } catch (redisError) {
      console.error('Redis set error:', redisError.message);
    }

    return res.redirect(301, link.originalUrl);
  } catch (error) {
    console.error('Error redirecting short code:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
