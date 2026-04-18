#!/usr/bin/env node
import { program } from 'commander';
import { run } from './runner';

program
  .name('specguard')
  .description('SpecGuard — OpenAPI Contract Test Runner')
  .version('1.0.0');

program
  .command('test')
  .description('Run contract tests against an API endpoint')
  .requiredOption('--spec <path>', 'Path to internal OpenAPI spec (spec/internal/openapi.yaml)')
  .requiredOption('--base-url <url>', 'Base URL of the API to test (e.g. http://wrapper-api:3000)')
  .option('--upstream-spec <path>', 'Path to upstream actor spec for drift detection')
  .option('--output <path>', 'Path to write the JSON report', './reports/report.json')
  .option('--timeout <ms>', 'Per-request timeout in milliseconds', '10000')
  .option('--fail-on-violation', 'Exit with code 1 when contract violations are found', false)
  .option('--ai-test-gen', 'Use Claude to generate additional edge-case tests (requires ANTHROPIC_API_KEY)', false)
  .action(async (opts: {
    spec: string;
    baseUrl: string;
    upstreamSpec?: string;
    output: string;
    timeout: string;
    failOnViolation: boolean;
    aiTestGen: boolean;
  }) => {
    try {
      const report = await run({
        spec: opts.spec,
        baseUrl: opts.baseUrl,
        upstreamSpec: opts.upstreamSpec,
        output: opts.output,
        timeoutMs: parseInt(opts.timeout, 10),
        failOnViolation: opts.failOnViolation,
        aiTestGen: opts.aiTestGen,
      });

      const hasViolations = report.summary.contractViolations > 0 ||
        report.summary.infrastructureErrors > 0;

      if (opts.failOnViolation && hasViolations) {
        process.exit(1);
      }

      // Upstream drift is warning-only by default — does not cause non-zero exit
      process.exit(0);
    } catch (err) {
      console.error('\nFatal error:', (err as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);
