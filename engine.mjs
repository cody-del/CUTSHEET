// A deliberately small, non-eval interpreter for the functions in the source workbook.
// Formulas are preserved verbatim. Unsupported syntax fails closed.
const astCache = new Map();
export class FormulaError extends Error {}
const fail = message => { throw new FormulaError(message); };
const number = x => x === null || x === undefined || x === '' ? 0 : typeof x === 'boolean' ? Number(x) : typeof x === 'number' && Number.isFinite(x) ? x : fail('Non-numeric formula operand');
const truth = x => typeof x === 'string' ? (/^true$/i.test(x) ? true : /^false$/i.test(x) ? false : fail('Invalid logical operand')) : Boolean(x);
function compare(a,b) {
  if(a == null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
  if(b == null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  if(typeof a !== typeof b) { const rank={number:0,string:1,boolean:2}; return rank[typeof a]-rank[typeof b]; }
  if(typeof a === 'string') {a=a.toUpperCase();b=b.toUpperCase();}
  return a===b ? 0 : a<b ? -1 : 1;
}
function tokenize(s) {
  const result=[]; let i=0;
  const re=/\s+|"(?:[^"]|"")*"|'(?:[^']|'')*'|#[A-Z0-9/?!]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?|\$?[A-Za-z_][A-Za-z0-9_.$]*|<>|<=|>=|[+\-*/^&=<>(),:!%]/gy;
  while(i<s.length){re.lastIndex=i;const m=re.exec(s);if(!m)fail(`Unsupported syntax at ${s.slice(i,i+25)}`);i=re.lastIndex;if(!/^\s+$/.test(m[0]))result.push(m[0]);}
  return result;
}
export function parse(formula) {
  if(astCache.has(formula))return astCache.get(formula);
  const tokens=tokenize(formula.slice(1));let i=0;
  const precedence={'=':1,'<>':1,'<':1,'>':1,'<=':1,'>=':1,'&':2,'+':3,'-':3,'*':4,'/':4,'^':5};
  const expect = t => {if(tokens[i++]!==t)fail(`Expected ${t}`);};
  function primary(){
    const t=tokens[i++];if(t===undefined)fail('Missing expression');
    if(t==='+'||t==='-')return {kind:'unary',op:t,node:primary()};
    if(t==='('){const node=expr();expect(')');return node;}
    if(t.startsWith('"'))return {kind:'literal',value:t.slice(1,-1).replaceAll('""','"')};
    if(/^\d|^\.\d/.test(t))return {kind:'literal',value:Number(t)};
    if(t.startsWith('#'))return {kind:'error',value:t};
    if(tokens[i]==='('){i++;const args=[];if(tokens[i]!==')'){while(true){args.push(expr());if(tokens[i]!==',')break;i++;}}expect(')');return {kind:'call',name:t.toUpperCase(),args};}
    let sheet=null,cell=t;
    if(tokens[i]==='!'){i++;sheet=t.startsWith("'")?t.slice(1,-1).replaceAll("''", "'"):t;cell=tokens[i++];}
    if(sheet===null && /^(TRUE|FALSE)$/i.test(t))return {kind:'literal',value:t.toUpperCase()==='TRUE'};
    if(!/^\$?[A-Za-z]+\$?\d+$/.test(cell))fail(`Unsupported reference ${cell}`);
    const node={kind:'ref',sheet,cell:cell.replaceAll('$','').toUpperCase()};
    if(tokens[i]===':'){i++;const end=tokens[i++];if(!/^\$?[A-Za-z]+\$?\d+$/.test(end))fail('Invalid range');return {kind:'range',sheet,start:node.cell,end:end.replaceAll('$','').toUpperCase()};}
    return node;
  }
  function expr(min=0){let left=primary();while(tokens[i]==='%'){i++;left={kind:'unary',op:'%',node:left};}while(precedence[tokens[i]]>=min){const op=tokens[i++],p=precedence[op];left={kind:'binary',op,left,right:expr(p+1)};}return left;}
  const ast=expr();if(i!==tokens.length)fail(`Unexpected token ${tokens[i]}`);astCache.set(formula,ast);return ast;
}
function coordinates(s){const [,letters,row]=/^([A-Z]+)(\d+)$/.exec(s);return [letters.split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),+row];}
function column(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
export class WorkbookEngine {
  constructor(workbook,overrides={}){this.workbook=workbook;this.overrides=overrides;this.cache=new Map();this.active=new Set();}
  cell(sheet,cell){
    const key=sheet+'!'+cell;
    if(this.cache.has(key))return this.cache.get(key);
    if(this.active.has(key))fail(`Circular reference: ${key}`);
    if(!Object.hasOwn(this.workbook,sheet))fail(`Missing sheet: ${sheet}`);
    const value=Object.hasOwn(this.overrides,key)?this.overrides[key]:this.workbook[sheet][cell];
    this.active.add(key);
    try {const result=typeof value==='string'&&value.startsWith('=')?this.evaluate(parse(value),sheet):value??null;this.cache.set(key,result);return result;}
    catch(e){throw new FormulaError(`${key}: ${e.message}`);}
    finally{this.active.delete(key);}
  }
  evaluate(node,sheet){
    const ev=n=>this.evaluate(n,sheet);
    if(node.kind==='literal')return node.value;
    if(node.kind==='error')fail(node.value);
    if(node.kind==='ref')return this.cell(node.sheet??sheet,node.cell);
    if(node.kind==='range'){const [c1,r1]=coordinates(node.start),[c2,r2]=coordinates(node.end),arr=[];if((c2-c1+1)*(r2-r1+1)>10000)fail('Range too large');for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++)arr.push(this.cell(node.sheet??sheet,column(c)+r));return arr;}
    if(node.kind==='unary'){const a=number(ev(node.node));return node.op==='-'?-a:node.op==='%'?a/100:a;}
    if(node.kind==='binary'){
      const a=ev(node.left),b=ev(node.right);
      if(node.op==='&')return String(a??'')+String(b??'');
      if(['=','<>','<','>','<=','>='].includes(node.op)){const c=compare(a,b);return {'=':c===0,'<>':c!==0,'<':c<0,'>':c>0,'<=':c<=0,'>=':c>=0}[node.op];}
      const x=number(a),y=number(b);if(node.op==='/'&&y===0)fail('Division by zero');const v={'+':()=>x+y,'-':()=>x-y,'*':()=>x*y,'/':()=>x/y,'^':()=>x**y}[node.op]();if(!Number.isFinite(v))fail('Non-finite result');return v;
    }
    const {name,args}=node;
    if(name==='IF'){if(args.length<2||args.length>3)fail('IF arity');return truth(ev(args[0]))?ev(args[1]):args[2]?ev(args[2]):false;}
    // Excel evaluates every logical argument, exposing errors rather than silently skipping them.
    const values=args.map(ev),flat=values.flat();
    if(name==='AND')return flat.map(truth).every(Boolean);
    if(name==='OR')return flat.map(truth).some(Boolean);
    if(['SUM','MIN','MAX'].includes(name)){const ns=flat.filter(v=>typeof v==='number');return name==='SUM'?ns.reduce((a,b)=>a+b,0):ns.length?Math[name.toLowerCase()](...ns):0;}
    if(name==='TODAY'||name==='NOW'){const days=Date.now()/86400000+25569;return name==='TODAY'?Math.floor(days):days;}
    const x=number(values[0]);
    if(name==='INT')return Math.floor(x);
    if(name==='ABS')return Math.abs(x);
    if(name==='MOD'){const d=number(values[1]);if(d===0)fail('Division by zero');return x-d*Math.floor(x/d);}
    if(name==='ROUNDUP'){const scale=10**number(values[1]);return Math.sign(x)*Math.ceil(Math.abs(x)*scale)/scale;}
    if(name==='EVEN')return Math.sign(x)*Math.ceil(Math.abs(x)/2)*2;
    if(name==='WEEKDAY'){const day=((Math.floor(x)+6)%7+7)%7;const type=values[1]??1;if(type===1)return day+1;if(type===2)return (day+6)%7+1;if(type===3)return (day+6)%7;fail('Unsupported WEEKDAY type');}
    fail(`Unsupported function ${name}`);
  }
}
