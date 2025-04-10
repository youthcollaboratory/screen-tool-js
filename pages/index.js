import { useState } from 'react';
import Papa from 'papaparse';

export default function Home() {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [flags, setFlags] = useState([]);
  const [csvData, setCsvData] = useState([]);

  // Flash on anchor jumps
  useEffect(() => {
    const handleHashJump = () => {
      const id = window.location.hash?.substring(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (el) {
        const mark = el.querySelector('mark');
        if (mark) {
          mark.classList.remove('animate-flash-once');
          void mark.offsetWidth; // Force reflow
          mark.classList.add('animate-flash-once');
        }
      }
    };

    window.addEventListener('hashchange', handleHashJump);
    return () => window.removeEventListener('hashchange', handleHashJump);
  }, []);

const handleScrape = async () => {
  setText(''); // Clear pasted text
  setLoading(true);
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
    }
  } catch (e) {
    setError(e.message);
  }
  setLoading(false);
};

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
      },
      error: (err) => {
        setError('CSV parsing error: ' + err.message);
      }
    });
  };

  const runScreening = (inputText, termList) => {
    const results = [];
    const priority = { Primary: 0, Secondary: 1, Tertiary: 2 };

    termList.forEach(row => {
      const termMap = {
        Primary: [row['Primary Term']],
        Secondary: row['Secondary Terms']?.split(';').map(t => t.trim()).filter(Boolean) || [],
        Tertiary: row['Tertiary Terms']?.split(';').map(t => t.trim()).filter(Boolean) || []
      };

      Object.entries(termMap).forEach(([matchType, terms]) => {
        terms.forEach(term => {
          const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
          let match;
          while ((match = regex.exec(inputText)) !== null) {
            results.push({
              term: match[0],
              matchType,
              reason: row['Flag Reason'] || '—',
              eo: row['Executive Orders'] || '—',
              primary: row['Primary Term'] || '—',
              category: row['Category'] || '—',
              position: match.index
            });
          }
        });
      });
    });

    const deduped = Object.values(results.reduce((acc, cur) => {
      const key = cur.term.toLowerCase() + cur.position;
      if (!acc[key] || priority[cur.matchType] < priority[acc[key].matchType]) {
        acc[key] = cur;
      }
      return acc;
    }, {})).sort((a, b) => a.position - b.position);

    setFlags(deduped);
  };

const getHighlightedText = () => {
  if (!flags.length) return text;

  let result = '';
  let lastIndex = 0;
  let segments = [];

  flags.forEach((flag, i) => {
    segments.push({
      start: lastIndex,
      end: flag.position,
      text: text.slice(lastIndex, flag.position),
      highlighted: false,
    });

    const highlightedText = text.substr(flag.position, flag.term.length);

    segments.push({
      start: flag.position,
      end: flag.position + flag.term.length,
      text: `<a id="ref-${i + 1}"><mark class="animate-flash-once" style="background-color:${
        flag.matchType === 'Primary' || flag.matchType === 'Secondary'
          ? '#FFA500'
          : '#FFFF00'
      }">${highlightedText}</mark></a><a href="#flag-${i + 1}"><sup style="font-size:0.7em; vertical-align:super; margin-left:2px;">[${i + 1}]</sup></a>`,
      highlighted: true,
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
        <h2 className="text-xl font-semibold mb-2">1. Upload Screening Terms</h2>
        <input type="file" accept=".csv" onChange={handleFileUpload} className="block text-sm" />
      </div>

      <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
        <h2 className="text-xl font-semibold mb-2">2. Scan From Webpage</h2>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter a URL to scrape and scan..." className="border border-gray-300 p-2 rounded w-full mb-3" />
        <button onClick={handleScrape} disabled={loading} className="bg-yc-blue text-white px-4 py-2 rounded hover:bg-yc-blue-dark">
          {loading ? 'Scraping...' : 'Scrape and Scan'}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
        <h2 className="text-xl font-semibold mb-2">3. Scan Pasted Text</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your text here..." className="border border-gray-300 p-2 rounded w-full h-40 mb-3" />
        <button onClick={() => {setUrl(''); runScreening(text, csvData);}} disabled={loading || !text} className="bg-yc-green text-white px-4 py-2 rounded hover:bg-yc-green-dark">
          Scan Pasted Text
        </button>
      </div>

      {error && <p className="text-red-600">Error: {error}</p>}

      {flags.length > 0 && (
        <div className="my-6">
          <h2 className="font-semibold mb-2">Flagged Terms</h2>
          <table className="table-auto border-collapse w-full text-sm bg-white shadow-sm rounded">
            <thead>
              <tr>
                <th className="border px-2 py-1">#</th>
                <th className="border px-2 py-1">Term</th>
                <th className="border px-2 py-1">Match Type</th>
                <th className="border px-2 py-1">Primary Term</th>
                <th className="border px-2 py-1">Reason</th>
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
                  <td className="border px-2 py-1">{f.matchType}</td>
                  <td className="border px-2 py-1">{f.primary}</td>
                  <td className="border px-2 py-1">{f.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {text && (
        <div className="mt-6 bg-gray-50 p-4 border rounded">
          <h2 className="font-semibold mb-2">Screened Content</h2>
          <div className="text-sm" style={{ lineHeight: '1.7' }} dangerouslySetInnerHTML={{ __html: getHighlightedText() }} />
        </div>
      )}
    </div>
  );
}
