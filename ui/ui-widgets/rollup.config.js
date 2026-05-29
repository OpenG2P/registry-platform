import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import image from '@rollup/plugin-image';
import dts from 'rollup-plugin-dts';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      image(),
      resolve({
        browser: true,
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts', '**/*.test.tsx'],
        declaration: true,
        declarationDir: './dist',
      }),
    ],
    external: [
      'react',
      'react-dom',
      '@reduxjs/toolkit',
      'react-redux',
      'zod',
      'i18next',
      'react-i18next',
      'lodash.get',
      'lodash.set',
      'json-edit-react',
    ],
  },
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'esm' }],
    plugins: [
      dts({
        tsconfig: './tsconfig.json',
      }),
    ],
    external: [
      'react',
      'react-dom',
      '@reduxjs/toolkit',
      'react-redux',
      'zod',
      'i18next',
      'react-i18next',
    ],
  },
];

