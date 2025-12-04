// public/app.js
let userRules = [];

const inputEl = document.getElementById('latex-input');
const processBtn = document.getElementById('process-button');
const resetBtn = document.getElementById('reset-button');
const previewOutput = document.getElementById('latex-output');
const rawOutput = document.getElementById('latex-raw-output');
const previewTabBtn = document.getElementById('preview-tab');
const outputTabBtn = document.getElementById('output-tab');
const previewContent = document.getElementById('preview-content');
const outputContent = document.getElementById('output-content');

const rulesModal = document.getElementById('rules-modal');
const openRulesBtn = document.getElementById('open-rules');
const closeRulesBtn = document.getElementById('close-rules');
const addRuleBtn = document.getElementById('add-rule');
const findInput = document.getElementById('findInput');
const replaceInput = document.getElementById('replaceInput');
const rulesList = document.getElementById('rules-list');
const copyBtn = document.getElementById('copy-output');

function updateProcessButton() {
  const v = inputEl.value.trim();
  processBtn.disabled = v.length === 0;
  resetBtn.classList.toggle('hidden', v.length === 0);
}
inputEl.addEventListener('input', updateProcessButton);
updateProcessButton();

previewTabBtn.addEventListener('click', () => {
  previewTabBtn.classList.add('active');
  if (outputTabBtn) outputTabBtn.classList.remove('active');
  previewContent.classList.remove('hidden');
  outputContent.classList.add('hidden');
});
outputTabBtn.addEventListener('click', () => {
  outputTabBtn.classList.add('active');
  previewTabBtn.classList.remove('active');
  outputContent.classList.remove('hidden');
  previewContent.classList.add('hidden');
});

openRulesBtn.addEventListener('click', () => {
  rulesModal.classList.remove('hidden');
  loadUserRulesFromServer();
});
closeRulesBtn.addEventListener('click', () => rulesModal.classList.add('hidden'));

addRuleBtn.addEventListener('click', () => {
  const find = findInput.value.trim();
  const replace = replaceInput.value;
  if (!find) return alert('Enter text to find');
  const id = Date.now();
  userRules.push({ id, find, replace });
  findInput.value = '';
  replaceInput.value = '';
  renderRulesList();
  saveUserRulesToServer();
});

function renderRulesList() {
  rulesList.innerHTML = '';
  if (userRules.length === 0) {
    const el = document.createElement('div');
    el.textContent = 'No saved rules';
    el.className = 'text-gray-500 italic';
    rulesList.appendChild(el);
    return;
  }
  userRules.forEach((r, idx) => {
    const row = document.createElement('div');
    row.className = 'flex justify-between items-center border p-2 rounded';
    row.innerHTML = `<div><strong>${escapeHtml(r.find)}</strong> → ${escapeHtml(r.replace)}</div>`;
    const delBtn = document.createElement('button');
    delBtn.className = 'px-2 py-1 bg-red-50 border rounded';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      userRules.splice(idx, 1);
      renderRulesList();
      saveUserRulesToServer();
    });
    row.appendChild(delBtn);
    rulesList.appendChild(row);
  });
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function saveUserRulesToServer() {
  try {
    await fetch('/save-user-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: userRules })
    });
  } catch (err) {
    console.error('save user rules failed', err);
  }
}

async function loadUserRulesFromServer() {
  try {
    const r = await fetch('/get-user-rules');
    if (!r.ok) throw new Error('no rules from server');
    const j = await r.json();
    if (j && j.success && Array.isArray(j.rules)) {
      userRules = j.rules;
      renderRulesList();
      return;
    }
  } catch (err) {
    const saved = localStorage.getItem('userLatexRules');
    userRules = saved ? JSON.parse(saved) : [];
    renderRulesList();
  }
}

processBtn.addEventListener('click', async () => {
  const text = inputEl.value || '';
  processBtn.disabled = true;
  const origText = processBtn.textContent;
  processBtn.textContent = 'Processing...';
  try {
    const resp = await fetch('/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, userRules })
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.message || 'Conversion failed');
    const clean = DOMPurify.sanitize(data.result);
    previewOutput.innerHTML = clean;
    rawOutput.innerHTML = clean;
    outputTabBtn.classList.remove('hidden');
    outputTabBtn.click();
  } catch (err) {
    alert('Error: ' + (err.message || err));
    console.error(err);
  } finally {
    processBtn.textContent = origText;
    processBtn.disabled = false;
  }
});

resetBtn.addEventListener('click', () => {
  inputEl.value = '';
  previewOutput.innerHTML = 'Preview will appear here';
  rawOutput.innerHTML = '';
  outputTabBtn.classList.add('hidden');
  previewTabBtn.click();
  updateProcessButton();
});

copyBtn.addEventListener('click', async () => {
  try {
    const html = rawOutput.innerHTML;
    const text = rawOutput.textContent;
    if (navigator.clipboard && window.ClipboardItem) {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([text], { type: 'text/plain' });
      await navigator.clipboard.write([ new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText }) ]);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
      return;
    }
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  } catch (err) {
    alert('Copy failed: ' + err);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadUserRulesFromServer();
  updateProcessButton();
});
