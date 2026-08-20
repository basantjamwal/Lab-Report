import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

function App() {
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [error, setError] = useState('');
  const [name, setName] = useState("")
  const [enroll, setEnroll] = useState("")

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) {
      setError('Please choose a C++ source file (.cpp).');
      return;
    }

    if (!name.trim() || !enroll.trim()) {
      setError('Please enter your name and enrollment number first.');
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
    formData.append('name', name.trim());
    formData.append('enroll', enroll.trim());

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
  }, [enroll, name]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/x-c++src': ['.cpp'] } // Only accept C++ files
  });

  return (
    <main className="min-h-screen bg-[#e9ecef] px-6 py-12 max-[640px]:p-0">
      <section className="mx-auto min-h-[calc(100vh-96px)] max-w-[960px] overflow-hidden bg-white text-[#253044] shadow-[0_18px_50px_rgba(37,48,68,0.12)] max-[640px]:min-h-screen" aria-label="C++ program document">
        <header className="flex justify-between gap-6 border-b border-[#e6e9ed] px-16 py-7 text-[11px] uppercase tracking-[0.1em] text-[#687284] max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-2.5 max-[640px]:px-5 max-[640px]:py-[22px]">
          <span className="eyebrow">LAB REPORT / PROGRAM DOCUMENT</span>
          <span className="text-right normal-case tracking-[0.02em] text-[#526079] max-[640px]:text-left"> <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="border border-[#c8d7e7] px-2 py-1 text-xs text-[#243a58] focus:border-[#2c70b7] focus:outline-none"
          />
            <input
              type="text"
              value={enroll}
              onChange={(e) => setEnroll(e.target.value)}
              placeholder="Enrollment No."
              className="border border-[#c8d7e7] px-2 py-1 text-xs text-[#163f76] font-bold focus:border-[#2c70b7] focus:outline-none"
            /></span>
        </header>

        <div className="mx-auto max-w-[832px] px-8 pb-20 pt-16 max-[640px]:px-5 max-[640px]:pb-14 max-[640px]:pt-[42px]">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#6f86a5]">Experiment 01</p>
          <h1 className="m-0 max-w-[650px] font-serif text-[clamp(32px,5vw,54px)] font-medium leading-[1.08] text-[#163f76]">Generate your C++ program report</h1>
          <p className="mb-[58px] mt-[18px] max-w-[590px] text-base leading-[1.7] text-[#697487] max-[640px]:mb-[42px]">Upload one or more source files and receive a formatted PDF with the code and execution output.</p>

          <div className="mb-4 flex items-center gap-3.5">
            <span className="font-mono text-xs font-bold text-[#2c70b7]">01</span>
            <h2 className="m-0 font-serif text-[23px] font-medium text-[#26364d]">Program source</h2>
          </div>

          <div {...getRootProps()} className={`flex min-h-[116px] cursor-pointer items-center gap-5 border border-dashed border-[#9db2cb] bg-[#f8fafc] px-7 py-6 transition duration-150 hover:-translate-y-0.5 hover:border-[#2c70b7] hover:bg-[#f0f6fc] max-[640px]:p-5 ${isDragActive ? '-translate-y-0.5 border-[#2c70b7] bg-[#f0f6fc]' : ''} ${loading ? 'cursor-wait opacity-70' : ''}`}>
            <input {...getInputProps()} />
            <div className="grid h-[54px] w-[54px] flex-none place-items-center border border-[#c8d7e7] font-mono text-[17px] text-[#2c70b7] max-[640px]:h-[42px] max-[640px]:w-[42px]">{loading ? '...' : '{ }'}</div>
            <div>
              <p className="mb-[5px] text-base font-bold text-[#243a58]">
                {loading ? 'Compiling and preparing your report' : isDragActive ? 'Release to add your files' : 'Drop C++ files here'}
              </p>
              <p className="text-[13px] text-[#7a8799]">{loading ? 'This can take a few seconds.' : 'or click to browse .cpp files'}</p>
            </div>
            <span className="ml-auto font-mono text-[22px] text-[#2c70b7] max-[640px]:hidden" aria-hidden="true">-&gt;</span>
          </div>

          {selectedFiles.length > 0 && !loading && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2" aria-live="polite">
              <span className="text-xs font-bold text-[#526079]">{selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} ready</span>
              {selectedFiles.map((file) => <span className="border border-[#dbe3ec] px-[9px] py-[5px] font-mono text-[11px] text-[#687284]" key={`${file.name}-${file.lastModified}`}>{file.name}</span>)}
            </div>
          )}

          {error && <p className="mt-3.5 text-[13px] text-[#b34242]" role="alert">{error}</p>}

          <div className="mb-4 mt-14 flex items-center gap-3.5">
            <span className="font-mono text-xs font-bold text-[#2c70b7]">02</span>
            <h2 className="m-0 font-serif text-[23px] font-medium text-[#26364d]">Execution output</h2>
          </div>

          <div className="border border-[#dfe4e9]" aria-label="Terminal output preview">
            <div className="flex min-h-9 items-end gap-1 overflow-x-auto whitespace-nowrap bg-[#f2f3f5] px-2.5 text-[10px] uppercase tracking-[0.07em] text-[#98a1ad] max-[640px]:gap-0">
              <span className="px-[9px] pb-2 pt-2.5 max-[640px]:px-1.5">Postman Console</span><span className="px-[9px] pb-2 pt-2.5 max-[640px]:px-1.5">Problems</span><span className="px-[9px] pb-2 pt-2.5 max-[640px]:px-1.5">Output</span><span className="border-b-2 border-[#3478c0] px-[9px] pb-2 pt-2.5 font-bold text-[#45566e] max-[640px]:px-1.5">Terminal</span><span className="px-[9px] pb-2 pt-2.5 max-[640px]:px-1.5">Ports</span>
              <span className="ml-auto lowercase tracking-normal text-[#7a8799] max-[640px]:hidden">powershell</span>
            </div>
            <div className="min-h-[146px] overflow-x-auto bg-white p-5 font-mono text-xs leading-8 text-[#38475c]">
              <p className="whitespace-nowrap"><span className="mr-1.5 text-[#a1aab5]">○</span> PS C:\OOPS LAB&gt; <span className="text-[#8a95a3]">upload your program to execute</span></p>
              <p className="whitespace-nowrap pl-5 text-[#8a95a3]">Your compiled output will appear in the generated PDF.</p>
              <p className="whitespace-nowrap"><span className="mr-1.5 text-[#a1aab5]">○</span> PS C:\OOPS LAB&gt; <span className="ml-[3px] inline-block h-3.5 w-[7px] translate-y-0.5 animate-pulse bg-[#35455a]" /></p>
            </div>
          </div>
        </div>
        <footer className="flex justify-between gap-6 border-t border-[#e6e9ed] px-16 py-7 text-[11px] uppercase tracking-[0.1em] text-[#687284] max-[640px]:px-5 max-[640px]:py-[22px]"><span>LAB REPORT GENERATOR</span><span>2025 / 2026</span></footer>
      </section>
    </main>
  );
}

export default App;