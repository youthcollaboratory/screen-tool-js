import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker to load from CDN based on the current library version
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRC5PpzHyHlVBAObHQyamR4Kizg8gl6SRCBjtLA7zWSTPwXRs1XauOJk_oxPaR6a2lJ1opGhK9nXf8I/pub?gid=0&single=true&output=csv';

export default function Home() {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [flags, setFlags] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [scanComplete, setScanComplete] = useState(false);

  useEffect(() => {
    const fetchTermsFromSheet = async () => {
      try {
        const res = await fetch(SHEET_CSV_URL);
        const text = await res.text();
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => setCsvData(results.data),
          error: (err) => setError('Failed to parse dictionary: ' + err.message),
        });
      } catch (err) {
        setError('Failed to load dictionary from Google Sheets.');
      }
    };
    fetchTermsFromSheet();
  }, []);

  useEffect(() => {
    const handleHashJump = () => {
      const id = window.location.hash?.substring(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (el) {
        const mark = el.querySelector('mark');
        if (mark) {
          mark.classList.remove('animate-pulse-match');
          void mark.offsetWidth;
          mark.classList.add('animate-pulse-match');
        }
      }
    };

    window.addEventListener('hashchange', handleHashJump);
    return () => window.removeEventListener('hashchange', handleHashJump);
  }, []);

  const handleScrape = async () => {
    setText('');
    setLoading(true);
    setScanning(true);
    setError('');
    setFlags([]);
    setScanComplete(false);
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (res.ok) {
        setText(data.text);
        runScreening(data.text, csvData);
      } else {
        setError(data.error || 'Unknown error');
        setScanning(false);
      }
    } catch (e) {
      setError(e.message);
      setScanning(false);
    }
    setLoading(false);
  };

  const handlePDFUpload = async (file) => {
    setUrl('');
    setText('');
    setFlags([]);
    setError('');
    setScanning(true);

    console.log('📥 PDF file received:', file?.name || 'Unnamed file');

    try {
      if (!file || !(file instanceof Blob)) {
        throw new Error('No valid PDF file selected.');
      }

      console.log('✅ Valid PDF file confirmed');

      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const typedArray = new Uint8Array(reader.result);

          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          console.log('📄 Total PDF pages:', pdf.numPages);

          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item) => item.str).join(' ');
            fullText += pageText + '\n\n';
          }

          console.log('📄 Extracted PDF text (first 300 chars):', fullText.slice(0, 300));
          setText(fullText);

          console.log('📚 Dictionary loaded:', csvData?.length || 0, 'terms');
          console.log('🕵️ Running screening...');

          const matches = runScreening(fullText, csvData);
          console.log('✅ Matches found:', matches.length);
          setFlags(matches);

        } catch (innerErr) {
          console.error('❌ PDF parsing error:', innerErr.message || innerErr);
          setError('Error parsing PDF: ' + innerErr.message);
        } finally {
          setScanning(false);
        }
      };

      reader.readAsArrayBuffer(file);

    } catch (outerErr) {
      console.error('❌ File load error:', outerErr.message || outerErr);
      setError('Failed to read PDF: ' + outerErr.message);
      setScanning(false);
    }
  };

    const runScreening = (inputText, termList) => {
    const allMatches = [];

    termList.forEach(row => {
      const term = row['Term']?.trim();
      if (!term) return;

      const isPhrase = term.includes(' ');
      let regex;

      if (isPhrase) {
        // Allow for irregular spacing in multi-word phrases
        const pattern = term.trim().split(/\s+/).map(w =>
          w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        ).join('\\s+');
        regex = new RegExp(pattern, 'gi');
      } else {
        const matchMode = (row['MatchMode'] || 'loose').toLowerCase();
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        if (matchMode === 'strict') {
          regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        } else if (matchMode === 'mixed') {
          regex = new RegExp(`\\b${escaped}[-\\w]*`, 'gi');
        } else {
          regex = new RegExp(escaped, 'gi');
        }
      }

      let match;
      while ((match = regex.exec(inputText)) !== null) {
        let foundInWord, matchStart, matchEnd;

        if (isPhrase) {
          foundInWord = match[0];
          matchStart = match.index;
          matchEnd = matchStart + foundInWord.length;
        } else {
          const left = inputText.slice(0, match.index).match(/\b\w+$/)?.[0] || '';
          const right = inputText.slice(match.index).match(/^\w+/)?.[0] || '';
          foundInWord = left + right;

          matchStart = match.index;
          matchEnd = matchStart + term.length;
        }

        allMatches.push({
          displayTerm: term,
          term,
          foundIn: foundInWord,
          flagColor: row['Flag'] || '—',
          theme: row['Theme'] || '—',
          notes: row['Notes'] || '—',
          start: matchStart,
          end: matchEnd
        });
      }
    });

    allMatches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

    const nonOverlapping = [];
    let lastEnd = -1;

    for (const match of allMatches) {
      if (match.start >= lastEnd) {
        nonOverlapping.push(match);
        lastEnd = match.end;
      }
    }

    setFlags(nonOverlapping);
    setScanning(false);
    setScanComplete(true);
    return nonOverlapping;
  };

  const getHighlightedText = () => {
    if (!flags.length) return text;

    let result = '';
    let lastIndex = 0;

    flags.forEach((flag, i) => {
      const { start, end, displayTerm, flagColor } = flag;

      // Add any unmarked text before this word
      result += text.slice(lastIndex, start);

      const fullWord = text.slice(start, end);
      const matchIndex = fullWord.toLowerCase().indexOf(displayTerm.toLowerCase());

      if (matchIndex === -1) {
        // fallback if not found
        result += fullWord;
      } else {
        const before = fullWord.slice(0, matchIndex);
        const after = fullWord.slice(matchIndex + displayTerm.length);

        const highlightColor =
          flagColor === 'Yellow' ? '#facc15' :
          flagColor === 'Red' ? '#f97316' :
          flagColor === 'Blue' ? '#60a5fa' :
          '#f97316';

        result += `<a id="ref-${i + 1}" class="scroll-mt-24 inline-block">`;
        result += `${before}<mark class="animate-pulse-match" style="background-color: ${highlightColor};">${displayTerm}</mark>${after}`;
        result += `</a>`;
        result += `<a href="#flag-${i + 1}"><sup style="font-size: 0.7em; vertical-align: super; margin-left: 2px;">[${i + 1}]</sup></a>`;
      }

      lastIndex = end;
    });

    result += text.slice(lastIndex);

    const paragraphs = result.split(/\n\s*\n/);
    return paragraphs
      .map(para => `<p style="margin-bottom: 1em; line-height: 1.7;">${para.trim()}</p>`)
      .join('');
  };

  const exportFlagsToCSV = () => {
    if (!flags.length) return;

    const headers = ['Term', 'Found In', 'Flag', 'Theme', 'Notes'];
    const rows = flags.map(flag => [
      `"${flag.term}"`,
      `"${flag.foundIn}"`,
      `"${flag.flagColor}"`,
      `"${flag.theme}"`,
      `"${flag.notes.replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'flagged_terms.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <header className="w-full bg-gray-100 border-b border-gray-200 py-4 mb-6">
          <div className="max-w-3xl mx-auto flex flex-col md:flex-row justify-between items-center px-6 space-y-2 md:space-y-0">
            <h1 className="text-2xl font-bold text-gray-800">Communication Screen Tool</h1>
            <nav className="flex space-x-6 text-sm text-gray-700">
              <a href="https://docs.google.com/document/d/1r7X60wa1zd-nRTSRtoEermYby_NUn3yOaIw3beeRbGU/edit?usp=sharing" target="_blank"className="hover:underline">Instructions</a>
              <a href="https://docs.google.com/spreadsheets/d/1CCUXNvrnlzQ6pYmEfZxRGJF-t9O7RnC_oZD2dxb_dMk/edit?usp=sharing" target="_blank" className="hover:underline">Dictionary</a>
              <a href="https://forms.gle/bBPTaj5py6iQLerTA" target="_blank" className="hover:underline">Suggestions</a>
            </nav>
          </div>
        </header>
    
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
        <h2 className="text-xl font-semibold mb-2">Scan From Webpage</h2>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter a URL to scrape and scan..."
          className="border border-gray-300 p-2 rounded w-full mb-3"
        />
        <button
          onClick={handleScrape}
          disabled={loading}
          className="bg-yc-blue text-white px-4 py-2 rounded hover:bg-yc-blue-dark"
        >
          {loading ? 'Scraping...' : 'Scrape and Scan'}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
        <h2 className="text-xl font-semibold mb-2">Scan Pasted Text</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your text here..."
          className="border border-gray-300 p-2 rounded w-full h-40 mb-3"
        />
        <button
          onClick={() => {
            setUrl('');
            setScanning(true);
            setScanComplete(false);
            runScreening(text, csvData);
          }}
          disabled={loading || !text}
          className="bg-yc-green text-white px-4 py-2 rounded hover:bg-yc-green-dark"
        >
          Scan Pasted Text
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
        <h2 className="text-xl font-semibold mb-2">Scan a PDF</h2>
        <input
          type="file"
          accept="application/pdf"
          id="pdf-upload"
          className="hidden"
          onChange={(e) => handlePDFUpload(e.target.files[0])}
        />
        <button
          onClick={() => document.getElementById('pdf-upload').click()}
          className="bg-yc-blue text-white px-4 py-2 rounded hover:bg-yc-blue-dark"
        >
          Upload PDF
        </button>
      </div>

      {error && <p className="text-red-600">Error: {error}</p>}
      {scanning && <p className="text-gray-600 italic">Scan in progress...</p>}

      {!scanning && flags.length > 0 && (
        <div className="my-6">
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            Flagged Terms
            {flags.length > 0 && (
              <button
                onClick={exportFlagsToCSV}
                className="text-blue-600 hover:underline text-sm"
              >
                Download as CSV
              </button>
            )}
          </h2>
          <table className="table-auto border-collapse w-full text-sm bg-white shadow-sm rounded">
            <thead>
              <tr>
                <th className="border px-2 py-1">#</th>
                <th className="border px-2 py-1">Term</th>
                <th className="border px-2 py-1">Found In</th>
                <th className="border px-2 py-1">Flag</th>
                <th className="border px-2 py-1">Theme</th>
                <th className="border px-2 py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f, i) => (
                <tr key={i} id={`flag-${i + 1}`} className="scroll-mt-24">
                  <td className="border px-2 py-1">
                    <a href={`#ref-${i + 1}`} className="text-blue-600 hover:underline">
                      {i + 1}
                    </a>
                  </td>
                  <td className="border px-2 py-1">{f.term}</td>
                  <td className="border px-2 py-1">{f.foundIn}</td>
                  <td className="border px-2 py-1 text-center">
                  {f.flagColor === 'Red' && 'Red'}
                  {f.flagColor === 'Yellow' && 'Yellow'}
                  {f.flagColor === 'Blue' && 'Blue'}
                  {!['Red', 'Yellow', 'Blue'].includes(f.flagColor) && f.flagColor}
                  </td>
                  <td className="border px-2 py-1">{f.theme}</td>
                  <td className="border px-2 py-1">{f.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!scanning && scanComplete && flags.length === 0 && (
        <div className="mt-6 bg-gray-50 p-4 border rounded">
          <h2 className="font-semibold mb-2">No flagged terms found.</h2>
        </div>
      )}

      {!scanning && text && flags.length > 0 && (
        <div className="mt-6 bg-gray-50 p-4 border rounded">
          <h2 className="font-semibold mb-2">Screened Content</h2>
          <div
            className="text-sm"
            style={{ lineHeight: '1.7' }}
            dangerouslySetInnerHTML={{ __html: getHighlightedText() }}
          />
        </div>
      )}
    </div>
    </>
  );
}
