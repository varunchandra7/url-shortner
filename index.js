const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/api/shorten', (req, res) => {
  const { originalUrl } = req.body;
  res.json({ shortUrl: 'xyz1234' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
