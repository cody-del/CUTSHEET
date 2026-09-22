// Read-only extraction: retain only cells reachable from the supported output.
// Run against an exported formula snapshot, before packaging the app.
import fs from 'node:fs';
import {parse} from '../engine.mjs';
const file=new URL('./workbook.json',import.meta.url),workbook=JSON.parse(fs.readFileSync(process.argv[2]||file));
const roots=[];
for(const row of [22,24,25,26,28,29,30,40,41,42,43])for(const col of ['B','D','E','F','G','H','J'])roots.push(['PRINT SHEET',col+row]);
for(const cell of ['D18','E18','F18','G18','H18','I18','J18','H27','H23','B31','E31','F31','H31','D54','D55','L9','J54','L54','J55','L55','J56','L56'])roots.push(['PRINT SHEET',cell]);
for(const cell of ['A12','B12','A13','B13','A14','A15','B26'])roots.push(['CALCULATION (2)',cell]);
for(const cell of ['Q26','P16','P17'])roots.push(['CALCULATION',cell]);
roots.push(['DATA ENTRY  ','A24']);
// T-post outputs, including section-specific rails, louvers, post stock, and tilt rods.
for(const row of [18,19,20,21,22,25,26,32,33,34,35,36,39,40,41,42,43])for(const col of ['B','C','D','E','F','G','H','I','J','L'])roots.push(['T Post Cutsheet',col+row]);
for(const cell of ['D16','E16','F16','G16','H16','I16','J16','H27','B30','E30','F30','H30','L8','D48','D49','D50','K48','L48','K49','L49','K50','L50'])roots.push(['T Post Cutsheet',cell]);
for(const cell of ['D10'])roots.push(['T-POST ',cell]);
for(const cell of ['Y38','P16','P17'])roots.push(['CALCULATION',cell]);
const retained={},visited=new Set();
function walk(sheet,cell){const key=sheet+'!'+cell;if(visited.has(key))return;visited.add(key);retained[sheet]??={};const value=workbook[sheet]?.[cell];if(value!==undefined)retained[sheet][cell]=value;if(typeof value==='string'&&value.startsWith('='))visit(parse(value),sheet);}
function visit(n,sheet){if(n.kind==='ref')walk(n.sheet??sheet,n.cell);else if(n.kind==='range'){const a=/([A-Z]+)(\d+)/.exec(n.start),b=/([A-Z]+)(\d+)/.exec(n.end);const ci=c=>[...c].reduce((n,k)=>n*26+k.charCodeAt(0)-64,0),cs=n=>{let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};for(let r=+a[2];r<=+b[2];r++)for(let c=ci(a[1]);c<=ci(b[1]);c++)walk(n.sheet??sheet,cs(c)+r);}else if(n.kind==='call')n.args.forEach(a=>visit(a,sheet));else if(n.kind==='binary'){visit(n.left,sheet);visit(n.right,sheet);}else if(n.kind==='unary')visit(n.node,sheet);}
roots.forEach(([s,c])=>walk(s,c));
// Runtime overrides need their owning sheet to be present, even if a branch was pruned.
for(const s of ['INPUT SCREEN','DATA ENTRY CALC','CALCULATION'])retained[s]??={};
fs.writeFileSync(file,JSON.stringify(retained));
const cachedPath=new URL('./cached-values.json',import.meta.url);
if(fs.existsSync(cachedPath)){
  const cached=JSON.parse(fs.readFileSync(cachedPath)),fixtures=[];
  for(const[s,cells]of Object.entries(retained))for(const[c,f]of Object.entries(cells))if(typeof f==='string'&&f.startsWith('=')){const expected=cached[s]?.[c];if(expected!==undefined&&!(typeof expected==='string'&&expected.startsWith('#')))fixtures.push({sheet:s,cell:c,expected});}
  fs.writeFileSync(new URL('../test/source-baseline.json',import.meta.url),JSON.stringify(fixtures));
}
console.log(`Retained ${Object.values(retained).reduce((n,x)=>n+Object.keys(x).length,0)} cells across ${Object.keys(retained).length} supporting sheets.`);
