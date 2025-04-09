import { useState } from 'react';

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
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = text.trim().split('\n').map(line => line.split(','));
      const headers = rows[0];
      const formatted = rows.slice(1).map(row => {
        const obj = {};
        row.forEach((val, i) => obj[headers[i]?.trim()] = val.trim());
        return obj;
      });
      setCsvData(formatted);
    };
    reader.readAsText(file);
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
    let lastIndex = 0
