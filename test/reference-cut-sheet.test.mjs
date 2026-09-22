import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../calculations.mjs';

// Independent printed reference supplied by the user:
// FRENCH CUT NEW PROGRAM (2).xlsm - PRINT SHEET - 2026-09-21T194430.054.pdf
// The PDF says SHUTTER FRM. OUTSIDE STILE is a stile label, not the mount.
// The user confirmed Inside mount; shutter-size input reproduces the reference.
const opening={name:'Reference 37.875 x 52.5',width:37.875,height:52.5,quantity:1,
  left:1,right:1,frame:'TR',louver:4,mount:'I',sizeMethod:'S',sides:'4W',
  color:'W',tilt:'Back',stile:'Flat',divider:0,notes:''};
const printedParts=[
  ['Louvers','354.7',24],
  ['Stile · regular','1283.5',2],
  ['Stile · flat','1283.5',2],
  ['Top rail','356.7',2],
  ['Bottom rail','356.7',2],
  ['Top frame','962.0',1],
  ['Bottom frame','962.0',1],
  ['Left frame','1333.5',1],
  ['Right frame','1333.5',1],
  ['Tiltrod','1005.0',2],
];

test('supplied inside-mount shutter-size trim reference matches all printed cuts, quantities, and machining',()=>{
    const r=calculate(opening);
    assert.deepEqual(r.warnings,[]);
    assert.deepEqual(r.parts.map(p=>[p.name,p.length.toFixed(1),p.quantity]),printedParts);
    assert.deepEqual(r.hinges.map(Math.round),[46,443,840,1238]);
    assert.equal(r.machining.find(m=>m.label==='First louver hole from stile top').value.toFixed(1),'344.3');
    assert.equal(r.machining.find(m=>m.label==='Louver midpoint').value.toFixed(1),'177.4');
    assert.equal(r.louversPerPanel,12);
    assert.equal(r.gap.toFixed(1),'8.6');
});

test('inside opening dimensions retain the workbook quarter-inch fitting deduction',()=>{
  const finished=calculate(opening),inside=calculate({...opening,mount:'I',sizeMethod:'W'});
  const value=(r,name)=>r.parts.find(p=>p.name===name).length;
  for(const name of ['Top frame','Bottom frame','Left frame','Right frame','Stile · regular','Stile · flat']){
    assert.ok(Math.abs(value(finished,name)-value(inside,name)-6.35)<1e-8,name);
  }
  for(const name of ['Louvers','Top rail','Bottom rail']){
    assert.ok(Math.abs(value(finished,name)-value(inside,name)-3.175)<1e-8,name);
  }
  assert.equal(value(inside,'Louvers').toFixed(2),'351.54');
  assert.equal(value(inside,'Top rail').toFixed(2),'353.54');
  assert.equal(value(inside,'Tiltrod'),value(finished,'Tiltrod'));
  assert.equal(inside.gap.toFixed(3),'5.475');
});
