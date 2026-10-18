// Generates JSON Schemas for the package files from the zod schema (single source of truth).
// Editors with TOML + JSON Schema support (e.g. Taplo / "Even Better TOML") then give
// autocomplete and inline errors: add `#:schema <path>` as the first line of a file.
import { writeFileSync, mkdirSync } from 'node:fs';
import { z } from 'zod';
import { Manifest, Model, Sheet, Creation } from '../src/engine/schema.ts';

const files = { system: Manifest, model: Model, sheet: Sheet, creation: Creation };
mkdirSync(new URL('../schema/', import.meta.url), { recursive: true });
for (const [name, schema] of Object.entries(files)) {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  json.title = `trpg-sheets ${name}.toml`;
  writeFileSync(new URL(`../schema/${name}.schema.json`, import.meta.url), JSON.stringify(json, null, 2) + '\n');
}
console.log('wrote schema/*.schema.json');
