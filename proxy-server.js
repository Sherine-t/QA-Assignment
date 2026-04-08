import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/proxy', async (req, res) => {
  const { url, auth, method, headers, data } = req.body;
  
  try {
    const axiosConfig = {
      url,
      method: method || 'GET',
      headers: {
        ...headers,
      },
      data: data || null
    };

    if (auth) {
      axiosConfig.headers['Authorization'] = `Basic ${auth}`;
    }
    
    const response = await axios(axiosConfig);
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
  }
});

app.post('/save', (req, res) => {
  const { filename, content } = req.body;
  try {
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true });
  } catch (error) {
    console.error('File save error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`CORS Proxy running at http://localhost:${PORT}`);
});
