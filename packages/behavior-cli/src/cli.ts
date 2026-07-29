#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program.name('behavior').description('CLI for Behavior Workbench').version('0.1.0');

program.addHelpText(
  'after',
  `
Examples:
  behavior index - index behavior specifications
  behavior serve - start development server
`
);

program.parse();
