document.addEventListener('DOMContentLoaded', () => {
  const shortenForm = document.getElementById('shortenForm');
  const longUrlInput = document.getElementById('longUrl');
  const resultDiv = document.getElementById('result');

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
        const shortCode = data.shortCode;
        const fullShortUrl = `${window.location.origin}/${shortCode}`;

        resultDiv.innerHTML = `
          <p>Your Short URL:</p>
          <a href="${fullShortUrl}" target="_blank" id="shortUrlLink">${fullShortUrl}</a>
        `;
        resultDiv.classList.remove('hidden');
      } else {
        resultDiv.innerHTML = `<p class="error-message">Error: ${data.error || 'Failed to shorten URL'}</p>`;
        resultDiv.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      resultDiv.innerHTML = `<p class="error-message">Error connecting to server.</p>`;
      resultDiv.classList.remove('hidden');
    }
  });
});
