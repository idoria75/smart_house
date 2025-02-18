const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

// A simple API endpoint
app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

app.listen(port, () => {
  console.log(`Backend server is running on http://localhost:${port}`);
});
