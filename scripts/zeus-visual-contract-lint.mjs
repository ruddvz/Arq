#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const path=process.argv[2]; if(!path){console.error('Usage: zeus-visual-contract-lint <spec.md>');process.exit(2);} const text=readFileSync(path,'utf8');
const required=[
 ['role/primary task',/role|primary task/i],
 ['data/content fixture',/fixture|test data|content source/i],
 ['responsive/device matrix',/responsive|viewport|desktop.*tablet.*phone|device matrix/is],
 ['complete states',/state matrix|loading.*empty.*error|permission.*offline/is],
 ['keyboard/focus',/keyboard|focus/i],
 ['touch/Pencil target',/touch|pencil|44\s*(?:px|×|x)/i],
 ['tokens/canonical assets',/token|canonical asset|logo|icon/i],
 ['overflow/long content',/overflow|wrapping|truncation|long text/i],
 ['DPR/zoom/font environment',/device pixel ratio|\bdpr\b|200%|font build|zoom/i],
 ['visual regression',/screenshot|visual regression|baseline|diff/i],
 ['accessibility',/screen reader|accessibility|contrast|non-colour/i],
 ['acceptance criteria',/acceptance/i]
];
const missing=required.filter(([,r])=>!r.test(text)).map(([n])=>n); if(missing.length){console.error(`Visual contract incomplete: ${missing.join(', ')}`);process.exit(1);} console.log('Visual contract lint passed.');
