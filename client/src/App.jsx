import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [error, setError] = useState('');

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) {
      setError('Please choose a C++ source file (.cpp).');
      return;
    }

    setSelectedFiles(acceptedFiles);
    setError('');
    setLoading(true);
    const formData = new FormData();
    
    // Append all dragged C++ files to the FormData object
    acceptedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      // Post to backend and expect a PDF blob in return
      const response = await axios.post('http://localhost:5001/api/generate', formData, {
        responseType: 'blob',
      });

      // Create a URL for the blob and trigger an automatic download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Lab-Report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Error generating PDF:", error);
      setError(error.response?.data instanceof Blob
        ? 'The server could not generate the report.'
        : 'The server is unavailable. Start the backend on port 5001 and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'text/x-c++src': ['.cpp'] } // Only accept C++ files
  });

  return (
    <main className="app-shell">
      <section className="report-paper" aria-label="C++ program document">
        <header className="report-header">
          <span className="eyebrow">OOPS LAB / PROGRAM DOCUMENT</span>
          <span className="student-name">Basant Singh Jamwal <strong>(2025BCSE085)</strong></span>
        </header>

        <div className="report-content">
          <p className="section-kicker">Experiment 01</p>
          <h1>Generate your C++ program report</h1>
          <p className="report-intro">Upload one or more source files and receive a formatted PDF with the code and execution output.</p>

          <div className="section-heading">
            <span className="section-number">01</span>
            <h2>Program source</h2>
          </div>

          <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'is-dragging' : ''} ${loading ? 'is-loading' : ''}`}>
            <input {...getInputProps()} />
            <div className="upload-mark">{loading ? '...' : '{ }'}</div>
            <div>
              <p className="upload-title">
                {loading ? 'Compiling and preparing your report' : isDragActive ? 'Release to add your files' : 'Drop C++ files here'}
              </p>
              <p className="upload-subtitle">{loading ? 'This can take a few seconds.' : 'or click to browse .cpp files'}</p>
            </div>
            <span className="upload-arrow" aria-hidden="true">-&gt;</span>
          </div>

          {selectedFiles.length > 0 && !loading && (
            <div className="file-list" aria-live="polite">
              <span className="file-count">{selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} ready</span>
              {selectedFiles.map((file) => <span className="file-chip" key={`${file.name}-${file.lastModified}`}>{file.name}</span>)}
            </div>
          )}

          {error && <p className="error-message" role="alert">{error}</p>}

          <div className="section-heading output-heading">
            <span className="section-number">02</span>
            <h2>Execution output</h2>
          </div>

          <div className="terminal-window" aria-label="Terminal output preview">
            <div className="terminal-tabs">
              <span>Postman Console</span><span>Problems</span><span>Output</span><span className="active-tab">Terminal</span><span>Ports</span>
              <span className="terminal-shell">powershell</span>
            </div>
            <div className="terminal-body">
              <p><span className="prompt-symbol">○</span> PS C:\OOPS LAB&gt; <span className="muted">upload your program to execute</span></p>
              <p className="terminal-result">Your compiled output will appear in the generated PDF.</p>
              <p><span className="prompt-symbol">○</span> PS C:\OOPS LAB&gt; <span className="cursor" /></p>
            </div>
          </div>
        </div>
        <footer className="report-footer"><span>LAB REPORT GENERATOR</span><span>2025 / 2026</span></footer>
      </section>
    </main>
  );
}

export default App;