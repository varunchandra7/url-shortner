const express = require('express');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function generateShortCode(length = 7) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

app.post('/api/shorten', async (req, res) => {
  try {
    const { originalUrl } = req.body;
    if (!originalUrl) {
      return res.status(400).json({ error: 'originalUrl is required' });
    }

    let shortCode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      shortCode = generateShortCode(7);
      const existing = await prisma.link.findUnique({ where: { shortCode } });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    const link = await prisma.link.create({
      data: {
        shortCode,
        originalUrl,
      },
    });

    res.json({
      shortCode: link.shortCode,
      originalUrl: link.originalUrl,
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    const link = await prisma.link.findUnique({
      where: { shortCode },
    });

    if (!link) {
      return res.status(404).json({ error: 'Short URL not found' });
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
