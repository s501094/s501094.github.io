// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;
const logFilePath = path.join(__dirname, 'logs', 'server.log');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/log', (req, res) => {
  const { logMessage } = req.body;
  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error('Error writing to log file', err);
      res.status(500).send('Error writing to log file');
    } else {
      res.status(200).send('Log message written');
    }
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

