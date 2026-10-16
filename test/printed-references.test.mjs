import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../calculations.mjs';
import {drawing} from '../public/layouts.js';
import {printedReferences} from './printed-reference-cases.mjs';

const atPrintPrecision=(actual,expected,decimals,label)=>{
  assert.ok(Number.isFinite(actual),`${label}: missing value`);
  // Printed documents cannot establish more precision than half their display unit.
  // Allow only that rounding interval, plus floating-point noise, not millimeter drift.
  assert.ok(Math.abs(actual-expected)<=0.5*10**-decimals+1e-8,`${label}: ${actual} != printed ${expected}`);
};
for(const ref of printedReferences)test(`printed order ${ref.id}: all cuts, counts, profiles, machining and gap`,()=>{
  const r=calculate(ref.opening);
  assert.deepEqual(r.warnings,[]);
  assert.equal(r.parts.length,ref.parts.length);
  for(const[name,section,length,quantity,profile]of ref.parts){
    const part=r.parts.find(p=>p.name===name&&(p.section??null)===section);
    assert.ok(part,`${name} / ${section}`);
    atPrintPrecision(part.length,length,1,`${name} / ${section}`);
    assert.equal(part.quantity,quantity);assert.equal(part.profile,profile);
  }
  assert.equal(r.hinges.length,ref.hinges.length);
  ref.hinges.forEach((v,i)=>atPrintPrecision(r.hinges[i],v,0,`Hinge ${i+1}`));
  assert.equal(r.machining.length,Object.keys(ref.machining).length);
  for(const [label,value]of Object.entries(ref.machining))atPrintPrecision(r.machining.find(m=>m.label===label)?.value,value,1,label);
  atPrintPrecision(r.gap,ref.gap,1,'Light gap');assert.equal(r.louversPerPanel,ref.louversPerPanel);
});

test('split tilt mode is explicit, preserves legacy jobs, and applies the source allowance',()=>{
  const ref=printedReferences[3].opening;
  const split=calculate(ref),standard=calculate({...ref,divisionMode:'divider'});
  assert.equal(split.parts.find(p=>p.name==='Tiltrod').length,1242);
  assert.equal(standard.parts.find(p=>p.name==='Tiltrod').length,1260);
  assert.deepEqual(calculate({...ref,divisionMode:undefined}),standard);
  assert.deepEqual(split.parts.filter(p=>p.name!=='Tiltrod'),standard.parts.filter(p=>p.name!=='Tiltrod'));
  assert.equal(split.gap,standard.gap);
  assert.throws(()=>calculate({...ref,divisionMode:'unknown'}),/divider rail or split tilt rod/);
  const triple=calculate({...ref,quantity:3});
  split.parts.forEach((p,i)=>{assert.equal(triple.parts[i].quantity,p.quantity*3);assert.equal(triple.parts[i].length,p.length);});
});

test('a split position produces separate rods without drawing or cutting a divider rail',()=>{
  for(const base of [printedReferences[0].opening,printedReferences[3].opening]){
    const opening={...base,width:base.tposts?base.width:36,height:60,divisionMode:'split',divider:30,tilt:'Front'};
    const r=calculate(opening),withRail=calculate({...opening,divisionMode:'divider'});
    assert.deepEqual(r.warnings,[]);
    assert.equal(r.parts.filter(p=>p.name==='Divider rail').length,0);
    assert.ok(withRail.parts.some(p=>p.name==='Divider rail'));
    assert.ok(r.parts.some(p=>p.name==='Tiltrod · bottom'));
    assert.ok(r.parts.some(p=>p.name==='Tiltrod · top'));
    const scene=drawing(opening),railScene=drawing({...opening,divisionMode:'divider'});
    assert.equal(railScene.shapes.length-scene.shapes.length,scene.leaves.length);
  }
});
