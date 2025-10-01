#!/usr/bin/env node
/**
 * Verifies UI patterns against docs/design-constraints.md and validates backend-inventory.json shape.
 * - Scans frontend for banned/required patterns (with per-file scopes)
 * - Respects waivers in .design-constraints-allowlist.json
 * - Validates docs/generated/backend-inventory.json minimal schema
 */

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const constraintsPath = path.join(repoRoot, 'docs', 'design-constraints.md');
const inventoryPath = path.join(repoRoot, 'docs', 'generated', 'backend-inventory.json');

function readVerifyConfig() {
  const md = fs.readFileSync(constraintsPath, 'utf8');
  const start = md.indexOf('<!-- VERIFY-CONFIG:BEGIN -->');
  const end = md.indexOf('<!-- VERIFY-CONFIG:END -->');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('VERIFY-CONFIG block not found in docs/design-constraints.md');
  }
  const jsonRaw = md.slice(start + '<!-- VERIFY-CONFIG:BEGIN -->'.length, end).trim();
  return JSON.parse(jsonRaw);
}

function validateInventoryShape(inv) {
  const errors = [];
  if (!inv || typeof inv !== 'object') errors.push('Inventory is not an object');
  if (!Array.isArray(inv.surfaces)) errors.push('Missing surfaces[]');
  (inv.surfaces || []).forEach((surface, si) => {
    if (!Array.isArray(surface.routes)) errors.push(`surfaces[${si}].routes missing`);
    (surface.routes || []).forEach((r, ri) => {
      const required = ['method', 'path', 'operation', 'auth', 'permissions', 'idempotency', 'consistency', 'latency', 'payload_p95_bytes'];
      required.forEach((k) => {
        if (!(k in r)) errors.push(`surfaces[${si}].routes[${ri}] missing ${k}`);
      });
      if (!r.latency || typeof r.latency.p50_ms !== 'number' || typeof r.latency.p95_ms !== 'number' || !r.latency.source) {
        errors.push(`surfaces[${si}].routes[${ri}].latency must include p50_ms, p95_ms, source`);
      }
      if (!Array.isArray(r.params)) {
        // allow null for endpoints without params
        if (r.params !== null && r.params !== undefined) {
          errors.push(`surfaces[${si}].routes[${ri}].params must be array|null|undefined`);
        }
      }
      if (r.pagination && !r.pagination.type) errors.push(`surfaces[${si}].routes[${ri}].pagination.type required when pagination present`);
    });
  });
  return errors;
}

function loadWaivers(waiverFile) {
  const p = path.join(repoRoot, waiverFile || '.design-constraints-allowlist.json');
  if (!fs.existsSync(p)) return { waivers: [] };
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { waivers: Array.isArray(data.waivers) ? data.waivers : [] };
  } catch (e) {
    return { waivers: [] };
  }
}

function fileExists(p) { try { fs.accessSync(p, fs.constants.R_OK); return true; } catch { return false; } }

function scanFileForPattern(filePath, regex) {
  const src = fs.readFileSync(filePath, 'utf8');
  return regex.test(src);
}

function enforcePatterns(config, waivers) {
  const violations = [];
  const frontendDir = path.join(repoRoot, 'frontend', 'src');
  const waived = new Set(waivers.map(w => `${w.name}::${path.normalize(w.path)}`));

  const checkSet = (set, type) => {
    (set || []).forEach(rule => {
      const re = new RegExp(rule.pattern);
      (rule.paths || []).forEach(rel => {
        const file = path.join(repoRoot, rel);
        if (!fileExists(file)) return; // ignore missing files
        const key = `${rule.name}::${path.normalize(rel)}`;
        const has = scanFileForPattern(file, re);
        if (type === 'banned' && has && !waived.has(key)) {
          violations.push({ type, rule: rule.name, file: rel, rationale: rule.rationale });
        }
        if (type === 'required' && !has && !waived.has(key)) {
          violations.push({ type, rule: rule.name, file: rel, rationale: rule.rationale });
        }
      });
    });
  };

  checkSet(config.banned, 'banned');
  checkSet(config.required, 'required');
  return violations;
}

function main() {
  let exitCode = 0;
  try {
    const verifyCfg = readVerifyConfig();
    const { waivers } = loadWaivers(verifyCfg.waiver_file);

    // Inventory validation
    const inv = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    const invErrors = validateInventoryShape(inv);
    if (invErrors.length) {
      console.error('backend-inventory.json validation failed:');
      invErrors.forEach(e => console.error(' -', e));
      exitCode = 1;
    } else {
      console.log('backend-inventory.json: OK');
    }

    // Pattern enforcement
    const violations = enforcePatterns(verifyCfg, waivers);
    if (violations.length) {
      console.error('Design constraint violations:');
      for (const v of violations) {
        console.error(` - [${v.type}] ${v.rule} in ${v.file}: ${v.rationale}`);
      }
      exitCode = 1;
    } else {
      console.log('UI pattern checks: OK');
    }
  } catch (err) {
    console.error('Verifier error:', err.message);
    exitCode = 1;
  }
  process.exit(exitCode);
}

main();

