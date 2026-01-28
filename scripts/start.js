#!/usr/bin/env node
import { spawn } from 'child_process';

const port = process.env.PORT || 5173;

const child = spawn('npx', ['vite', 'preview', '--host', '0.0.0.0', '--port', port.toString()], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
