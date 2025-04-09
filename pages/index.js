import { useState } from 'react';
import Papa from 'papaparse';

export default function Home() {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [flags, setFlags] = useState([]);
  const [csvData, setCsvData] = useState([]);

  const handleScrape = async () => {
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
          const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
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
        highlighted: false
      });

      segments.push({
        start: flag.position,
        end: flag.position + flag.term.length,
        text: `<mark style="background-color:${
          flag.matchType === 'Primary' || flag.matchType === 'Secondary'
            ? '#FFA500'
            : '#FFFF00'
        }">${text.substr(flag.position, flag.term.length)}</mark><sup style="font-size:0.7em; vertical-align:super; margin-left:2px;">[${i + 1}]</sup>`,
        highlighted: true
      });

      lastIndex = flag.position + flag.term.length;
    });

    segments.push({
      start: lastIndex,
      end: text.length,
      text: text.slice(lastIndex),
      highlighted: false
    });

    const fullText = segments.map(seg => seg.text).join('');
    const paragraphs = fullText.split(/\n\s*\n/);

    return paragraphs
      .map(para => `<p style="margin-bottom: 1em; line-height: 1.7;">${para.trim()}</p>`)
      .join('');
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Communication Content Screening</h1>
      <input
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="mb-4 block"
      />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter URL to scrape..."
        className="border p-2 w-full mb-4"
      />
      <button
        onClick={handleScrape}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-4"
      >
        {loading ? 'Scraping...' : 'Scrape and Screen'}
      </button>
      {error && <p className="text-red-600">Error: {error}</p>}
      {flags.length > 0 && (
        <div className="my-6">
          <h2 className="font-semibold mb-2">Flagged Terms</h2>
          <table className="table-auto border-collapse w-full text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">#</th>
                <th className="border px-2 py-1">Term</th>
                <th className="border px-2 py-1">Match Type</th>
                <th className="border px-2 py-1">Primary Term</th>
                <th className="border px-2 py-1">Category</th>
                <th className="border px-2 py-1">EO</th>
                <th className="border px-2 py-1">Reason</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{i + 1}</td>
                  <td className="border px-2 py-1">{f.term}</td>
                  <td className="border px-2 py-1">{f.matchType}</td>
                  <td className="border px-2 py-1">{f.primary}</td>
                  <td className="border px-2 py-1">{f.category}</td>
                  <td className="border px-2 py-1">{f.eo}</td>
                  <td className="border px-2 py-1">{f.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {text && (
        <div className="mt-6">
          <h2 className="font-semibold mb-2">Highlighted Content</h2>
          <div
            className="bg-gray-100 p-4 text-sm border rounded"
            dangerouslySetInnerHTML={{ __html: getHighlightedText() }}
          />
        </div>
      )}
    </div>
  );
}
