import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import type { Change } from './runner.js';

export interface Report {
  package: string;
  from: string;
  to: string;
  summary: { mechanical: number; flagged: number; env: number };
  changes: Change[];
}

export function buildReport(
  pkg: string,
  from: string,
  to: string,
  changes: Change[]
): Report {
  return {
    package: pkg,
    from,
    to,
    summary: {
      mechanical: changes.filter(c => c.kind === 'mechanical' && c.status === 'applied').length,
      flagged: changes.filter(c => c.kind !== 'env' && c.status === 'flagged').length,
      env: changes.filter(c => c.kind === 'env').length,
    },
    changes,
  };
}

export function printReport(report: Report, dryRun: boolean): void {
  const prefix = dryRun ? chalk.yellow('[dry-run] ') : '';
  console.log('');
  console.log(chalk.bold(`${prefix}MongoDB driver upgrade: ${report.from} → ${report.to}`));
  console.log('');

  if (report.changes.length === 0) {
    console.log(chalk.green('  ✓ Nothing to do — project is already up to date.'));
    return;
  }

  for (const change of report.changes) {
    const icon = change.status === 'applied'
      ? chalk.green('  ✓')
      : chalk.yellow('  ⚠');
    const label = change.status === 'applied' ? 'applied' : 'flagged';
    console.log(`${icon} ${chalk.dim(change.file)} — ${chalk.bold(change.codemod)} [${label}]`);
    if (change.note) console.log(`      ${chalk.dim(change.note)}`);
  }

  console.log('');
  console.log(
    `  ${chalk.green(report.summary.mechanical + ' transforms applied')}` +
    (report.summary.flagged > 0
      ? `  ${chalk.yellow(report.summary.flagged + ' flagged for review')}`
      : '') +
    (report.summary.env > 0
      ? `  ${chalk.cyan(report.summary.env + ' env checks updated')}`
      : '')
  );
}

export function writeReportFile(report: Report, cwd: string): void {
  const path = join(cwd, 'upgrade-report.json');
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf8');
  console.log(chalk.dim(`\n  Report saved to upgrade-report.json`));
}
