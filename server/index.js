import express from 'express';
import cors from 'cors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { upload } from './multer.js';

const app = express();
const execFileAsync = promisify(execFile);
const compiler = process.platform === 'win32' ? 'g++.exe' : 'g++';
const port = Number(process.env.PORT) || 5001;

app.use(cors());
app.use(express.json());

function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function removeCppComments(source) {
    let result = '';
    let index = 0;
    let mode = 'code';

    while (index < source.length) {
        const current = source[index];
        const next = source[index + 1];

        if (mode === 'code' && current === '/' && next === '/') {
            mode = 'line-comment';
            result += '  ';
            index += 2;
            continue;
        }

        if (mode === 'code' && current === '/' && next === '*') {
            mode = 'block-comment';
            result += '  ';
            index += 2;
            continue;
        }

        if (mode === 'line-comment') {
            if (current === '\n') {
                mode = 'code';
                result += current;
            } else {
                result += ' ';
            }
            index += 1;
            continue;
        }

        if (mode === 'block-comment') {
            if (current === '*' && next === '/') {
                mode = 'code';
                result += '  ';
                index += 2;
            } else {
                result += current === '\n' ? '\n' : ' ';
                index += 1;
            }
            continue;
        }

        if (mode === 'code' && (current === '"' || current === "'")) {
            mode = current === '"' ? 'string' : 'character';
        } else if (mode === 'string' && current === '"') {
            mode = 'code';
        } else if (mode === 'character' && current === "'") {
            mode = 'code';
        }

        result += current;
        if ((mode === 'string' || mode === 'character') && current === '\\' && next) {
            result += next;
            index += 2;
        } else {
            index += 1;
        }
    }

    return result.replace(/^\s*\n/gm, '').trim();
}

async function executeCpp(fileContent) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lab-report-'));
    const sourcePath = path.join(tempDir, 'main.cpp');
    const executablePath = path.join(tempDir, process.platform === 'win32' ? 'main.exe' : 'main');

    try {
        await writeFile(sourcePath, fileContent, 'utf8');
        await execFileAsync(compiler, [sourcePath, '-std=c++17', '-O0', '-o', executablePath], {
            timeout: 15000,
            windowsHide: true,
            maxBuffer: 1024 * 1024,
        });

        const result = await execFileAsync(executablePath, [], {
            timeout: 5000,
            windowsHide: true,
            maxBuffer: 1024 * 1024,
        });

        return result.stdout || result.stderr || 'No output';
    } catch (error) {
        const details = [error.stdout, error.stderr, error.message]
            .filter(Boolean)
            .join('\n')
            .trim();
        return details || 'The program could not be compiled or executed.';
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}

app.post('/api/generate', upload.array('files'), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).send('No files uploaded.');
        }

        let combinedHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { background: #f3f4f6; min-height: 100vh; padding: 32px; font-family: Arial, sans-serif; }
                    .report { max-width: 896px; min-height: 100%; margin: 0 auto; padding: 40px; background: white; box-shadow: 0 1px 3px #0000001a; break-inside: avoid; page-break-inside: avoid; }
                    .report + .report { page-break-before: always; break-before: page; }
                    .student { color: #4b5563; font-size: 12px; margin-bottom: 40px; text-align: right; }
                    h1 { color: #10346c; font-size: 20px; margin: 0 0 24px; }
                    .label { color: #111827; font-size: 14px; font-weight: bold; margin-bottom: 8px; }
                    .code { background: #f8f9fb; color: #0a106c; padding: 24px; margin: 0 0 32px; white-space: pre-wrap; overflow-wrap: anywhere; font-family: Consolas, monospace; font-size: 12px; line-height: 1.7; }
                    .terminal { width: 91.666667%; max-width: 800px; border: 1px solid #e5e7eb; }
                    .tabs { display: flex; align-items: flex-end; padding: 8px 8px 0; background: #f2f3f5; color: #9ca3af; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
                    .tabs span { padding: 0 12px 8px; }
                    .tabs .active { border-bottom: 2px solid #3b82f6; color: #374151; font-weight: bold; }
                    .shell { margin-left: auto; text-transform: lowercase; letter-spacing: 0; }
                    .output { padding: 16px; background: white; color: #1f2937; font-family: Consolas, monospace; font-size: 12px; line-height: 2; white-space: pre-wrap; overflow-wrap: anywhere; }
                    .prompt { color: #9ca3af; margin-right: 4px; }
                    .result { padding-left: 20px; }
                </style>
            </head>
            <body>
        `;

        for (const file of files) {
            const fileContent = file.buffer.toString('utf-8');
            
            // Read the first question comment, supporting both // and /* ... */ styles.
            const lineQuestionMatch = fileContent.match(/^\s*\/\/\s?(.*)$/m);
            const blockQuestionMatch = fileContent.match(/\/\*([\s\S]*?)\*\//);
            const question = lineQuestionMatch?.[1].trim()
                || blockQuestionMatch?.[1].trim()
                || "No question found";
            const displayContent = removeCppComments(fileContent);
            
            const output = await executeCpp(fileContent);

            // Append this file's result to the HTML template
            combinedHtml += `
                <div class="report">
                    <div class="student">Basant Singh Jamwal (2025BCSE085)</div>
                    <h1>
                        ${escapeHtml(question)}
                    </h1>
                    
                    <div class="label">Code:</div>
                    <pre class="code">${escapeHtml(displayContent)}</pre>
                    
                    <div class="label">Output:</div>
                    <div class="terminal">
                        <div class="tabs">
                            <span>Postman Console</span><span>Problems</span><span>Output</span><span class="active">Terminal</span><span>Ports</span><span class="shell">powershell</span>
                        </div>
                        <div class="output"><div><span class="prompt">○</span> PS C:\OOPS LAB&gt; .\program.exe</div><div class="result">${escapeHtml(output)}</div><div><span class="prompt">○</span> PS C:\OOPS LAB&gt; <span>_</span></div></div>
                    </div>
                </div>
            `;
        }

        combinedHtml += `</body></html>`;

        // Generate PDF with Puppeteer
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(combinedHtml, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({ 
            format: 'A4',
            printBackground: true 
        });

        await browser.close();

        // Send PDF back to the client
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="lab-report.pdf"',
        });
        res.send(pdfBuffer);

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating report');
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));