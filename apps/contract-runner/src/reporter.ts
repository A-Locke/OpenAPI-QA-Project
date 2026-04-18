import { writeFile } from 'fs/promises';
import path from 'path';
import { TestReport, TestResult, ResultCategory } from './types';
import type { DriftWarning } from '@specguard/drift-core';

// ── Console output ────────────────────────────────────────────────────────

export function printSummary(report: TestReport): void {
  const { summary, results, driftWarnings } = report;
  const line = '─'.repeat(60);

  console.log('\n' + line);
  console.log(' SpecGuard — Contract Test Report');
  console.log(line);
  console.log(` Base URL : ${report.baseUrl}`);
  console.log(` Spec     : ${report.specPath}`);
  console.log(` Time     : ${report.timestamp}`);
  console.log(line);

  // ── Per-result lines ──────────────────────────────────────────────────
  const grouped = groupByCategory(results);

  if (grouped.passed.length > 0) {
    console.log('\n PASSED');
    for (const r of grouped.passed) {
      console.log(`   ✓  ${r.description} (${r.durationMs}ms)`);
    }
  }

  if (grouped.contract_violation.length > 0) {
    console.log('\n CONTRACT VIOLATIONS');
    for (const r of grouped.contract_violation) {
      console.log(`   ✗  ${r.description}`);
      for (const e of r.errors) {
        console.log(`        → ${e}`);
      }
    }
  }

  if (grouped.upstream_drift.length > 0) {
    console.log('\n UPSTREAM DRIFT WARNINGS');
    for (const r of grouped.upstream_drift) {
      console.log(`   ⚠  ${r.description}`);
      for (const e of r.errors) {
        console.log(`        → ${e}`);
      }
    }
  }

  if (grouped.infrastructure_error.length > 0) {
    console.log('\n INFRASTRUCTURE ERRORS');
    for (const r of grouped.infrastructure_error) {
      console.log(`   !  ${r.description}`);
      for (const e of r.errors) {
        console.log(`        → ${e}`);
      }
    }
  }

  // ── Drift section ─────────────────────────────────────────────────────
  if (driftWarnings && driftWarnings.length > 0) {
    console.log('\n UPSTREAM SPEC DRIFT');
    printDriftWarnings(driftWarnings);
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('\n' + line);
  console.log(
    ` Total: ${summary.total}  ` +
    `Passed: ${summary.passed}  ` +
    `Violations: ${summary.contractViolations}  ` +
    `Drift: ${summary.upstreamDriftWarnings}  ` +
    `Errors: ${summary.infrastructureErrors}`
  );
  console.log(line + '\n');
}

function printDriftWarnings(warnings: DriftWarning[]): void {
  const byType = groupDriftByType(warnings);

  for (const [type, items] of Object.entries(byType)) {
    console.log(`   [${type}]`);
    for (const w of items) {
      const icon = w.severity === 'warning' ? '⚠' : 'i';
      console.log(`   ${icon}  ${w.path}`);
      console.log(`        ${w.message}`);
    }
  }
}

// ── JSON report ───────────────────────────────────────────────────────────

export async function writeJsonReport(report: TestReport, outputPath: string): Promise<void> {
  const absolutePath = path.resolve(outputPath);
  const dir = path.dirname(absolutePath);

  // Ensure output directory exists
  const { mkdir } = await import('fs/promises');
  await mkdir(dir, { recursive: true });

  await writeFile(absolutePath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n Report written to: ${absolutePath}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function buildSummary(results: TestResult[], driftWarnings: DriftWarning[]): TestReport['summary'] {
  return {
    total: results.length,
    passed: results.filter((r) => r.category === 'passed').length,
    contractViolations: results.filter((r) => r.category === 'contract_violation').length,
    upstreamDriftWarnings: driftWarnings.filter((w) => w.severity === 'warning').length,
    infrastructureErrors: results.filter((r) => r.category === 'infrastructure_error').length,
  };
}

function groupByCategory(
  results: TestResult[]
): Record<ResultCategory, TestResult[]> {
  const groups: Record<ResultCategory, TestResult[]> = {
    passed: [],
    contract_violation: [],
    upstream_drift: [],
    infrastructure_error: [],
  };
  for (const r of results) {
    groups[r.category].push(r);
  }
  return groups;
}

function groupDriftByType(
  warnings: DriftWarning[]
): Record<string, DriftWarning[]> {
  const groups: Record<string, DriftWarning[]> = {};
  for (const w of warnings) {
    (groups[w.type] ??= []).push(w);
  }
  return groups;
}
