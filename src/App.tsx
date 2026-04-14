import { useState } from 'react'
import './App.css'

import type { JiraStory, PlaywrightScriptItem, TestCase } from './types';
import { fetchJiraStory, saveToOutput, generateContentFromOpenRouter } from './api';

function App() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [storyId, setStoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<JiraStory | null>(null);
  const [modelApiKey, setModelApiKey] = useState('');
  const [routerModel, setRouterModel] = useState('openai/gpt-3.5-turbo');
  const [generating, setGenerating] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[] | null>(null);
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

  const getFullDescriptionText = (doc: any): string => {
    if (!doc) return '';
    if (typeof doc === 'string') return doc;
    if (!doc.content) return '';

    const extract = (node: any): string => {
      if (node.type === 'text') return node.text || '';
      if (node.content) {
        return node.content.map((n: any) => extract(n)).join(' ');
      }
      return '';
    };

    return doc.content.map((b: any) => extract(b)).join('\n');
  };

  const generateTestCases = async () => {
    if (!story) return;
    setGenerating(true);
    setTestCases(null);
    setError(null);

    if (!modelApiKey) {
      setTimeout(() => {
        const summary = story.fields.summary;
        const dynamicFallback: TestCase[] = [
          {
            id: 'TC_POS_01',
            summary: `Verify successful happy path for: ${summary}`,
            steps: `1. Log in to the application.\n2. Navigate to the feature described in ${summary}.\n3. Input valid data as per requirements.\n4. Click 'Submit/Proceed'.`,
            testData: 'Valid user profile, completed mandatory fields',
            expectedResult: `The ${summary} action completes successfully and the system reflects the update.`,
            actualResult: 'As expected (Simulated)',
            status: 'Pass'
          },
          {
            id: 'TC_NEG_01',
            summary: `Verify validation errors for: ${summary}`,
            steps: `1. Navigate to the feature mentioned in ${summary}.\n2. Leave mandatory fields empty.\n3. Input invalid characters in numeric fields.\n4. Click 'Submit'.`,
            testData: 'Empty fields, special characters (!@#), excessively long strings',
            expectedResult: 'System displays appropriate validation messages and blocks the action.',
            actualResult: 'As expected (Simulated)',
            status: 'Pass'
          },
          {
            id: 'TC_EDG_01',
            summary: `Verify boundary conditions for: ${summary}`,
            steps: `1. Identify the maximum limits for ${summary}.\n2. Input data at the exact threshold.\n3. Attempt to exceed the threshold by 1 unit.\n4. Verify system behavior.`,
            testData: 'Max characters (e.g., 255), Max value, Zero value',
            expectedResult: 'System handles boundary values correctly without crashing or data loss.',
            actualResult: 'As expected (Simulated)',
            status: 'Pass'
          }
        ];
        setTestCases(fallbackCases => fallbackCases || dynamicFallback);
        setTestCases(dynamicFallback);
        saveToOutput(`${story.key}_test_cases.json`, JSON.stringify(dynamicFallback, null, 2));
        setGenerating(false);
      }, 1000);
      return;
    }

    try {
      const descriptionText = getFullDescriptionText(story.fields.description);
      
      const prompt = `As a Senior QA Engineer, generate a comprehensive suite of highly specific manual test cases for the following Jira User Story. 
      
      CRITICAL: Every test case MUST be uniquely tailored to the features, logic, and acceptance criteria defined below. DO NOT provide generic or template-style test cases.
      
      STORY SUMMARY: ${story.fields.summary}
      FULL DESCRIPTION/REQUIREMENTS: ${descriptionText}
      
      Please provide the test cases as a JSON array of objects. Each object MUST have:
      - "id": A unique ID (e.g., TC_POS_01, TC_NEG_03)
      - "summary": A clear, story-specific summary
      - "steps": Detailed, numbered, step-by-step instructions matching the story's UI/Logic
      - "testData": Specific data required (e.g., "Email: test@example.com", "Amount: 10.50")
      - "expectedResult": Specific system behavior based on the requirements
      - "actualResult": (Set to "Pending Execution")
      - "status": (Set to "Not Run")

      Include at least 6 test cases covering: Positive scenarios, Negative scenarios, and Edge cases.
      IMPORTANT: Return ONLY the raw JSON array. No markdown, no "json" tags.`;

      let generatedText = await generateContentFromOpenRouter(modelApiKey, routerModel, prompt);
      if (generatedText) {
        generatedText = generatedText.replace(/```(json)?/g, '').replace(/```/g, '').trim();
        const startIndex = generatedText.indexOf('[');
        const endIndex = generatedText.lastIndexOf(']');
        if (startIndex !== -1 && endIndex !== -1) {
          generatedText = generatedText.substring(startIndex, endIndex + 1);
        }
        const parsed = JSON.parse(generatedText);
        setTestCases(parsed);
        saveToOutput(`${story.key}_test_cases.json`, JSON.stringify(parsed, null, 2));
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
        const dynamicScripts = testCases.map((tc) => ({
          id: `tests/${story?.key || 'story'}_${tc.id}.spec.ts`,
          title: tc.id,
          script: `import { test, expect } from '@playwright/test';\n\n/**\n * Test Case: ${tc.id}\n * Summary: ${tc.summary}\n */\ntest('${tc.id}', async ({ page }) => {\n  await page.goto('https://example.com');\n  // Simulated steps based on: ${tc.summary}\n  console.log('Executing steps: ${tc.steps.replace(/\n/g, ' ')}');\n  \n  // Example of direct Playwright actions:\n  // await page.getByRole('button', { name: 'Action' }).click();\n  // await expect(page.locator('.success')).toBeVisible();\n});`
        }));
        
        setPlaywrightScripts(dynamicScripts);
        dynamicScripts.forEach(s => saveToOutput(`${s.id.split('/').pop()}`, s.script));
        setGeneratingScript(false);
      }, 1000);
      return;
    }

    try {
      const prompt = `You are an expert Playwright automation engineer.
You are provided with ${testCases.length} manual test cases. 
Generate a UNIQUE, SIMPLE, standalone Playwright TypeScript test (.spec.ts) for EACH AND EVERY ONE of them.

Manual Test Cases:
${JSON.stringify(testCases, null, 2)}

Requirements:
- You MUST return ${testCases.length} JSON objects in a single array. One for each manual test case.
- ONLY generate .spec.ts files. No POM, no utils.
- Write locators and actions directly inside the test() blocks.
- Use robust locators: page.getByRole(), page.getByLabel(), page.getByTestId().
- Match the manual steps exactly for each test.

IMPORTANT: Return EXACTLY a JSON array of ${testCases.length} objects. No markdown.
Each object keys:
- "id": The filename (e.g., "tests/${story?.key || 'story'}_TC_..._.spec.ts")
- "title": THE EXACT Testcase ID (e.g. TC_POS_01)
- "script": The complete Playwright TypeScript code.

Example format:
[
  {
    "id": "tests/TC_POS_01.spec.ts",
    "title": "TC_POS_01",
    "script": "import { test, expect } from '@playwright/test';\\n\\ntest('TC_POS_01', async ({ page }) => {\\n  await page.goto('/login');\\n  // ... steps ...\\n});"
  }
]`;

      let generatedText = await generateContentFromOpenRouter(modelApiKey, routerModel, prompt);
      if (generatedText) {
        generatedText = generatedText.replace(/```(json)?/g, '').replace(/```/g, '').trim();
        const startIndex = generatedText.indexOf('[');
        const endIndex = generatedText.lastIndexOf(']');
        if (startIndex !== -1 && endIndex !== -1) {
          generatedText = generatedText.substring(startIndex, endIndex + 1);
        }
        try {
           const parsed = JSON.parse(generatedText);
           setPlaywrightScripts(parsed);
           parsed.forEach((s: any) => saveToOutput(`${s.id.split('/').pop()}`, s.script));
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

  const renderDescription = (doc: any): any => {
    if (!doc) return 'No description provided.';
    if (typeof doc === 'string') return <p>{doc}</p>;
    if (!doc.content) return 'No description provided.';

    const parseNode = (node: any, key: string | number): any => {
      if (node.type === 'text') {
        let text: any = node.text;
        if (node.marks) {
          node.marks.forEach((mark: any) => {
            if (mark.type === 'strong') text = <strong key={`${key}-s`}>{text}</strong>;
            if (mark.type === 'em') text = <em key={`${key}-e`}>{text}</em>;
            if (mark.type === 'code') text = <code key={`${key}-c`}>{text}</code>;
          });
        }
        return text;
      }

      if (node.content) {
        const children = node.content.map((child: any, i: number) => parseNode(child, `${key}-${i}`));
        
        switch (node.type) {
          case 'paragraph': return <p key={key}>{children}</p>;
          case 'heading': {
            const level = node.attrs?.level || 3;
            if (level === 1) return <h1 key={key} style={{ marginTop: '1rem', color: 'var(--text-main)' }}>{children}</h1>;
            if (level === 2) return <h2 key={key} style={{ marginTop: '1rem', color: 'var(--text-main)' }}>{children}</h2>;
            return <h3 key={key} style={{ marginTop: '1rem', color: 'var(--text-main)' }}>{children}</h3>;
          }
          case 'bulletList': return <ul key={key} style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>{children}</ul>;
          case 'orderedList': return <ol key={key} style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>{children}</ol>;
          case 'listItem': return <li key={key} style={{ marginBottom: '0.25rem' }}>{children}</li>;
          case 'blockquote': return <blockquote key={key} style={{ borderLeft: '3px solid var(--primary)', paddingLeft: '1rem', margin: '1rem 0', color: 'var(--text-muted)' }}>{children}</blockquote>;
          case 'codeBlock': return <pre key={key} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', overflowX: 'auto' }}><code>{children}</code></pre>;
          default: return <span key={key}>{children}</span>;
        }
      }
      return null;
    };

    return doc.content.map((block: any, i: number) => parseNode(block, i));
  };

  const downloadCSV = () => {
    if (!testCases || testCases.length === 0) return;
    
    const headers = ['Testcase ID', 'Summary', 'Steps', 'TestData', 'Expected Result', 'Actual Result', 'Status'];
    const csvRows = [
      headers.join(','),
      ...testCases.map(tc => [
        `"${tc.id.replace(/"/g, '""')}"`,
        `"${tc.summary.replace(/"/g, '""')}"`,
        `"${tc.steps.replace(/"/g, '""')}"`,
        `"${tc.testData.replace(/"/g, '""')}"`,
        `"${tc.expectedResult.replace(/"/g, '""')}"`,
        `"${tc.actualResult.replace(/"/g, '""')}"`,
        `"${tc.status.replace(/"/g, '""')}"`
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
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
    link.download = `${id.split('/').pop()}`;
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
              <label className="input-label">OpenRouter API Key (optional)</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="sk-or-v1-..." 
                value={modelApiKey}
                onChange={(e) => setModelApiKey(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Model Name</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g., openai/gpt-3.5-turbo, anthropic/claude-3-haiku" 
                value={routerModel}
                onChange={(e) => setRouterModel(e.target.value)}
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
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {testCases.map((tc, idx) => (
                      <div key={idx} className="glass-card" style={{ padding: '1.5rem', textAlign: 'left', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <span className="status-badge" style={{ margin: 0, background: 'var(--primary)', color: 'white' }}>{tc.id}</span>
                            <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>{tc.summary}</h4>
                          </div>
                          <span className={`status-badge ${tc.status.toLowerCase() === 'pass' ? 'status-pass' : ''}`} style={{ margin: 0 }}>{tc.status}</span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          <div>
                            <h5 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Steps</h5>
                            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>{tc.steps}</pre>
                          </div>
                          <div>
                            <h5 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Test Data</h5>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>{tc.testData}</p>
                          </div>
                          <div>
                            <h5 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Expected Result</h5>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>{tc.expectedResult}</p>
                          </div>
                          <div>
                            <h5 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Actual Result</h5>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>{tc.actualResult}</p>
                          </div>
                        </div>
                      </div>
                    ))}
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
