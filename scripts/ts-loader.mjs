import fs from 'fs';
import path from 'path';
import ts from './../node_modules/typescript/lib/typescript.js';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');

export async function resolve(specifier, context, defaultResolve) {
  let target = specifier;
  if (specifier.startsWith('@/')) {
    target = path.join(srcDir, specifier.slice(2));
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    if (context.parentURL) {
      const parentPath = new URL(context.parentURL).pathname;
      target = path.resolve(path.dirname(parentPath), specifier);
    }
  }

  // Try extensions if target doesn't exist
  if (!target.startsWith('node:') && !target.includes('node_modules') && !target.startsWith('http')) {
    const candidates = [
      target,
      target + '.ts',
      target + '.tsx',
      target + '.js',
      path.join(target, 'index.ts'),
      path.join(target, 'index.tsx'),
      path.join(target, 'index.js')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return {
          url: new URL('file://' + c).href,
          shortCircuit: true
        };
      }
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.startsWith('file://') && (url.endsWith('.ts') || url.endsWith('.tsx'))) {
    const filePath = new URL(url).pathname;
    const source = fs.readFileSync(filePath, 'utf8');
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      },
      fileName: filePath
    });
    return {
      format: 'module',
      source: result.outputText,
      shortCircuit: true
    };
  }
  return defaultLoad(url, context, defaultLoad);
}
