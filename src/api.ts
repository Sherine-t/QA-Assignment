const PROXY_URL = import.meta.env.DEV ? 'http://localhost:3001/proxy' : '/api/proxy';
const SAVE_URL = import.meta.env.DEV ? 'http://localhost:3001/save' : '/api/save';

export const saveToOutput = async (filename: string, content: string) => {
  try {
    await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content }),
    });
  } catch (e) {
    console.error('Failed to save to output folder:', e);
  }
};

export const fetchJiraStory = async (url: string, email: string, token: string, storyId: string) => {
  const baseUrl = url.replace(/\/$/, '');
  const jiraUrl = `${baseUrl}/rest/api/3/issue/${storyId}`;
  const auth = btoa(`${email}:${token}`);
  
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: jiraUrl,
      auth: auth,
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    if (response.status === 401) throw new Error('Unauthorized: Please check your Email and API Token.');
    if (response.status === 404) throw new Error('Story not found: Please check the Story ID and URL.');
    throw new Error(errorData.message || `Error: ${response.statusText}`);
  }

  return await response.json();
};

export const generateContentFromGemini = async (modelApiKey: string, prompt: string) => {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${modelApiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      auth: '',
      data: { contents: [{ parts: [{ text: prompt }] }] }
    }),
  });

  if (!response.ok) throw new Error('AI Generation failed. Please check your API Key.');
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
};
