import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function parseCidr(cidr: string) {
  const parts = cidr.split('/');
  const mask = parseInt(parts[1], 10);
  const ipParts = parts[0].split('.').map(x => parseInt(x, 10));
  const start = ipParts[0] * 16777216 + ipParts[1] * 65536 + ipParts[2] * 256 + ipParts[3];
  const end = start + Math.pow(2, 32 - mask) - 1;
  return { start, end, mask };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parameters, uiState, dryRun } = body;

    if (!parameters || !uiState) {
      return NextResponse.json({ error: 'Missing parameters or uiState in request body' }, { status: 400 });
    }

    const {
      vnetAddressPrefix,
      backendSubnetPrefix,
      storageSubnetPrefix,
      prefix
    } = parameters;

    // 1) Validate prefix format
    if (prefix && !/^[a-z0-9]{2,8}$/.test(prefix)) {
      return NextResponse.json({
        success: false,
        error: 'ValidationError',
        message: 'prefix 必须为 2-8 位小写字母或数字'
      }, { status: 422 });
    }

    const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;

    // 2) Validate CIDR format for each network field
    for (const field of ['vnetAddressPrefix', 'backendSubnetPrefix', 'storageSubnetPrefix']) {
      const val = parameters[field];
      if (val && !cidrRegex.test(val)) {
        return NextResponse.json({
          success: false,
          error: 'ValidationError',
          message: `${field} 格式不合法，必须为标准 CIDR 格式`
        }, { status: 422 });
      }
    }

    if (vnetAddressPrefix && backendSubnetPrefix && storageSubnetPrefix) {
      const vnet = parseCidr(vnetAddressPrefix);
      const backend = parseCidr(backendSubnetPrefix);
      const storage = parseCidr(storageSubnetPrefix);

      // Validation A: backend subnet mask <= 23 (at least 512 IPs)
      if (backend.mask > 23) {
        return NextResponse.json({
          success: false,
          error: 'ValidationError',
          message: '容器子网掩码必须 <= 23（至少包含 512 个 IP 地址）'
        }, { status: 422 });
      }

      // Validation B: backend & storage subnets must be within VNet
      if (backend.start < vnet.start || backend.end > vnet.end) {
        return NextResponse.json({
          success: false,
          error: 'ValidationError',
          message: '容器子网不在虚拟网络范围内'
        }, { status: 422 });
      }
      if (storage.start < vnet.start || storage.end > vnet.end) {
        return NextResponse.json({
          success: false,
          error: 'ValidationError',
          message: '存储子网不在虚拟网络范围内'
        }, { status: 422 });
      }

      // Validation C: backend & storage subnets MUST NOT overlap
      if (!(backend.end < storage.start || storage.end < backend.start)) {
        return NextResponse.json({
          success: false,
          error: 'ValidationError',
          message: '容器子网与存储子网存在 IP 重叠'
        }, { status: 422 });
      }
    }

    const projectRoot = path.join(process.cwd(), '..');
    const paramFilePath = path.join(projectRoot, '.azure', 'main.parameters.json');
    const assemblerScriptPath = path.join(projectRoot, 'sh', 'iac-assembler.py');

    let cliScenario = 'sandbox';
    if (uiState.activeScenario === 'secure-iot' || uiState.activeScenario === 'global-portal') {
      cliScenario = 'secure-iot';
    }

    console.log(`[IaC Configurator] Selected Scenario: ${uiState.activeScenario} -> Mapping to Bicep Assembly Preset: ${cliScenario}`);

    let assemblerOutput = '';
    let compilePassed = false;
    try {
      const command = `python3 "${assemblerScriptPath}" --scenario ${cliScenario}`;
      console.log(`[IaC Configurator] Executing assembler command: ${command}`);

      const { stdout, stderr } = await execAsync(command);
      assemblerOutput = stdout;
      if (stderr) {
        assemblerOutput += `\n[Stderr]\n${stderr}`;
      }
      compilePassed = true;
    } catch (err: any) {
      console.error('[IaC Configurator] Python Assembler failed:', err);
      assemblerOutput = err.stdout || '';
      if (err.stderr) {
        assemblerOutput += `\n[Compiler Errors]\n${err.stderr}`;
      }
      compilePassed = false;
      return NextResponse.json({
        success: false,
        error: 'Preflight compilation check failed',
        message: 'Bicep compiler found validation errors. Check logs.',
        output: assemblerOutput
      }, { status: 422 });
    }

    if (dryRun === true) {
      return NextResponse.json({
        success: true,
        message: 'Dry-run passed — parameters validated & Bicep compiled successfully (no files written).',
        output: assemblerOutput,
        compilePassed,
        dryRun: true
      });
    }

    const parametersJson = {
      $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
      contentVersion: '1.0.0.0',
      parameters: Object.entries(parameters).reduce((acc: any, [key, val]) => {
        acc[key] = { value: val };
        return acc;
      }, {})
    };

    const dir = path.dirname(paramFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(paramFilePath, JSON.stringify(parametersJson, null, 2), 'utf-8');

    const configPath = path.join(projectRoot, '.azure', 'configurator-ui-state.json');
    fs.writeFileSync(configPath, JSON.stringify(body, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Parameters saved & Bicep templates dynamically compiled successfully!',
      path: paramFilePath,
      output: assemblerOutput,
      compilePassed
    });
  } catch (error: any) {
    console.error('Failed to save configuration:', error);
    return NextResponse.json({
      error: 'Failed to write configuration',
      message: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const projectRoot = path.join(process.cwd(), '..');
    const configPath = path.join(projectRoot, '.azure', 'configurator-ui-state.json');

    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return NextResponse.json(JSON.parse(data));
    }
    return NextResponse.json({ message: 'No configuration saved yet' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to read configuration',
      message: error.message
    }, { status: 500 });
  }
}
