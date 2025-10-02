const express = require('express');
const app = express();
const PORT = 8020;

app.get('/test', (req, res) => {
  res.json({ message: 'Test server is working!', port: PORT });
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});