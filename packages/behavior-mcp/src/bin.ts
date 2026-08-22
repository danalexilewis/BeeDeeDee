#!/usr/bin/env node
import { createNodeFileSystem, createSilentLogger, createSystemClock } from '@eddy/behavior-core';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { defaultProject, parseArgs } from './args.js';
import { createBehaviorMcpServer } from './server.js';

const { projectRoot, allowWrites } = parseArgs(process.argv.slice(2));

const mcp = createBehaviorMcpServer({
  project: defaultProject(projectRoot),
  projectRoot,
  allowWrites,
  fileSystem: createNodeFileSystem(projectRoot),
  clock: createSystemClock(),
  // stdio carries the protocol, so anything written to stdout would corrupt it.
  logger: createSilentLogger(),
  onAudit(entry) {
    process.stderr.write(`${JSON.stringify(entry)}\n`);
  },
});

await mcp.connect(new StdioServerTransport());
