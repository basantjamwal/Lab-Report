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

        const { name, enroll } = req.body
        if (!name || !enroll || !name.trim() || !enroll.trim()) {
            return res.status(400).send('Name and enrollment number are required.');
        }

        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).send('No files uploaded.');
        }

        let combinedHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="min-h-screen bg-gray-100 p-8 font-sans">
        `;

        for (const [fileIndex, file] of files.entries()) {
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
                <div class="report mx-auto min-h-full max-w-4xl break-inside-avoid bg-white p-10 shadow-sm ${fileIndex > 0 ? 'break-before-page' : ''}">
                    <div class="mb-10 text-right text-xs text-gray-600">${name} (${enroll})</div>
                    <h1 class="mb-6 text-xl text-[#10346c]">
                        ${escapeHtml(question)}
                    </h1>
                    
                    <div class="mb-2 text-sm font-bold text-gray-900">Code:</div>
                    <pre class="mb-8 wrap-anywhere whitespace-pre-wrap bg-[#f8f9fb] p-6 font-mono text-xs leading-[1.7] text-[#0a106c]">${escapeHtml(displayContent)}</pre>
                    
                    <div class="mb-2 text-sm font-bold text-gray-900">Output:</div>
                    <div class="w-11/12 max-w-200 border border-gray-200">
                        <div class="flex items-end bg-[#f2f3f5] px-2 pt-2 text-[10px] uppercase tracking-[.05em] text-gray-400">
                            <span class="px-3 pb-2">Postman Console</span><span class="px-3 pb-2">Problems</span><span class="px-3 pb-2">Output</span><span class="border-b-2 border-blue-500 px-3 pb-2 font-bold text-gray-700">Terminal</span><span class="px-3 pb-2">Ports</span><span class="ml-auto px-0 pb-2 lowercase tracking-normal">powershell</span>
                        </div>
                        <div class="wrap-anywhere whitespace-pre-wrap bg-white p-4 font-mono text-xs leading-8 text-gray-800"><div><span class="mr-1 text-gray-400">○</span> PS C:\OOPS LAB&gt; .\program.exe</div><div class="pl-5">${escapeHtml(output)}</div><div><span class="mr-1 text-gray-400">○</span> PS C:\OOPS LAB&gt; <span>_</span></div></div>
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