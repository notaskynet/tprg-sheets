// Turns a bag of files ({ 'model.toml': '…' }) — from a folder, import.meta.glob
// or an unzipped archive — into a validated SystemPackage.
import { parse as parseToml } from 'smol-toml';
import { unzipSync, strFromU8 } from 'fflate';
import { z } from 'zod';
import { Creation, Manifest, Model, Sheet, type Locale, type SystemPackage } from './schema';
import { compile } from './expr/eval';

export class PackageError extends Error {
  constructor(public issues: string[]) {
    super(`Invalid system package:\n- ${issues.join('\n- ')}`);
  }
}

export type Files = Record<string, string>;

/** Unzip an archive into Files; strips a single shared top-level folder. */
export function filesFromZip(data: Uint8Array): Files {
  const raw = unzipSync(data);
  const names = Object.keys(raw).filter((n) => !n.endsWith('/') && !n.startsWith('__MACOSX'));
  const first = names[0]?.split('/')[0];
  const strip = names.length > 0 && names.every((n) => n.startsWith(first + '/')) ? first + '/' : '';
  const out: Files = {};
  for (const n of names) out[n.slice(strip.length)] = strFromU8(raw[n]);
  return out;
}

function toml(files: Files, name: string, issues: string[], required = false): Record<string, unknown> {
  const src = files[name];
  if (src == null) {
    if (required) issues.push(`${name}: file is missing`);
    return {};
  }
  try {
    return parseToml(src) as Record<string, unknown>;
  } catch (e) {
    issues.push(`${name}: ${(e as Error).message}`);
    return {};
  }
}

function zodIssues(file: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `${file}: ${i.path.join('.') || '(root)'} — ${i.message}`);
}

function parseWith<T extends z.ZodType>(schema: T, file: string, data: unknown, issues: string[]): z.infer<T> | undefined {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  issues.push(...zodIssues(file, r.error));
  return undefined;
}

/** Flatten nested tables into dotted keys: { clans: { brujah: 'X' } } → { 'clans.brujah': 'X' } */
function flatten(obj: Record<string, unknown>, prefix = '', out: Locale = {}): Locale {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v as Record<string, unknown>, key, out);
    else out[key] = String(v);
  }
  return out;
}

export function loadPackage(files: Files): SystemPackage {
  const issues: string[] = [];

  const manifest = parseWith(Manifest, 'system.toml', toml(files, 'system.toml', issues, true), issues);
  const model = parseWith(Model, 'model.toml', toml(files, 'model.toml', issues, true), issues);
  const sheet = parseWith(Sheet, 'sheet.toml', toml(files, 'sheet.toml', issues), issues);
  const creation = parseWith(Creation, 'creation.toml', toml(files, 'creation.toml', issues), issues);

  const locales: Record<string, Locale> = {};
  for (const name of Object.keys(files)) {
    const m = /^locales\/([A-Za-z-]+)\.toml$/.exec(name);
    if (m) locales[m[1]] = flatten(toml(files, name, issues));
  }

  if (!manifest || !model || !sheet || !creation) throw new PackageError(issues);

  // Cross-reference checks (each reports a precise location).
  const checkExpr = (where: string, src: string) => {
    try { compile(src); } catch (e) { issues.push(`${where}: ${(e as Error).message}`); }
  };
  for (const [k, src] of Object.entries(model.derived)) checkExpr(`model.toml: derived.${k}`, src);
  for (const [k, f] of Object.entries(model.fields)) {
    if (f.type === 'pool') checkExpr(`model.toml: fields.${k}.max`, f.max);
    if (f.type === 'select' && f.from && !model.catalogs[f.from]) issues.push(`model.toml: fields.${k}.from — unknown catalog "${f.from}"`);
  }
  for (const s of creation.steps) {
    if ((s.kind === 'priority' || s.kind === 'pointbuy' || s.kind === 'array' || s.kind === 'roll') && !model.groups[s.group])
      issues.push(`creation.toml: step "${s.id}" — unknown group "${s.group}"`);
    if (s.kind === 'pick' && !model.catalogs[s.from]) issues.push(`creation.toml: step "${s.id}" — unknown catalog "${s.from}"`);
    if (s.kind === 'priority' && model.groups[s.group] && s.budgets.length !== model.groups[s.group].categories.length)
      issues.push(`creation.toml: step "${s.id}" — ${s.budgets.length} budgets for ${model.groups[s.group].categories.length} categories`);
  }
  for (const l of manifest.languages) if (!locales[l]) issues.push(`locales/${l}.toml: declared in system.toml but missing`);

  if (issues.length) throw new PackageError(issues);
  return { manifest, model, sheet, creation, locales };
}
