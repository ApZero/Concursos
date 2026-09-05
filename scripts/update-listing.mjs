// Se ejecuta en GitHub Actions (Node, no en el navegador), así que no hay
// restricciones de CORS: se conecta directo a escritores.org, extrae los
// concursos de la página de listado y guarda el resultado en data/listado.json.
// La app (index.html) simplemente lee ese archivo, que vive en el mismo
// sitio (mismo origen), así que su fetch nunca falla por CORS ni depende de
// ningún proxy de terceros.

import { writeFileSync, mkdirSync } from 'fs';
import * as cheerio from 'cheerio';

const LISTING_URL = 'https://www.escritores.org/concursos/concursos-1/concursos-literarios';

function normalizeSpace(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

async function main() {
  const res = await fetch(LISTING_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ConcursosTrackerBot/1.0; personal use)' }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' al pedir la página de listado');
  const html = await res.text();
  const $ = cheerio.load(html);

  const found = [];
  const seen = new Set();

  $('a[href*="recursos-para-escritores"]').each((_, el) => {
    const a = $(el);
    const hrefRaw = a.attr('href');
    if (!hrefRaw) return;
    const url = hrefRaw.startsWith('http') ? hrefRaw : new URL(hrefRaw, LISTING_URL).toString();

    let title = normalizeSpace(a.text());
    if (!title || title.length < 4) return;

    let container = a.closest('li');
    if (container.length === 0) container = a.parent();
    const text = normalizeSpace(container.text());

    const m = text.match(/\(\s*(\d{2}):(\d{2}):(\d{4})\s*\/\s*([^/)]+)\/\s*([^/)]+)\/\s*Abierto a:?\s*([^)]*)\)/i);
    const entry = { url, title, country: '', deadline: '', category: '', prize: '', conditions: '' };
    if (m) {
      const [, dd, mm, yyyy, category, prize, conditions] = m;
      entry.deadline = `${yyyy}-${mm}-${dd}`;
      entry.category = category.trim();
      entry.prize = prize.trim();
      entry.conditions = conditions.trim();
    }
    const cm = title.match(/^(.*)\s\(([^()]{2,40})\)\s*$/);
    if (cm) {
      entry.title = cm[1].trim();
      entry.country = cm[2].trim();
    }

    if (seen.has(entry.url)) return;
    seen.add(entry.url);
    found.push(entry);
  });

  if (found.length === 0) {
    throw new Error('No se reconoció ningún concurso — puede que la página haya cambiado de estructura');
  }

  mkdirSync('data', { recursive: true });
  const payload = {
    updatedAt: new Date().toISOString(),
    sourceUrl: LISTING_URL,
    count: found.length,
    contests: found
  };
  writeFileSync('data/listado.json', JSON.stringify(payload, null, 2));
  console.log(`Listo: ${found.length} concursos guardados en data/listado.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
