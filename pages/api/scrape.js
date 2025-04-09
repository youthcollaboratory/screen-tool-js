
import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    $('script, style, nav, footer, header').remove();
    const text = $('p').map((i, el) => $(el).text()).get().join('\n\n');

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
