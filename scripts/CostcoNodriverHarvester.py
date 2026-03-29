import os
import re
import json
import time
import random
import hashlib
import asyncio
import requests
import traceback
from urllib.parse import unquote
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

# Configuration
QUEUE_FILE = "scripts/costco_queue.json"
DONE_FILE = "scripts/costco_done.txt"
LOG_FILE = "scripts/costco_ingestion.log"
UPLINK_URL = os.getenv("CF_WORKER_URL")

# Proxy Configuration (RESIDENTIAL - 1GB LIMIT)
PROXY_USER = os.getenv("WEBSHARE_USER", "yfoojooh")
PROXY_PASS = os.getenv("WEBSHARE_PASS", "un6c7ocgz8uz")
PROXY_URL = "http://23.95.150.145:6114"

def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def generate_deterministic_id(url):
    return f"GS1-COSTCO-{hashlib.sha256(url.encode()).hexdigest()[:12]}"

class IndustrialCostcoFleet:
    def __init__(self):
        self.queue = []
        self.done = set()
        self.total_bytes = 0
        
        if os.path.exists(QUEUE_FILE):
            with open(QUEUE_FILE, 'r') as f:
                raw = json.load(f)
                self.queue = [u.strip() for u in raw if '/fr/' not in u]
        
        if os.path.exists(DONE_FILE):
            with open(DONE_FILE, 'r') as f:
                self.done = set(line.strip() for line in f)
        
        log(f"🏗️ [Industrial] Initialized (Ninjutsu v56.17). Queue: {len(self.queue)} | Stashed: {len(self.done)}")

    async def block_resources(self, route):
        r_type = route.request.resource_type
        if r_type in ["image", "media", "font"]:
            await route.abort()
        else:
            await route.continue_()

    async def ingest_catalog(self, batch_limit=50):
        targets = [u for u in self.queue if u not in self.done][:batch_limit]
        if not targets:
            log("🏁 [Finish] No pending targets.")
            return

        async with async_playwright() as p:
            log(f"🚀 [Fleet] Launching Proxied Playwright session...")
            
            # Browser Hardening (v56.17)
            browser_args = {
                "headless": True,
                "args": ["--disable-http2", "--no-sandbox", "--disable-setuid-sandbox"]
            }
            
            if not os.getenv("GITHUB_ACTIONS"):
                browser_args["proxy"] = {"server": PROXY_URL, "username": PROXY_USER, "password": PROXY_PASS}

            browser = await p.chromium.launch(**browser_args)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                viewport={'width': 1920, 'height': 1080}
            )
            
            page = await context.new_page()
            await Stealth().apply_stealth_async(page)
            # Re-enable resource blocking for speed
            await page.route("**/*", self.block_resources)
            
            try:
                # MANEUVER 3: Warm up with Home Page (Optimized)
                log("🏠 [Warmup] Seeding session cookies via Costco Home...")
                await page.goto("https://www.costco.ca/", wait_until="domcontentloaded", timeout=45000)
                await asyncio.sleep(12)
                
                for i, raw_url in enumerate(targets):
                    try:
                        # MANEUVER 2: Unquote URL
                        url = unquote(raw_url)
                        log(f"🚢 [Scout] Surveying ({i+1}/{len(targets)}): {url.split('/')[-1]}")
                        
                        # 1. Primary Attempt
                        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                        await asyncio.sleep(5)
                        
                        html = await page.content()
                        self.total_bytes += len(html)
                        
                        blocks = []
                        if "Access Denied" in html or "Access Denied" in (await page.title()) or len(html) < 5000:
                            log("🛑 [Block] Akamai detected. (Soft-Reset or 403)")
                            # Fallback logic could go here, but with HTTP/1.1 it should work
                        else:
                            blocks = await page.evaluate("() => Array.from(document.querySelectorAll(\"script[type*='ld+json']\")).map(s => s.innerText)")
                        
                        if not blocks and not "Access Denied" in html:
                            soup = BeautifulSoup(html, 'html.parser')
                            blocks = [s.string for s in soup.find_all("script", type=re.compile(r"application/ld\+json", re.I)) if s.string]

                        product = None
                        def deep_search(data):
                            if isinstance(data, list):
                                for item in data:
                                    res = deep_search(item)
                                    if res: return res
                            elif isinstance(data, dict):
                                t = str(data.get("@type", ""))
                                if "Product" in t: return data
                                for v in data.values():
                                    if isinstance(v, (dict, list)):
                                        res = deep_search(v)
                                        if res: return res
                            return None

                        for b in (blocks or []):
                            try:
                                clean_json = re.sub(r'//.*', '', b.strip())
                                data = json.loads(clean_json)
                                product = deep_search(data)
                                if product: break
                            except: continue
                        
                        if product and (product.get("sku") or product.get("gtin14")):
                            p_sku = str(product.get("sku") or "N/A")
                            p_name = product.get("name", "Unknown Item")
                            p_brand_obj = product.get("brand", "Costco")
                            p_brand = p_brand_obj.get("name", "Costco") if isinstance(p_brand_obj, dict) else str(p_brand_obj)
                            full_name = f"{p_brand} {p_name}"
                            
                            # Uplink
                            requests.post(UPLINK_URL, json={
                                "id": generate_deterministic_id(url),
                                "product_name": full_name,
                                "scout_id": "Costco-Ninjutsu-v56"
                            }, timeout=10)
                            
                            with open(DONE_FILE, "a") as f: f.write(raw_url + "\n")
                            self.done.add(raw_url)
                            log(f"💎 [Stashed] {p_sku} | {full_name}")
                        else:
                            log(f"⚠️ [Empty] No signature found. | Content-Length: {len(html)/1024:.1f}KB")
                            
                        await asyncio.sleep(random.uniform(5.0, 10.0))
                    except Exception as e:
                        log(f"❌ [Fail] Scout lost: {str(e)[:100]}")
                        
            finally:
                await browser.close()

async def run_mission():
    fleet = IndustrialCostcoFleet()
    await fleet.ingest_catalog(batch_limit=10) # Small batch for validation

if __name__ == "__main__":
    asyncio.run(run_mission())
