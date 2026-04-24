function validateYamlStructure(lines) {
  const errors = [];
  let inBlock = false;
  let blockIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    if (indent === -1) continue;

    const trimmed = line.trimEnd();

    if (trimmed.startsWith('|') || trimmed.startsWith('>')) {
      inBlock = true; blockIndent = indent; continue;
    }
    if (inBlock && indent <= blockIndent) inBlock = false;

    if (!inBlock) {
      const colonIdx = trimmed.indexOf(':');
      const dashIdx = trimmed.indexOf('-');
      if (colonIdx === -1 && dashIdx === -1) {
        errors.push({ line: i + 1, message: 'Invalid structure: expected key: value or list item' });
      }
      if (trimmed.endsWith('::')) {
        errors.push({ line: i + 1, message: 'Double colon found' });
      }
      // Check for tabs (YAML shouldn't have tabs)
      if (line.includes('\t')) {
        errors.push({ line: i + 1, message: 'Tab character found (use spaces)' });
      }
    }
  }
  return errors;
}

function formatYaml(lines) {
  const result = [];
  for (const rawLine of lines) {
    const trimmed = rawLine.trimEnd();
    if (!trimmed || trimmed.startsWith('#')) { result.push(trimmed); continue; }
    const leading = rawLine.search(/\S/);
    if (leading === -1) { result.push(''); continue; }
    const indent = Math.floor(leading / 2) * 2;
    const dashIdx = trimmed.indexOf('-');
    const colonIdx = trimmed.indexOf(':');
    if (dashIdx !== -1 && (colonIdx === -1 || dashIdx < colonIdx)) {
      const content = trimmed.slice(dashIdx + 1).trim();
      result.push(' '.repeat(indent) + (content ? '- ' + content : '-'));
    } else if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx);
      const val = trimmed.slice(colonIdx + 1).trim();
      result.push(' '.repeat(indent) + key + ':' + (val ? ' ' + val : ''));
    } else {
      result.push(trimmed);
    }
  }
  return result.join('\n');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-License-Key');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { yaml } = req.body || {};
    if (!yaml) return res.status(400).json({ error: 'yaml field is required' });

    const lines = String(yaml).split('\n');
    const errors = validateYamlStructure(lines);

    if (errors.length > 0) {
      return res.status(200).json({ valid: false, errors, formatted: null });
    }

    const formatted = formatYaml(lines);
    return res.status(200).json({ valid: true, errors: [], formatted });
  } catch (err) {
    return res.status(500).json({ error: 'YAML processing failed', details: err.message });
  }
};
