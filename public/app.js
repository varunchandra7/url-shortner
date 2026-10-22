document.addEventListener('DOMContentLoaded', () => {
  const shortenForm = document.getElementById('shortenForm');
  const longUrlInput = document.getElementById('longUrl');
  const resultDiv = document.getElementById('result');
  const shortUrlInput = document.getElementById('shortUrlInput');
  const copyBtn = document.getElementById('copyBtn');
  const openLink = document.getElementById('openLink');

  shortenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const originalUrl = longUrlInput.value.trim();

    if (!originalUrl) return;

    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ originalUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        const fullShortUrl = data.shortUrl || `${window.location.origin}/${data.shortCode}`;

        shortUrlInput.value = fullShortUrl;
        openLink.href = fullShortUrl;
        openLink.textContent = `Open Link (${fullShortUrl}) ↗`;

        resultDiv.classList.remove('hidden');
      } else {
        alert(`Error: ${data.error || 'Failed to shorten URL'}`);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      alert('Error connecting to server.');
    }
  });

  copyBtn.addEventListener('click', async () => {
    const urlToCopy = shortUrlInput.value;
    if (!urlToCopy) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(urlToCopy);
      } else {
        shortUrlInput.select();
        document.execCommand('copy');
      }

      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');

      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });
});
