import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parameters, uiState } = body;

    if (!parameters || !uiState) {
      return NextResponse.json({ error: 'Missing parameters or uiState in request body' }, { status: 400 });
    }

    const projectRoot = path.join(process.cwd(), '..');
    const paramFilePath = path.join(projectRoot, '.azure', 'main.parameters.json');
    const assemblerScriptPath = path.join(projectRoot, 'sh', 'iac-assembler.py');

    // 1. Determine scenario for Bicep assembly
    // Match UI scenario to CLI argument
    let cliScenario = 'sandbox';
    if (uiState.activeScenario === 'secure-iot' || uiState.activeScenario === 'global-portal') {
      cliScenario = 'secure-iot'; // The assembler has 'sandbox' and 'secure-iot' templates
    }

    console.log(`[IaC Configurator] Selected Scenario: ${uiState.activeScenario} -> Mapping to Bicep Assembly Preset: ${cliScenario}`);

    // 2. Invoke the Python Assembler to backup, generate Bicep files, and compile check
    let assemblerOutput = '';
    let compilePassed = false;
    try {
      // Execute the Python script
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

    // 3. Create the parameters JSON structure
    const parametersJson = {
      $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
      contentVersion: '1.0.0.0',
      parameters: Object.entries(parameters).reduce((acc: any, [key, val]) => {
        acc[key] = { value: val };
        return acc;
      }, {})
    };

    // Ensure the folder exists
    const dir = path.dirname(paramFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write parameters to file
    fs.writeFileSync(paramFilePath, JSON.stringify(parametersJson, null, 2), 'utf-8');

    // Save UI state
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

