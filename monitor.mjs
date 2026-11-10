import { chromium } from "playwright";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, ALERT_EMAIL, FROM_EMAIL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY GitHub secrets.");
const headers={apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,"Content-Type":"application/json"};
async function api(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { ...headers, ...opts.headers }
  });

  const body = await r.text();

  if (!r.ok) {
    throw new Error(`Supabase ${r.status}: ${body}`);
  }

  return body ? JSON.parse(body) : null;
}
const products=await api('products?enabled=eq.true&select=*');const retailers=await api('retailers?enabled=eq.true&select=*');
function priceIn(text){const a=[...text.matchAll(/\$\s?([\d,]+\.\d{2})/g)].map(m=>Number(m[1].replace(/,/g,'')));return a.find(x=>x>20&&x<10000)??null}
function stock(text, kind) {
  const t = text.toLowerCase();

  const unavailable =
    /sold out|out of stock|currently unavailable|unavailable online|not available online|not available for pickup|coming soon/.test(t);

  if (unavailable) return 'OUT_OF_STOCK';

  // Avoid treating general promotional wording as proof of stock.
  if (kind === 'bestbuy') {
    return 'REVIEW';
  }

  const available =
    /add to cart|add to bag|add to basket|in stock/.test(t);

  if (available) return 'IN_STOCK';

  return 'REVIEW';
}
async function check(browser,p,r){const page=await browser.newPage({locale:'en-CA'});
                                  try{
                                    await page.goto(r.url,{waitUntil:'domcontentloaded',timeout:45000});
                                    await page.waitForTimeout(5000);

console.log('DEBUG RETAILER:', r.name);
console.log('DEBUG URL:', page.url());
console.log('DEBUG TITLE:', await page.title());
console.log('DEBUG BODY:', (await page.locator('body').innerText().catch(() => '')).slice(0, 1500));
                                                                                         await page.waitForTimeout(2500);
                                                                                         const pageTitle = await page.title();
const heading = await page.locator('h1').first().innerText().catch(() => '');
const title = `${pageTitle} ${heading}`;;const body=(await page.locator('body').innerText({timeout:10000})).slice(0,100000);
const titleText = `${pageTitle} ${heading}`
  .replace(/[™®©]/g, '')
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const productMatch =
  /nintendo switch 2/.test(titleText) &&
  /zelda/.test(titleText) &&
  /(40th|fortieth|anniversary)/.test(titleText);

const excludedProduct =
  /\b(game|controller|case|cover|charger|accessory|accessories|amiibo)\b/.test(titleText);

if (!productMatch || excludedProduct) {
  return {
    status: 'REVIEW',
    price: null,
    detail: `Match: ${productMatch}. Excluded: ${excludedProduct}. Normalised title: "${titleText}".`
  };
}
                                                                                         const idx=body.toLowerCase().indexOf(p.keywords.toLowerCase().split(/\s+/).slice(-3).join(' '));const context=idx>=0?body.slice(Math.max(0,idx-700),idx+1800):body;const price=priceIn(context);if(p.ignore_marketplace){const sellerKnown=/sold and shipped by|ships from and sold by/i.test(body);const sellerOk=r.kind==='amazon'?/ships from and sold by amazon\.ca/i.test(body):r.kind==='bestbuy'?/sold and shipped by best buy/i.test(body):r.kind==='walmart'?/sold and shipped by walmart/i.test(body):r.kind==='nintendo'?true:/sold and shipped by [^\n]+/i.test(body);if(sellerKnown&&!sellerOk)return {status:'REVIEW',price,detail:'Third-party seller detected; excluded.'};if(['amazon','bestbuy','walmart'].includes(r.kind)&&!sellerOk)return {status:'REVIEW',price,detail:'Could not verify the retailer as seller; Marketplace offers excluded.'};}
if(price===null||price>Number(p.max_price))return {status:'REVIEW',price,detail:price===null?'Could not verify item price.':`Price exceeds your ${p.currency} ${Number(p.max_price).toFixed(2)} limit.`};const status=stock(body,r.kind);return {status,price,detail:status==='IN_STOCK'?`Page indicates stock at ${p.currency} ${price.toFixed(2)}.`:status==='OUT_OF_STOCK'?'Retailer page reports sold out.':'Availability wording needs manual review.'};}catch(e){return {status:'REVIEW',price:null,detail:'Page check failed: '+String(e.message).slice(0,120)}}finally{await page.close()}}
const browser=await chromium.launch({headless:true});const output=[];try{for(const p of products){for(const r of retailers.filter(x=>x.product_id===p.id)){const result=await check(browser,p,r);const old=await api(`stock_state?product_id=eq.${p.id}&retailer_id=eq.${r.id}&select=status`);const was=old?.[0]?.status;const row={product_id:p.id,retailer_id:r.id,status:result.status,price:result.price,detail:result.detail,checked_at:new Date().toISOString()};await api('stock_state?on_conflict=product_id,retailer_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});output.push({product:p.name,retailer:r.name,url:r.url,...result,checkedAt:row.checked_at});if(result.status==='IN_STOCK'&&was!=='IN_STOCK'&&RESEND_API_KEY&&FROM_EMAIL&&(p.alert_email||ALERT_EMAIL)){const to=p.alert_email||ALERT_EMAIL;const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:FROM_EMAIL,to:[to],subject:`Stock alert: ${p.name}`,text:`A qualifying listing was detected.\n\nProduct: ${p.name}\nRetailer: ${r.name}\nPrice: ${p.currency} ${result.price.toFixed(2)}\n${r.url}\n\nPlease verify availability immediately; stock can disappear quickly.`})});if(!resp.ok)throw new Error('Email send failed: '+await resp.text())}}}}finally{await browser.close()}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),results:output},null,2));
