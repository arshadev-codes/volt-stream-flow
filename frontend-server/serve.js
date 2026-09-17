const express = require('express');
const path = require('path');
const app = express();

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.use((req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.listen(3001, () => console.log('Frontend running on port 3001'));