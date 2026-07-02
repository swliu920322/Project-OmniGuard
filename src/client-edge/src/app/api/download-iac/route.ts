import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  const projectRoot = path.join(process.cwd(), '..');
  const azureDir = path.join(projectRoot, '.azure');

  const allowedFiles = [
    'main.bicep',
    'nested-infra.bicep',
    'compute-module.bicep',
    'main.parameters.json',
    'network-rules.json'
  ];

  for (const f of allowedFiles) {
    const fullPath = path.join(azureDir, f);
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(azureDir))) {
      return NextResponse.json({ error: 'Path traversal detected' }, { status: 400 });
    }
  }

  const tmpZip = path.join('/tmp', 'omni-guard-iac.zip');
  const filesToZip = allowedFiles.filter(f => fs.existsSync(path.join(azureDir, f)));
  const fileList = filesToZip.map(f => path.join(azureDir, f)).join(' ');

  try {
    await execAsync(`zip -j "${tmpZip}" ${fileList}`);
    const fileBuffer = fs.readFileSync(tmpZip);
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=omni-guard-iac.zip'
      }
    });
  } catch (err: any) {
    console.error('[Download IaC] Failed to create zip:', err);
    return NextResponse.json({ error: 'Failed to create package', message: err.message }, { status: 500 });
  }
}
