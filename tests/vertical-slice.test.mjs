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
assert.equal(run('VERSION'), 3, 'save schema should be version 3');
assert.equal(run('roadEvents.length'), 22, 'slice should ship exactly 22 road events');
assert.equal(run('roadEvents.every(e => e.id && e.title && e.text && e.choices.length === 2)'), true, 'each road event should have two real choices');
assert.equal(run('roadEvents.flatMap(e => e.choices).every(c => c.label && c.skill && c.hint)'), true, 'event choices should expose their skill and consequence hint');
assert.equal(run('roadEvents.every(e => e.choices.some(c => !c.cost && !c.supplyCost))'), true, 'every event should keep a resource-free escape choice');
assert.equal(run('roadEvents.filter(e => e.chainOnly).every(e => e.chainId)'), true, 'chain-only events should be bound to a chain');
assert.equal(run('Object.values(routePlans).every(r => Object.values(r).every(nodes => nodes.length === 4))'), true, 'every route style should provide four pre-destination nodes');
assert.equal(run("buildRouteNodes('north','大同','safe').length"), 5, 'a playable route should contain five nodes');
assert.equal(run('chainDefs.length'), 3, 'three legendary continuous escorts should exist');
assert.equal(run('chainDefs.every(d => d.stages.length === 3 && d.finalTitle && d.rumor)'), true, 'each chain should have three stages, a final title and a rumor');

const fresh = run('fresh()');
assert.equal(fresh.chains.longmen.stage, 0);
assert.equal(Object.keys(fresh.chains).length, 3);
assert.equal(fresh.rivals.length, 5, 'five rival agencies should be live');
assert.equal(fresh.nemeses.length, 0);
assert.equal(fresh.goalsDone.length, 0);
assert.equal(fresh.staff.every(s => s.injury === null), true);
run('S=fresh();S.trust=12');
assert.equal(run('currentChainContract(chainDefs[0]).isChain'), true, 'continuous escort should unlock at trust 12');
assert.equal(run('currentChainContract(chainDefs[0]).chainId'), 'longmen');
assert.equal(run('currentChainContract(chainDefs[1])'), null, 'hanya chain should stay locked below fame 30');
run('S.fame=30');
assert.equal(run('currentChainContract(chainDefs[1]).chainId'), 'hanya', 'hanya chain should unlock at fame 30');

run("spawnNemesis('north','测试：')");
assert.equal(run('S.nemeses.length'), 1, 'a nemesis should be born from a botched fight');
assert.equal(run('S.nemeses[0].status'), 'active');
const nemEv = run('nemesisEvent(S.nemeses[0])');
assert.equal(nemEv.choices.length, 3, 'nemesis ambush should offer fight, pay and trap');
assert.ok(nemEv.dynamic && nemEv.nemesisId, 'nemesis event should be dynamic and traceable');
run("S.nemeses[0].status='dead';S.nemeses.push({status:'settled'},{status:'dead'})");
assert.equal(run("goalDefs.find(g => g.id === 'grudge').check()"), true, 'three resolved nemeses should satisfy the grudge goal');
run('S.nemeses=[]');

assert.equal(run('goalDefs.length'), 5, 'five fame goals should chart the road to the grand ending');
assert.equal(run('fameBoard().length'), 6, 'fame board should rank five rivals plus the player');
assert.ok(run('fameBoard().some(b => b.me)'), 'the player agency should appear on the board');
assert.equal(run('rank()'), 1 + fresh.rivals.filter(r => r.fame > 30).length, 'rank should be derived from live rival fame');
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
assert.equal(migrated.version, 3);
assert.equal(migrated.staff.every(s => s.injury === null), true);
assert.equal(migrated.chains.longmen.status, 'locked');
assert.equal(migrated.rivals.length, 5, 'v1 saves should gain live rivals');
assert.equal(migrated.nemeses.length, 0, 'v1 saves should gain an empty nemesis ledger');

const migratedV2 = run(`normalizeState({
  version:2,trust:20,staff:baseStaff(),records:[],news:[],
  familiarity:{near:5,north:0,canal:0,west:0,south:0},
  chain:{id:'longmen',stage:1,status:'active',setbacks:2,completedAt:null},
  escort:{isChain:true,chainStage:1,region:'north',dest:'宣府',progress:30,periods:6,provision:'standard',metrics:{force:60,scout:50,talk:50,ride:55},team:[1,2]}
})`);
assert.equal(migratedV2.chains.longmen.stage, 1, 'v2 chain progress should carry over');
assert.equal(migratedV2.chains.longmen.setbacks, 2);
assert.equal(migratedV2.chain, undefined, 'legacy chain field should be dropped');
assert.equal(migratedV2.escort.chainId, 'longmen', 'an in-flight chain escort should be re-bound to longmen');

console.log('vertical slice structure: OK');
