import { chromium } from "playwright";
import fs from "node:fs/promises";

const LIMIT = 709.99;
const TARGET = /Nintendo Switch.{0,30}2.{0,80}Legend of Zelda.{0,30}40th Anniversary Edition/i;
const retailers = [
  {name:"Nintendo Canada", url:"https://www.nintendo.com/en-ca/store/hardware/", kind:"nintendo"},
  {name:"Best Buy Canada", url:"https://www.bestbuy.ca/en-ca/product/nintendo-switch-2-console-the-legend-of-zelda-40th-anniversary-edition/20149861", kind:"bestbuy"},
  {name:"Amazon Canada", url:"https://www.amazon.ca/s?k=Nintendo+Switch+2+Zelda+40th+Anniversary+Edition", kind:"amazon"},
  {name:"Walmart Canada", url:"https://www.walmart.ca/search?q=Nintendo%20Switch%202%20Zelda%2040th%20Anniversary%20Edition", kind:"walmart"}
];

function parsePrice(text) {
  const vals = [...text.matchAll(/\$\s?([\d,]+\.\d{2})/g)].map(m=>Number(m[1].replace(",","")));
  return vals.find(v=>v>100 && v<3000) ?? null;
}
function availability(text, kind) {
  const t=text.toLowerCase();
  if (/sold out|out of stock|currently unavailable|unavailable online|not available online/.test(t)) return "OUT_OF_STOCK";
  if (kind==="bestbuy" && /add to cart|add to bag/.test(t)) return "IN_STOCK";
  if (kind==="nintendo" && /add to cart|add to bag|buy now/.test(t)) return "IN_STOCK";
  if (kind==="amazon" && /add to cart|in stock|ships from and sold by amazon\.ca/.test(t)) return "IN_STOCK";
  if (kind==="walmart" && /add to cart|in stock/.test(t)) return "IN_STOCK";
  if (/add to cart|add to basket|in stock/.test(t)) return "IN_STOCK";
  return "REVIEW";
}
async function check(browser, retailer) {
  const page=await browser.newPage({locale:"en-CA"});
  try {
    await page.goto(retailer.url,{waitUntil:"domcontentloaded",timeout:45000});
    await page.waitForTimeout(3500);
    const title=await page.title();
    const body=(await page.locator("body").innerText({timeout:10000})).slice(0,120000);
    const matching=TARGET.test(title+" "+body) || retailer.kind==="nintendo" && /40th Anniversary Edition/.test(body);
    if(!matching) return {name:retailer.name,status:"REVIEW",price:null,detail:"Could not confidently identify the exact anniversary console listing.",url:retailer.url};
    const marker=body.search(/40th Anniversary Edition/i);
    const productContext=marker>=0 ? body.slice(Math.max(0,marker-900),Math.min(body.length,marker+1800)) : body;
    const price=parsePrice(productContext);
    let sellerOk=true;
    if(retailer.kind==="bestbuy") sellerOk=/sold and shipped by best buy/i.test(body);
    if(retailer.kind==="amazon") sellerOk=/ships from and sold by amazon\.ca/i.test(body);
    if(retailer.kind==="walmart") sellerOk=/sold and shipped by walmart/i.test(body);
    if(!sellerOk) return {name:retailer.name,status:"REVIEW",price,detail:"Seller could not be verified as the retailer itself; Marketplace offers excluded.",url:retailer.url};
    if(price===null || price>LIMIT) return {name:retailer.name,status:"REVIEW",price,detail:price===null?"Could not verify the item price.":"Price is above the $709.99 CAD limit.",url:retailer.url};
    const stock=availability(body,retailer.kind);
    return {name:retailer.name,status:stock,price,detail:stock==="IN_STOCK"?`Retailer page indicates stock at $${price.toFixed(2)} CAD.`:stock==="OUT_OF_STOCK"?"Retailer page reports sold out.":"Availability wording needs manual review.",url:retailer.url};
  } catch(e) {
    return {name:retailer.name,status:"REVIEW",price:null,detail:"Retailer page could not be checked: "+String(e.message).slice(0,100),url:retailer.url};
  } finally { await page.close(); }
}
const browser=await chromium.launch({headless:true});
const results=[];
for(const r of retailers) results.push(await check(browser,r));
await browser.close();

const path="status.json";
let previous={retailers:[]};
try { previous=JSON.parse(await fs.readFile(path,"utf8")); } catch {}
const old=new Map((previous.retailers||[]).map(x=>[x.name,x.status]));
const newlyInStock=results.filter(x=>x.status==="IN_STOCK" && old.get(x.name)!=="IN_STOCK");
const output={checkedAt:new Date().toISOString(),referencePrice:LIMIT,currency:"CAD",retailers:results};
await fs.writeFile(path,JSON.stringify(output,null,2)+"\n");

if(newlyInStock.length && process.env.RESEND_API_KEY && process.env.ALERT_EMAIL && process.env.FROM_EMAIL) {
  const lines=newlyInStock.map(x=>`${x.name}: $${x.price.toFixed(2)} CAD\n${x.url}`).join("\n\n");
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",headers:{"Authorization":`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({from:process.env.FROM_EMAIL,to:[process.env.ALERT_EMAIL],subject:"Zelda 40th Anniversary Switch 2 — qualifying stock found!",text:`A qualifying retailer listing was detected:\n\n${lines}\n\nReference price: $709.99 CAD. Check the retailer page immediately; stock can disappear quickly.`})
  });
  if(!response.ok) throw new Error("Email send failed: "+await response.text());
}
console.log(JSON.stringify(output,null,2));