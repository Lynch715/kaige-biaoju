import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
// PLAYWRIGHT_MODULE can point at a bundled Playwright installation; no npm install required.
const {webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const baseline=process.argv.includes('--baseline');
const out=new URL('../output/playwright/',import.meta.url);
mkdirSync(out,{recursive:true});
const browser=await webkit.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1100,height:1100}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(baseline){
    const html=execFileSync('git',['show','HEAD:index.html'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
    await page.route('**/index.html*',route=>route.fulfill({body:html,contentType:'text/html'}));
  }
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:8791')+'/tests/dialog-audit.html');
  await page.locator('#result').filter({hasText:'就绪'}).waitFor();
  await page.getByRole('button',{name:'查看晨雾事件（393×852）',exact:true}).click();
  await page.locator('#result').filter({hasText:'393×852 · 晨雾吞没三岔口'}).waitFor();
  const fog=await page.frameLocator('#game').locator('#eventDialog').evaluate(d=>({height:d.getBoundingClientRect().height,bodyHeight:d.querySelector('.dbody').clientHeight,scrollHeight:d.querySelector('.dbody').scrollHeight}));
  await page.locator('#game').screenshot({path:fileURLToPath(new URL(baseline?'webkit-before.png':'webkit-after.png',out))});
  await page.getByRole('button',{name:'运行全部检查',exact:true}).click();
  await page.waitForFunction(()=>Array.isArray(window.auditResults),{},{timeout:180000});
  const results=await page.evaluate(()=>window.auditResults);
  const report={engine:browser.version(),baseline,fog,total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),errors};
  writeFileSync(new URL(baseline?'webkit-before.json':'webkit-after.json',out),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(!baseline&&(report.failed.length||errors.length))process.exitCode=1;
}finally{await browser.close()}
