// The generated JSON Schemas (for editor autocomplete) must accept every bundled package
// and stay in sync with the zod schema.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BUILTIN_FILES } from '@/systems/builtin';
import { Creation, Manifest, Model, Sheet } from './schema';

const schemas = { system: Manifest, model: Model, sheet: Sheet, creation: Creation };
const root = join(__dirname, '../..');

describe('JSON Schema', () => {
  it.each(Object.keys(schemas))('schema/%s.schema.json is up to date (run `pnpm schema`)', (name) => {
    const fresh = z.toJSONSchema(schemas[name as keyof typeof schemas], { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    fresh.title = `trpg-sheets ${name}.toml`;
    expect(JSON.parse(readFileSync(join(root, `schema/${name}.schema.json`), 'utf8'))).toEqual(fresh);
  });

  const ajv = new Ajv2020({ strict: false, allErrors: true });
  for (const [id, files] of Object.entries(BUILTIN_FILES)) {
    it.each(Object.keys(schemas))(`${id}: %s.toml validates`, (name) => {
      const src = files[`${name}.toml`];
      if (!src) return;
      const schema = JSON.parse(readFileSync(join(root, `schema/${name}.schema.json`), 'utf8'));
      const validate = ajv.compile(schema);
      const ok = validate(parse(src));
      expect(ok, JSON.stringify(validate.errors?.slice(0, 3))).toBe(true);
    });
  }

  it('rejects an invalid file', () => {
    const validate = ajv.compile(JSON.parse(readFileSync(join(root, 'schema/system.schema.json'), 'utf8')));
    expect(validate(parse('id = "Bad Id"\nversion = "1"'))).toBe(false);
  });
});
