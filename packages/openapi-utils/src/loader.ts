import { readFile } from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { OpenAPISpec } from './types';

/**
 * Loads and parses an OpenAPI spec from a YAML or JSON file.
 * Does not modify the file — upstream specs are read-only.
 */
export async function loadSpec(specPath: string): Promise<OpenAPISpec> {
  const absolutePath = path.resolve(specPath);
  const content = await readFile(absolutePath, 'utf-8');

  const ext = path.extname(absolutePath).toLowerCase();

  if (ext === '.yaml' || ext === '.yml') {
    return yaml.load(content) as OpenAPISpec;
  }

  if (ext === '.json') {
    return JSON.parse(content) as OpenAPISpec;
  }

  throw new Error(`Unsupported spec format: '${ext}'. Expected .yaml, .yml, or .json`);
}
