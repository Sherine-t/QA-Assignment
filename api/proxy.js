import axios from 'axios';

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
  }
}
