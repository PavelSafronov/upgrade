#!/usr/bin/env node
import { Command } from 'commander';
import { detect } from './detect.js';
import { buildPlan } from './plan.js';
import { getCatalog, getById } from './catalog/index.js';
import { runCodemods, runEnvChecks } from './runner.js';
import { buildReport, printReport, writeReportFile } from './report.js';

const program = new Command();

program
  .name('upgrade')
  .description('Upgrade your MongoDB Node.js driver')
  .option('--dry-run', 'show what would change without writing files')
  .option('--only <id>', 'run a single named codemod')
  .option('--list', 'list available codemods and exit')
  .option('--from <major>', 'starting major version (auto-detected if omitted)')
  .option('--to <major>', 'target major version (default: 7)', '7')
  .argument('[path]', 'path to project root', '.')
  .action(async (projectPath: string, opts: {
    dryRun?: boolean;
    only?: string;
    list?: boolean;
    from?: string;
    to?: string;
  }) => {
    const catalog = getCatalog();

    if (opts.list) {
      for (const c of catalog) {
        console.log(`  ${c.id.padEnd(36)} [${c.kind}]  ${c.hop.from}→${c.hop.to}  ${c.description}`);
      }
      return;
    }

    const detected = detect(projectPath);
    if (!detected) {
      console.error('Could not detect mongodb version in package.json');
      process.exit(1);
    }

    const planFrom = opts.from ? `${parseInt(opts.from, 10)}.0.0` : detected.current;
    const plan = buildPlan(planFrom, opts.to);

    if (plan.length === 0) {
      console.log('Already at target version — nothing to do.');
      return;
    }

    const dryRun = opts.dryRun ?? false;
    const allChanges = [];

    for (const hop of plan) {
      const codemods = opts.only
        ? [getById(opts.only)].filter(Boolean) as typeof catalog
        : catalog.filter(c => c.hop.from === hop.from);

      const changes = await runCodemods(codemods, projectPath, { dryRun });
      const envChanges = await runEnvChecks(codemods, projectPath, { dryRun });
      allChanges.push(...changes, ...envChanges);
    }

    const report = buildReport(detected.package, detected.current, `${parseInt(opts.to ?? '7', 10)}.x`, allChanges);
    printReport(report, dryRun);
    if (!dryRun) writeReportFile(report, projectPath);
  });

program.parse();
