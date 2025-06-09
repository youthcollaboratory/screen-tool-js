import { useState, useEffect } from 'react';
import Papa from 'papaparse';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQv96fMnm7vecd2DfpPZ0h4jwK94rG-QNIjyH5fbqx7p5hddM9iJEgpK1gnAYOUZ55VrlqWxE9O7EKg/pub?gid=143046203&single=true&output=csv';

export default function Home() {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
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

  const runScreening = (inputText, termList) => {
    const allMatches = [];

    termList.forEach(row => {
      const term = row['Term']?.trim();
      if (!term) return;

      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');

      let match;
      while ((match = regex.exec(inputText)) !== null) {
        const left = inputText.slice(0, match.index).match(/\b\w+$/)?.[0] || '';
        const right = inputText.slice(match.index).match(/^\w+/)?.[0] || '';
        const fullWord = left + right;
        const matchType = (match[0].length === fullWord.length) ? 'Full' : 'Partial';

        allMatches.push({
          term: term,
          start: match.index,
          end: match.index + match[0].length,
          flagColor: row['Flag'] || '—',
          theme: row['Theme'] || '—',
          notes: row['Notes'] || '—',
          matchType
        });
      }
    });

    allMatches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return b.end - b.start - (a.end - a.start);
    });

    const nonOverlapping = [];
    let lastEnd = -1;
    for (const match of allMatches) {
      if (match.start >= lastEnd) {
        nonOverlapping.push(match);
        lastEnd = match.end;
      }
    }

    const sorted = nonOverlapping.map(({ end, ...rest }) => rest);
    setFlags(sorted);
    setScanning(false);
    setScanComplete(true);
  };

  const getHighlightedText = () => {
    if (!flags.length) return text;
    let segments = [];
    let lastIndex = 0;

    flags.forEach((flag, i) => {
      const left = text.slice(0, flag.start).match(/\b\w+$/)?.[0] || '';
      const right = text.slice(flag.start).match(/^\w+/)?.[0] || '';
      const fullWord = left + right;
      const wordStart = flag.start - left.length;
      const wordEnd = wordStart + fullWord.length;

      if (wordStart > lastIndex) {
        segments.push({ text: text.slice(lastIndex, wordStart), highlighted: false });
      }

      const beforeMatch = text.slice(wordStart, flag.start);
      const match = text.slice(flag.start, flag.start + flag.term.length);
      const afterMatch = text.slice(flag.start + flag.term.length, wordEnd);

      let highlightColor = '#f97316';
      if (flag.flagColor === 'Yellow') highlightColor = '#facc15';
      if (flag.flagColor === 'Red') highlightColor = '#f97316';
      if (flag.flagColor === 'Blue') highlightColor = '#60a5fa';

      const annotated = `
        ${beforeMatch}<mark class="animate-pulse-match" style="background-color: ${highlightColor};">${match}</mark>${afterMatch}
        <a href="#flag-${i + 1}"><sup style="font-size: 0.7em; vertical-align: super; margin-left: 2px;">[${i + 1}]</sup></a>
      `;

      segments.push({ text: annotated, highlighted: true });
      lastIndex = wordEnd;
    });

    if (lastIndex < text.length) {
      segments.push({ text: text.slice(lastIndex), highlighted: false });
    }

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
        <button onClick={async () => {
          setText('');
          setLoading(true);
          setScanning(true);
          setScanComplete(false);
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
        }} disabled={loading} className="bg-yc-blue text-white px-4 py-2 rounded hover:bg-yc-blue-dark">
          {loading ? 'Scraping...' : 'Scrape and Scan'}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
        <h2 className="text-xl font-semibold mb-2">Scan Pasted Text</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your text here..." className="border border-gray-300 p-2 rounded w-full h-40 mb-3" />
        <button onClick={() => {
          setUrl('');
          setScanning(true);
          setScanComplete(false);
          runScreening(text, csvData);
        }} disabled={loading || !text} className="bg-yc-green text-white px-4 py-2 rounded hover:bg-yc-green-dark">
          Scan Pasted Text
        </button>
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
                <th className="border px-2 py-1">Match Type</th>
                <th className="border px-2 py-1">Flag</th>
                <th className="border px-2 py-1">Theme</th>
                <th className="border px-2 py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f, i) => (
                <tr key={i} id={`flag-${i + 1}`} className="scroll-mt-24">
                  <td className="border px-2 py-1">
                    <a href={`#ref-${i + 1}`} className="text-blue-600 hover:underline">{i + 1}</a>
                  </td>
                  <td className="border px-2 py-1">{f.term}</td>
                  <td className="border px-2 py-1">{f.matchType}</td>
                  <td className="border px-2 py-1">{f.flagColor}</td>
                  <td className="border px-2 py-1">{f.theme}</td>
                  <td className="border px-2 py-1">{f.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!scanning && scanComplete && text && flags.length === 0 && (
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
