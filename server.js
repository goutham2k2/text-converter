// server.js
const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const path = require("path");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const MarkdownIt = require("markdown-it");
const katex = require("katex");

const app = express();
app.use(helmet());
app.use(bodyParser.json({ limit: "5mb" }));

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

// DOMPurify setup
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// saved rules (memory)
let savedUserRules = [];

/* -------------------------------------------------------------
   Apply find/replace rules
------------------------------------------------------------- */
function applyUserRules(text, rules = []) {
  if (!Array.isArray(rules)) return text;
  let result = text;
  rules.forEach(r => {
    if (r.find && typeof r.find === "string") {
      result = result.split(r.find).join(r.replace || "");
    }
  });
  return result;
}

/* -------------------------------------------------------------
   WRAP rendered KaTeX output in TipTap compatible node
------------------------------------------------------------- */
function wrapMath(raw, rendered, inline = true) {
  const cls = inline ? "node-inlineMath" : "node-displayMath";

  return `
<span class="react-renderer ${cls}" contenteditable="false">
  <span data-node-view-wrapper="" style="white-space: normal;">
    <div aria-hidden="true" data-node-view-content=""
      style="white-space: pre-wrap; display:none;">${raw}</div>
    <span class="mjx-process">
      ${rendered}
    </span>
  </span>
</span>`;
}

/* -------------------------------------------------------------
   Convert $math$ & $$math$$ → KaTeX → TipTap-style HTML
------------------------------------------------------------- */
function renderMathInText(text) {
  if (!text || typeof text !== "string") return text;

  // Block math $$...$$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (m, raw) => {
    try {
      const rendered = katex.renderToString(raw, {
        displayMode: true,
        throwOnError: false,
      });
      return wrapMath(raw, rendered, false);
    } catch {
      return m;
    }
  });

  // Inline math $...$
  text = text.replace(/(^|[^\$])\$([^\$][\s\S]*?[^\$])\$([^\$]|$)/g,
    (m, pre, raw, suf) => {
      try {
        const rendered = katex.renderToString(raw, {
          displayMode: false,
          throwOnError: false,
        });
        return pre + wrapMath(raw, rendered, true) + suf;
      } catch {
        return m;
      }
    }
  );

  return text;
}

/* -------------------------------------------------------------
   POST /convert : MAIN processing
------------------------------------------------------------- */
app.post("/convert", async (req, res) => {
  try {
    let { text = "", userRules = [] } = req.body;
    if (typeof text !== "string") text = String(text);

    // 1) rules
    let processed = applyUserRules(text, userRules);

    // 2) math
    processed = renderMathInText(processed);

    // 3) markdown → HTML
    let html = md.render(processed);

    // 4) sanitize
    html = DOMPurify.sanitize(html);

    return res.json({ success: true, result: html });
  } catch (err) {
    console.error("convert error", err);
    return res.status(500).json({ success: false, message: "Conversion error" });
  }
});

/* -------------------------------------------------------------
   SAVE RULES
------------------------------------------------------------- */
app.post("/save-user-rules", (req, res) => {
  try {
    const { rules } = req.body;
    savedUserRules = Array.isArray(rules) ? rules : [];
    return res.json({ success: true, rules: savedUserRules });
  } catch {
    return res.status(500).json({ success: false });
  }
});

/* -------------------------------------------------------------
   GET RULES
------------------------------------------------------------- */
app.get("/get-user-rules", (req, res) => {
  return res.json({ success: true, rules: savedUserRules });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
