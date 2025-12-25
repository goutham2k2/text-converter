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

const copyBtn = document.getElementById('copy-output');

// Use DOMPurify on frontend
const purifier = DOMPurify;

/* ---------- UI Controls ---------- */
function updateProcessButton() {
  const v = inputEl.value.trim();
  processBtn.disabled = v.length === 0;
  resetBtn.classList.toggle('hidden', v.length === 0);
}
inputEl.addEventListener('input', updateProcessButton);
updateProcessButton();

/* ---------- Tabs ---------- */
previewTabBtn.addEventListener('click', () => {
  previewTabBtn.classList.add('active');
  outputTabBtn.classList.remove('active');
  previewContent.classList.remove('hidden');
  outputContent.classList.add('hidden');
});
outputTabBtn.addEventListener('click', () => {
  previewTabBtn.classList.remove('active');
  outputTabBtn.classList.add('active');
  outputContent.classList.remove('hidden');
  previewContent.classList.add('hidden');
});

/* ---------- Submit to server ---------- */
processBtn.addEventListener('click', async () => {
  const text = inputEl.value || '';
  processBtn.disabled = true;
  const orig = processBtn.textContent;
  processBtn.textContent = 'Processing...';

  try {
    const resp = await fetch('/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, userRules })
    });

    const data = await resp.json();
    if (!data.success) throw new Error(data.message);

    const clean = purifier.sanitize(data.result);

    previewOutput.innerHTML = clean;
    rawOutput.innerHTML = clean;

    outputTabBtn.classList.remove('hidden');
    outputTabBtn.click();
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    processBtn.textContent = orig;
    processBtn.disabled = false;
  }
});

/* ---------- Reset ---------- */
resetBtn.addEventListener('click', () => {
  inputEl.value = '';
  previewOutput.innerHTML = 'Preview will appear here';
  rawOutput.innerHTML = '';
  outputTabBtn.classList.add('hidden');
  previewTabBtn.click();
  updateProcessButton();
});

/* ---------- Copy Output ---------- */
copyBtn.addEventListener('click', async () => {
  try {
    const html = rawOutput.innerHTML;
    const blobHTML = new Blob([html], { type: 'text/html' });
    await navigator.clipboard.write([ new ClipboardItem({ "text/html": blobHTML }) ]);

    copyBtn.textContent = "Copied!";
    setTimeout(() => copyBtn.textContent = "Copy", 1200);
  } catch (err) {
    alert("Copy failed: " + err);
  }
});

/* ---------- Load saved rules ---------- */
document.addEventListener('DOMContentLoaded', () => {
  updateProcessButton();
});
