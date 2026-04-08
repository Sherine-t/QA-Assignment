import { useState } from 'react'
import './App.css'

import type { JiraStory, PlaywrightScriptItem } from './types';
import { fetchJiraStory, saveToOutput, generateContentFromGemini } from './api';

function App() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [storyId, setStoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<JiraStory | null>(null);
  const [modelApiKey, setModelApiKey] = useState('');
  const [generating, setGenerating] = useState(false);
  const [testCases, setTestCases] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<'home' | 'playwright'>('home');
  const [playwrightScripts, setPlaywrightScripts] = useState<PlaywrightScriptItem[] | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);


  const fetchStory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStory(null);

    try {
      const data = await fetchJiraStory(url, email, token, storyId);
      setStory(data);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'Failed to fetch') {
        setError('Connection Error: Make sure the local proxy server is running (npm run proxy).');
      } else {
        setError(err.message || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };



  const generateTestCases = async () => {
    if (!story) return;
    setGenerating(true);
    setTestCases(null);
    setError(null);

    if (!modelApiKey) {
      setTimeout(() => {
        const fallbackMarkdown = `| Test ID | Test Type | Title | Precomputing | Steps | Expected Result | Priority |
|---|---|---|---|---|---|---|
| TC_POS_01 | Positive | Verify successful action for ${story.key} | System is in valid state | 1. Navigate to feature<br>2. Perform primary action | Action completes successfully | High |
| TC_NEG_01 | Negative | Verify error handling for invalid input in ${story.key} | System is in valid state | 1. Enter invalid data<br>2. Submit | Appropriate error message is displayed | High |
| TC_EDG_01 | Edge Case | Verify boundary limit for ${story.key} | System is at maximum data limit | 1. Enter maximum allowed characters/value | System handles limit without crashing | Medium |

*Note: This is a fallback test suite generated because the Gemini API key was not provided.*`;
        setTestCases(fallbackMarkdown);
        saveToOutput(`${story.key}_test_cases.md`, fallbackMarkdown);
        setGenerating(false);
      }, 1000);
      return;
    }

    try {
      // Prepare the prompt
      const descriptionText = story.fields.description?.content
        ?.map((b: any) => b.content?.map((t: any) => t.text).join('')).join('\n') || '';
      
      const prompt = `As a QA Expert, generate a comprehensive suite of manual test cases for the following Jira User Story:
      
      Summary: ${story.fields.summary}
      Description: ${descriptionText}
      
      Please provide the test cases in a clear Markdown Table format with the following columns:
      | Test ID | Test Type | Title | Precomputing | Steps | Expected Result | Priority |
      Make sure to include Positive, Negative, and Edge Cases.
      `;

      const generatedText = await generateContentFromGemini(modelApiKey, prompt);
      setTestCases(generatedText);
      if (generatedText) {
        saveToOutput(`${story.key}_test_cases.md`, generatedText);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate test cases.');
    } finally {
      setGenerating(false);
    }
  };

  const generatePlaywrightScript = async () => {
    if (!testCases) return;
    setGeneratingScript(true);
    setError(null);
    setPlaywrightScripts(null);

    if (!modelApiKey) {
      setTimeout(() => {
        const scripts = [
          {
            id: 'TC_POS_01', 
            title: 'Verify successful action', 
            script: `import { test, expect } from '@playwright/test';\n\ntest('Verify successful action', async ({ page }) => {\n  await page.goto('/');\n  // TODO: Add steps\n});`
          },
          {
            id: 'TC_NEG_01', 
            title: 'Verify error handling', 
            script: `import { test, expect } from '@playwright/test';\n\ntest('Verify error handling for invalid input', async ({ page }) => {\n  await page.goto('/');\n  // TODO: Add steps\n});`
          },
          {
            id: 'TC_EDG_01', 
            title: 'Verify boundary limit', 
            script: `import { test, expect } from '@playwright/test';\n\ntest('Verify boundary limit', async ({ page }) => {\n  await page.goto('/');\n  // TODO: Add steps\n});`
          }
        ];
        setPlaywrightScripts(scripts);
        scripts.forEach(s => saveToOutput(`${s.id}_script.txt`, s.script));
        setGeneratingScript(false);
      }, 1000);
      return;
    }

    try {
      const prompt = `You are an expert Playwright automation engineer.
Convert the following test suite into clean, production-grade Playwright Typescript tests.

Requirements:
- Implement Page Object Model (POM) for all pages
- Use Fixtures with POM also use fixtures instead of beforeEach and afterEach hooks where appropriate.
- Use page object model with the below folder structure
├── tests/                          # Test scenarios only (grouped by feature/module)
├── pages/                          # Page Object Model (POM) – locators + actions
├── fixtures/                       # Custom Playwright fixtures (e.g., logged-in user)
├── utils/                          # Reusable helpers (API calls, date utils, etc.)
├── data/                           # Test data (JSON, CSV, etc.)
├── components/                     # Optional: Reusable UI components
├── auth/                           # Stored auth states (for logged-in tests)
├── config/                         # Environment-specific configs (optional)
├── playwright.config.ts            # Root configuration
├── package.json
├── tsconfig.json
├── .env                            # Environment variables
└── test-results/                   # Auto-generated (add to .gitignore)

- Include trace on failure
- Assertions must be in test scripts, not in POM methods
- suggest robust and unique Playwright locators and Prioritize getByRole/getByLabel/getByTestId
- Output ONLY the complete typescript code (no explanations).

Here are the test cases to convert:
${testCases}

IMPORTANT: The UI dynamically renders files into cards, and parses your JSON. You must return your output EXACTLY as a JSON array of objects, with no external markdown tags. Each object should represent a specific generated file and have these exact keys:
- "id": A concise filename including the path (e.g., "tests/login.spec.ts" or "pages/LoginPage.ts")
- "title": A short functional description of the file
- "script": The complete Playwright TypeScript code for this file.

Example format:
[
  {
    "id": "tests/login.spec.ts",
    "title": "Login Feature Tests",
    "script": "import { test } from '../fixtures/base';\\n\\ntest('Login', async ({ loginPage }) => {\\n  // test details\\n});"
  }
]`;

      let generatedText = await generateContentFromGemini(modelApiKey, prompt);
      if (generatedText) {
        generatedText = generatedText.replace(/```(json)?/g, '').replace(/```/g, '').trim();
        try {
           const parsed = JSON.parse(generatedText);
           setPlaywrightScripts(parsed);
           parsed.forEach((s: any) => saveToOutput(`${s.id}_script.txt`, s.script));
        } catch(e) {
           throw new Error("Failed to parse AI output. The model did not return a valid JSON array.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate Playwright script.');
    } finally {
      setGeneratingScript(false);
    }
  };

  // Helper to extract text from Jira's ADF (Atlassian Document Format)
  const renderDescription = (doc: any) => {
    if (!doc || !doc.content) return 'No description provided.';
    return doc.content.map((block: any, i: number) => {
      if (block.type === 'paragraph' && block.content) {
        return <p key={i}>{block.content.map((text: any) => text.text).join('')}</p>;
      }
      return null;
    });
  };

  const downloadCSV = () => {
    if (!testCases) return;
    const lines = testCases.split('\n').filter(line => line.trim().startsWith('|') && line.trim().endsWith('|'));
    if (lines.length < 2) return;
    
    const csvContent = lines.filter((line, index) => !(index === 1 && line.includes('---'))).map(line => {
      const cols = line.trim().replace(/^\||\|$/g, '').split('|');
      return cols.map(c => `"${c.trim().replace(/"/g, '""')}"`).join(',');
    }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${story?.key || 'test_cases'}.csv`;
    link.click();
  };

  const copyScriptToClipboard = (script: string) => {
    navigator.clipboard.writeText(script);
  };

  const downloadScriptAsFile = (id: string, script: string) => {
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${id}_script.txt`;
    link.click();
  };

  return (
    <div className="App">
      <header>
        <h1>Jira Story Navigator</h1>
        <p className="subtitle">Securely fetch and view user stories from your Jira instance</p>
      </header>

      <main>
        {currentPage === 'home' ? (
          <>
            <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <form onSubmit={fetchStory}>
            <div className="input-group">
              <label className="input-label">Project URL</label>
              <input 
                type="url" 
                className="input-field" 
                placeholder="https://your-domain.atlassian.net" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Email ID</label>
              <input 
                type="email" 
                className="input-field" 
                placeholder="email@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">API Token</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Your Jira API Token" 
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Gemini API Key (optional)</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Enter Gemini API Key" 
                value={modelApiKey}
                onChange={(e) => setModelApiKey(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Story ID (Key)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="PROJ-123" 
                value={storyId}
                onChange={(e) => setStoryId(e.target.value)}
                required
              />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Fetching...
                </>
              ) : 'Fetch User Story'}
            </button>
          </form>
        </div>

        {story && (
          <div className="story-container">
            <div className="story-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.75rem' }}>{story.fields.summary}</h2>
                  <code style={{ marginTop: '0.5rem', display: 'inline-block' }}>{story.key}</code>
                </div>
                <span className="status-badge">{story.fields.status.name}</span>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 className="input-label" style={{ color: 'var(--text-main)', marginBottom: '0.75rem' }}>Description</h3>
                <div style={{ color: 'var(--text-muted)' }}>
                  {renderDescription(story.fields.description)}
                </div>
              </div>

              <div className="meta-info">
                <div className="meta-item">
                  <strong>Type:</strong> {story.fields.issuetype.name}
                </div>
                <div className="meta-item">
                  <strong>Priority:</strong> {story.fields.priority.name}
                </div>
                <div className="meta-item">
                  <strong>Reporter:</strong> {story.fields.reporter.displayName}
                </div>
              </div>

              <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                <button 
                  className="btn-primary" 
                  style={{ maxWidth: '300px' }}
                  onClick={generateTestCases}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <span className="loading-spinner"></span>
                      Generating Test Cases...
                    </>
                  ) : modelApiKey ? 'Generate AI Test Cases' : 'Generate Fallback Test Cases'}
                </button>
              </div>

              {testCases && (
                <div style={{ marginTop: '3rem', animation: 'fadeIn 0.5s ease-out' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 className="input-label" style={{ color: 'var(--text-main)', fontSize: '1.25rem', margin: 0 }}>Generated Test Cases</h3>
                    <button className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem', width: 'auto' }} onClick={downloadCSV}>
                      Download as CSV/Excel
                    </button>
                  </div>
                  <div className="glass-card" style={{ padding: '1.5rem', overflowX: 'auto', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div className="markdown-content" style={{ textAlign: 'left', fontSize: '0.9rem' }}>
                      {/* Simple Markdown Table to HTML conversion could go here, for now we render as-is with white-space pre-wrap */}
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--text-muted)' }}>
                        {testCases}
                      </pre>
                    </div>
                  </div>
                  <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                    <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setCurrentPage('playwright')}>
                      Navigate to Automation Scripts ➔
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
          </>
        ) : (
          <div className="story-container">
            <div className="story-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Playwright Automation Script Generator</h2>
                <button className="btn-secondary" style={{ width: 'auto', padding: '0.4rem 1rem', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }} onClick={() => setCurrentPage('home')}>
                  ⬅ Back to Test Cases
                </button>
              </div>
              <p style={{ color: 'var(--text-muted)' }}>Generate Playwright automation scripts based on the test cases fetched from {story?.key}.</p>

              <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                <button 
                  className="btn-primary" 
                  style={{ maxWidth: '300px' }}
                  onClick={generatePlaywrightScript}
                  disabled={generatingScript}
                >
                  {generatingScript ? (
                    <>
                      <span className="loading-spinner"></span>
                      Generating Script...
                    </>
                  ) : modelApiKey ? 'Generate AI Playwright Script' : 'Generate Fallback Script'}
                </button>
              </div>
              
              {playwrightScripts && playwrightScripts.length > 0 && (
                <div style={{ marginTop: '3rem', animation: 'fadeIn 0.5s ease-out' }}>
                  <h3 className="input-label" style={{ color: 'var(--text-main)', fontSize: '1.25rem', marginBottom: '1.5rem' }}>Generated Scripts</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {playwrightScripts.map((item, index) => (
                      <div key={index} className="glass-card" style={{ padding: '1.5rem', overflowX: 'auto', background: '#1e1e1e', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #333', paddingBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <span className="status-badge" style={{ margin: 0 }}>{item.id}</span>
                            <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '1rem' }}>{item.title}</h4>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', width: 'auto', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent' }} onClick={() => copyScriptToClipboard(item.script)}>Copy</button>
                            <button className="btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', width: 'auto' }} onClick={() => downloadScriptAsFile(item.id, item.script)}>Download</button>
                          </div>
                        </div>
                        <div className="markdown-content" style={{ textAlign: 'left', fontSize: '0.9rem' }}>
                          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#9cdcfe', margin: 0 }}>
                            {item.script}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={{ marginTop: '4rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        <p>© 2026 Test Generation Center. Powered by Antigravity.</p>
      </footer>
    </div>
  )
}

export default App
