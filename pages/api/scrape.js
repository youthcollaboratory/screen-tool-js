import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const response = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(response.data);
    $('script, style, header, footer, nav, aside').remove();
    const text = $('p').map((i, el) => $(el).text().trim()).get().join('\n\n');
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Scraping failed' });
  }
}