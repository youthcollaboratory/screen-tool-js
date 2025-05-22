import { useState, useEffect } from 'react';
import Papa from 'papaparse';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQv96fMnm7vecd2DfpPZ0h4jwK94rG-QNIjyH5fbqx7p5hddM9iJEgpK1gnAYOUZ55VrlqWxE9O7EKg/pub?gid=143046203&single=true&output=csv';

export default function Home() {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [flags, setFlags] = useState([]);
  const [csvData, setCsvData] = useState([]);

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

  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');

    // Use public CDN version of the PDF worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.269/pdf.worker.min.js`;

    const reader = new FileReader();
    reader.onload = async () => {
      const typedArray = new Uint8Array(reader.result);
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(' ');
        fullText += pageText + '\n\n';
      }

      setText(fullText);
      runScreening(fullText, csvData);
    };

    reader.readAsArrayBuffer(file);
  } catch (err) {
    setError('Failed to read PDF: ' + err.message);
    setScanning(false);
  }
};

  const runScreening = (inputText, termList) => {
    const results = [];

    termList.forEach(row => {
      const term = row['Term']?.trim();
      if (!term) return;

      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'gi');
      let match;
      while ((match = regex.exec(inputText)) !== null) {
        results.push({
          term: match[0],
          flagColor: row['Flag'] || '—',
          theme: row['Theme'] || '—',
          notes: row['Notes'] || '—',
          position: match.index
        });
      }
    });

    const sorted = results.sort((a, b) => a.position - b.position);
    setFlags(sorted);
    setScanning(false);
  };

  const getHighlightedText = () => {
    if (!flags.length) return text;

    let lastIndex = 0;
    let segments = [];

    flags.forEach((flag, i) => {
      segments.push({
        start: lastIndex,
        end: flag.position,
        text: text.slice(lastIndex, flag.position),
        highlighted: false,
      });

      let highlightColor = '#f97316';
      if (flag.flagColor === 'Yellow') highlightColor = '#facc15';
      if (flag.flagColor === 'Red') highlightColor = '#f97316';
      if (flag.flagColor === 'Blue') highlightColor = '#60a5fa';

      const matchedText = text.substr(flag.position, flag.term.length);

      segments.push({
        start: flag.position,
        end: flag.position + flag.term.length,
        text: `<a id="ref-${i + 1}" class="scroll-mt-24 inline-block"><mark class="animate-pulse-match" style="background-color: ${highlightColor};">${matchedText}</mark></a><a href="#flag-${i + 1}"><sup style="font-size: 0.7em; vertical-align: super; margin-left: 2px;">[${i + 1}]</sup></a>`
      });

      lastIndex = flag.position + flag.term.length;
    });

    segments.push({
      start: lastIndex,
      end: text.length,
      text: text.slice(lastIndex),
      highlighted: false,
    });

    const fullText = segments.map(seg => seg.text).join('');
    const paragraphs = fullText.split(/\n\s*\n/);

    return paragraphs
      .map(para => `<p style="margin-bottom: 1em; line-height: 1.7;">${para.trim()}</p>`)
      .join('');
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-2">Communication Screen Tool</h1>

      <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
        <h2 className="text-xl font-semibold mb-2">Scan From Webpage</h2>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter a URL to scrape and scan..." className="border border-gray-300 p-2 rounded w-full mb-3" />
        <button onClick={handleScrape} disabled={loading} className="bg-yc-blue text-white px-4 py-2 rounded hover:bg-yc-blue-dark">
          {loading ? 'Scraping...' : 'Scrape and Scan'}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
        <h2 className="text-xl font-semibold mb-2">Scan Pasted Text</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your text here..." className="border border-gray-300 p-2 rounded w-full h-40 mb-3" />
        <button onClick={() => { setUrl(''); setScanning(true); runScreening(text, csvData); }} disabled={loading || !text} className="bg-yc-green text-white px-4 py-2 rounded hover:bg-yc-green-dark">
          Scan Pasted Text
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
        <h2 className="text-xl font-semibold mb-2">Scan a PDF</h2>
        <input type="file" accept="application/pdf" onChange={(e) => handlePDFUpload(e.target.files[0])} className="mb-3" />
      </div>

      {error && <p className="text-red-600">Error: {error}</p>}
      {scanning && <p className="text-gray-600 italic">Scan in progress...</p>}

      {!scanning && flags.length > 0 && (
        <div className="my-6">
          <h2 className="font-semibold mb-2">Flagged Terms</h2>
          <table className="table-auto border-collapse w-full text-sm bg-white shadow-sm rounded">
            <thead>
              <tr>
                <th className="border px-2 py-1">#</th>
                <th className="border px-2 py-1">Term</th>
                <th className="border px-2 py-1">Flag</th>
                <th className="border px-2 py-1">Theme</th>
                <th className="border px-2 py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f, i) => {
                return (
                  <tr key={i} id={`flag-${i + 1}`} className="scroll-mt-24">
                    <td className="border px-2 py-1">
                      <a href={`#ref-${i + 1}`} className="text-blue-600 hover:underline">{i + 1}</a>
                    </td>
                    <td className="border px-2 py-1">{f.term}</td>
                    <td className="border px-2 py-1">{f.flagColor}</td>
                    <td className="border px-2 py-1">{f.theme}</td>
                    <td className="border px-2 py-1">{f.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!scanning && text && flags.length === 0 && (
        <div className="mt-6 bg-gray-50 p-4 border rounded">
          <h2 className="font-semibold mb-2">No flagged terms found.</h2>
        </div>
      )}

      {!scanning && text && flags.length > 0 && (
        <div className="mt-6 bg-gray-50 p-4 border rounded">
          <h2 className="font-semibold mb-2">Screened Content</h2>
          <div className="text-sm" style={{ lineHeight: '1.7' }} dangerouslySetInnerHTML={{ __html: getHighlightedText() }} />
        </div>
      )}
    </div>
  );
}
