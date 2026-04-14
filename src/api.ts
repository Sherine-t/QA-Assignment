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

export const generateContentFromOpenRouter = async (apiKey: string, model: string, prompt: string) => {
  const modelToUse = model || 'openai/gpt-3.5-turbo';
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173', // Optional, for OpenRouter analytics
        'X-Title': 'Test Generation Center'
      },
      data: {
        model: modelToUse,
        messages: [{ role: 'user', content: prompt }]
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'AI Generation failed via OpenRouter.');
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
};

