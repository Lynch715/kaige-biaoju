import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'index.html should contain an inline game script');
new Function(script);

const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, {
    id,
    disabled: false,
    innerHTML: '',
    textContent: '',
    open: false,
    classList: { add() {}, remove() {}, toggle() {} },
    showModal() { this.open = true; },
    close() { this.open = false; }
  });
  return elements.get(id);
};

const context = vm.createContext({
  console,
  Math,
  Date,
  JSON,
  setInterval: () => 1,
  clearInterval() {},
  setTimeout() {},
  confirm: () => true,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    getElementById: element,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ textContent: '', innerHTML: '' })
  }
});
vm.runInContext(script, context);

const run = source => vm.runInContext(source, context);
assert.equal(run('VERSION'), 2, 'save schema should be version 2');
assert.equal(run('roadEvents.length'), 20, 'vertical slice should ship exactly 20 road events');
assert.equal(run('roadEvents.every(e => e.id && e.title && e.text && e.choices.length === 2)'), true, 'each road event should have two real choices');
assert.equal(run('roadEvents.flatMap(e => e.choices).every(c => c.label && c.skill && c.hint)'), true, 'event choices should expose their skill and consequence hint');
assert.equal(run('roadEvents.every(e => e.choices.some(c => !c.cost && !c.supplyCost))'), true, 'every event should keep a resource-free escape choice');
assert.equal(run('Object.values(routePlans).every(r => Object.values(r).every(nodes => nodes.length === 4))'), true, 'every route style should provide four pre-destination nodes');
assert.equal(run("buildRouteNodes('north','大同','safe').length"), 5, 'a playable route should contain five nodes');
assert.equal(run('chainDef.stages.length'), 3, 'the first continuous escort should have three stages');

const fresh = run('fresh()');
assert.equal(fresh.chain.stage, 0);
assert.equal(fresh.staff.every(s => s.injury === null), true);
run('S=fresh();S.trust=12');
assert.equal(run('currentChainContract().isChain'), true, 'continuous escort should unlock at trust 12');
assert.equal(run('currentChainContract().chainStage'), 0);
run(`globalThis.testEscort={
  team:[1,2,3],metrics:{force:70,scout:60,talk:55,ride:62},injuries:[],
  supplies:0,maxSupplies:6,morale:100,risk:20,shortage:0,dest:'通州'
}`);
assert.ok(run('injureEscort(testEscort,1)'), 'forced injury should produce an injury record');
assert.equal(run('testEscort.injuries.length'), 1);
const riskBeforeShortage = run('testEscort.risk');
run('consumeSupply(testEscort)');
assert.ok(run('testEscort.risk') > riskBeforeShortage, 'running out of supplies should raise route risk');
assert.ok(run('testEscort.morale') < 100, 'running out of supplies should lower morale');

const migrated = run(`normalizeState({
  version:1,trust:8,staff:baseStaff().map(s=>{const x={...s};delete x.injury;return x}),
  records:[],news:[],familiarity:{near:5,north:0,canal:0,west:0,south:0},escort:null
})`);
assert.equal(migrated.version, 2);
assert.equal(migrated.staff.every(s => s.injury === null), true);
assert.equal(migrated.chain.status, 'locked');

console.log('vertical slice structure: OK');
