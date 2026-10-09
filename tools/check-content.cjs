const fs = require('node:fs');
const path = require('node:path');
const { validateRuntime } = require('./content-schema.cjs');
const file = path.resolve(__dirname, '../content/game-data.json');
try {
  const data = validateRuntime(JSON.parse(fs.readFileSync(file, 'utf8')));
  console.log(`內容驗證通過: ${Object.keys(data.buildings).length} 建築 / ${Object.keys(data.technologies).length} 科技 / ${Object.keys(data.texts).length} 文案`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
