// One-off: builds reference/lycees.json from the public "Annuaire de l'éducation"
// dataset (data.gouv.fr / data.education.gouv.fr). Re-run to refresh.
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records';
const SELECT = [
  'identifiant_de_l_etablissement', 'nom_etablissement', 'nom_commune',
  'code_postal', 'code_departement', 'libelle_departement', 'statut_public_prive',
  'voie_generale', 'voie_technologique', 'voie_professionnelle',
].join(',');

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'ai-literacy-platform/1.0' } }, (r) => {
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode)); }
      let d = ''; r.setEncoding('utf8'); r.on('data', (c) => (d += c));
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

(async () => {
  const out = [];
  const LIMIT = 100;
  let offset = 0, total = Infinity;
  while (offset < total) {
    const url = `${BASE}?where=${encodeURIComponent('type_etablissement="Lycée"')}`
      + `&select=${encodeURIComponent(SELECT)}&limit=${LIMIT}&offset=${offset}`;
    const page = await get(url);
    total = page.total_count;
    for (const r of page.results) {
      if (!r.identifiant_de_l_etablissement || !r.nom_etablissement) continue;
      out.push({
        uai: r.identifiant_de_l_etablissement,
        nom: r.nom_etablissement,
        commune: r.nom_commune || '',
        cp: r.code_postal || '',
        dep: r.code_departement || '',
        depNom: r.libelle_departement || '',
        statut: r.statut_public_prive || '',
        voies: [r.voie_generale === '1' ? 'G' : '', r.voie_technologique === '1' ? 'T' : '',
                r.voie_professionnelle === '1' ? 'P' : ''].join(''),
      });
    }
    offset += LIMIT;
    if (offset % 1000 === 0) process.stderr.write(`  ${offset}/${total}\n`);
    // The API caps offset at 10000; bail out cleanly if we ever hit it.
    if (offset >= 10000) break;
  }
  out.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const file = path.join(process.argv[2] || '.', 'reference', 'lycees.json');
  fs.writeFileSync(file, JSON.stringify({
    _source: 'https://www.data.gouv.fr/datasets/annuaire-de-leducation (fr-en-annuaire-education)',
    _fetchedAt: new Date().toISOString().slice(0, 10),
    _licence: 'Licence Ouverte / Open Licence (Etalab)',
    count: out.length,
    lycees: out,
  }));
  console.log('wrote', file, 'with', out.length, 'lycées of', total);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
