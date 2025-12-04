// server.js
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const path = require('path');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const MarkdownIt = require('markdown-it');
const katex = require('katex');

const app = express();
app.use(helmet());
app.use(bodyParser.json({ limit: '2mb' }));

// Serve static frontend files from "public"
app.use(express.static(path.join(__dirname, 'public')));

// Markdown-it instance
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

// DOMPurify via jsdom (server-side sanitization)
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// In-memory saved rules for demo (use DB in production)
let savedUserRules = [];

/**
 * Apply simple literal find/replace user rules (safe).
 */
function applyUserRules(text, rules = []) {
  const MAX_RULES = 200, MAX_FIND = 200, MAX_REPLACE = 2000;
  if (!Array.isArray(rules)) return text;
  let result = text;
  for (const r of rules.slice(0, MAX_RULES)) {
    if (!r || typeof r.find !== 'string') continue;
    const find = r.find.slice(0, MAX_FIND);
    const replace = (typeof r.replace === 'string' ? r.replace : '').slice(0, MAX_REPLACE);
    if (find.length === 0) continue;
    result = result.split(find).join(replace);
  }
  return result;
}

/**
 * Render math using KaTeX. Handles $$...$$ (display) and $...$ (inline).
 * Practical parser — works for typical uses. For full robustness we can
 * later hook into markdown-it token stream.
 */
function renderMathInText(text) {
  if (!text || typeof text !== 'string') return text;

  // Replace display math $$...$$ first (non-greedy)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, content) => {
    try {
      return katex.renderToString(content, { displayMode: true, throwOnError: false });
    } catch (e) {
      console.error('KaTeX display render error:', e);
      return match;
    }
  });

  // Then inline math $...$ (avoid $$)
  text = text.replace(/(^|[^\$])\$([^\s][\s\S]*?[^\s])\$([^\$]|$)/g, (match, prefix, content, suffix) => {
    try {
      return prefix + katex.renderToString(content, { displayMode: false, throwOnError: false }) + suffix;
    } catch (e) {
      console.error('KaTeX inline render error:', e);
      return match;
    }
  });

  return text;
}

/**
 * POST /convert
 * body: { text: string, userRules?: [...] }
 * returns { success: true, result: "<sanitized html>" }
 */
app.post('/convert', async (req, res) => {
  try {
    let { text = '', userRules = [] } = req.body;
    if (typeof text !== 'string') text = String(text);

    // 1) apply user rules (literal replace)
    const processed = applyUserRules(text, userRules);

    // 2) render math to KaTeX HTML fragments
    const withMathHtmlFragments = renderMathInText(processed);

    // 3) convert Markdown -> HTML (math fragments are preserved)
    const html = md.render(withMathHtmlFragments);

    // 4) sanitize final HTML
    const sanitized = DOMPurify.sanitize(html);

    return res.json({ success: true, result: sanitized });
  } catch (err) {
    console.error('convert error', err);
    return res.status(500).json({ success: false, message: 'Server error during conversion' });
  }
});

/**
 * POST /save-user-rules
 * body: { rules: [...] }  (demo: saves in memory)
 */
app.post('/save-user-rules', (req, res) => {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules)) return res.status(400).json({ success: false, message: 'Invalid rules' });

    const normalized = rules.map(r => ({
      id: r.id || Date.now() + Math.floor(Math.random() * 1000),
      find: typeof r.find === 'string' ? r.find : '',
      replace: typeof r.replace === 'string' ? r.replace : ''
    })).slice(0, 500);

    savedUserRules = normalized;
    return res.json({ success: true, rules: savedUserRules });
  } catch (err) {
    console.error('save rules error', err);
    return res.status(500).json({ success: false, message: 'Server error while saving rules' });
  }
});

/**
 * GET /get-user-rules
 */
app.get('/get-user-rules', (req, res) => {
  try {
    return res.json({ success: true, rules: savedUserRules });
  } catch (err) {
    console.error('get rules error', err);
    return res.status(500).json({ success: false, message: 'Server error while fetching rules' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
