"""Explore Cathay's new-booking page with a fresh anonymous browser.

No booking reference, surname, account or purchase. Log only safe UI metadata
and API host/path/status; never log cookies, tokens, querystrings or response bodies.
"""
import json
import re
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

HOMES = [
    "https://flights.cathaypacific.com/en_GB.html",
    "https://www.cathaypacific.com/cx/en_GB.html",
    "https://book.cathaypacific.com/",
]

def sanitized(url):
    parsed = urlsplit(url)
    return parsed.hostname, parsed.path[:160]

def snapshot(page, label):
    print("STAGE",label,"url_path",sanitized(page.url),flush=True)
    try:
        info=page.evaluate("""() => ({
          title:document.title,
          visibleText:(document.body?.innerText||'').slice(0,2800),
          inputs:[...document.querySelectorAll('input')].slice(0,30).map((e,i)=>({
            i,type:e.type,placeholder:e.getAttribute('placeholder'),
            ariaLabel:e.getAttribute('aria-label'),role:e.getAttribute('role'),
            name:e.getAttribute('name'),id:e.id,
            parentText:(e.parentElement?.parentElement?.innerText||'').slice(0,95)
          })),
          selects:[...document.querySelectorAll('select')].slice(0,15).map(e=>({
            name:e.name,ariaLabel:e.getAttribute('aria-label'),
            options:[...e.options].slice(0,7).map(o=>o.textContent.trim())
          })),
          buttons:[...document.querySelectorAll('button,[role=button]')].filter(e=>e.getBoundingClientRect().width>0)
            .slice(0,80).map(e=>({
              text:(e.innerText||'').trim().slice(0,65),
              ariaLabel:e.getAttribute('aria-label'),
              className:typeof e.className==='string'?e.className.slice(0,70):''
            }))
        })""")
        print(json.dumps(info,ensure_ascii=False)[:12500],flush=True)
    except Exception as e:
        print("SNAPSHOT_ERROR",type(e).__name__,str(e)[:150],flush=True)

def main():
    with sync_playwright() as p:
        browser=p.firefox.launch(headless=True)
        context=browser.new_context(locale="en-GB",timezone_id="Europe/London",viewport={"width":1365,"height":920})
        page=context.new_page()
        seen=set()
        def on_response(r):
            req=r.request
            host,path=sanitized(r.url)
            if host and "cathaypacific.com" in host and req.resource_type in ("fetch","xhr"):
                marker=(req.method,host,path,r.status)
                if marker not in seen and len(seen)<110:
                    seen.add(marker)
                    print("API",json.dumps({"method":req.method,"host":host,"path":path,"status":r.status}),flush=True)
        context.on("response",on_response)
        try:
            loaded = False
            for candidate in HOMES:
                try:
                    response = page.goto(candidate, wait_until="domcontentloaded", timeout=25000)
                    print("NAVIGATE", sanitized(candidate), response.status if response else None, flush=True)
                    page.wait_for_timeout(4000)
                    snapshot(page,"landing")
                    if response and response.status < 400:
                        loaded = True
                        break
                except Exception as err:
                    print("NAVIGATE_ERROR", sanitized(candidate), type(err).__name__, str(err)[:180],flush=True)
            if not loaded:
                print("NO_USABLE_BOOKING_PAGE",flush=True)
                return
            # Only interact with controls for a public flight search.
            # Never enter personal details or pass through checkout.
            for text in ("Accept all cookies","Accept all","Accept Cookies"):
                loc=page.get_by_role("button",name=text,exact=False)
                if loc.count() and loc.first.is_visible():
                    loc.first.click(timeout=3000)
                    page.wait_for_timeout(500)
                    break
            for text in ("One way","One-way"):
                loc=page.get_by_text(text,exact=True)
                if loc.count() and loc.first.is_visible():
                    try:
                        loc.first.click(timeout=4000)
                        print("CLICK","one-way",flush=True)
                        page.wait_for_timeout(1000)
                    except Exception as e:
                        print("CLICK_ERROR",str(e)[:200],flush=True)
                    break
            snapshot(page,"oneway")
            def options(label):
                found=page.evaluate("""() => [...document.querySelectorAll('[role=option],li,[role=listbox],.dropdown__item')].filter(e=>{
                  const r=e.getBoundingClientRect(); return r.width>0&&r.height>0;
                }).slice(0,45).map(e=>({
                  tag:e.tagName,role:e.getAttribute('role'),
                  text:(e.innerText||'').trim().slice(0,110),
                  cls:typeof e.className==='string'?e.className.slice(0,85):''
                }))""")
                print("OPTIONS",label,json.dumps(found,ensure_ascii=False)[:7000],flush=True)
            def choose(text):
                for role in ("option","button"):
                    loc=page.get_by_role(role).filter(has_text=re.compile(re.escape(text),re.I))
                    if loc.count():
                        try:
                            loc.first.click(timeout=4000)
                            print("PICK",role,text,flush=True)
                            return True
                        except Exception as err:
                            print("PICK_ERROR",role,str(err)[:130],flush=True)
                # Exact matching text nodes (React custom combobox).
                loc=page.get_by_text(re.compile(re.escape(text),re.I))
                for i in range(min(loc.count(),6)):
                    try:
                        el=loc.nth(i)
                        if el.is_visible():
                            el.click(timeout=2000)
                            print("PICK_TEXT",text,i,flush=True)
                            return True
                    except Exception:
                        pass
                return False
            try:
                origin=page.get_by_placeholder("Select a departure city").first
                origin.click()
                origin.fill("London")
                page.wait_for_timeout(1900)
                options("origin query London")
                print("ORIGIN_SUGGESTIONS",page.locator("body").inner_text()[:1050],flush=True)
                for label in ("London Heathrow", "London (LHR)", "London"):
                    if choose(label):
                        break
                page.wait_for_timeout(1500)
                print("ORIGIN_VALUE",origin.input_value(),flush=True)
                destination=page.get_by_placeholder("Select a destination").first
                destination.click()
                destination.fill("Hong Kong")
                page.wait_for_timeout(1500)
                options("destination query Hong Kong")
                for label in ("Hong Kong International", "Hong Kong (HKG)", "Hong Kong"):
                    if choose(label):
                        break
                page.wait_for_timeout(1500)
                print("DEST_VALUE",destination.input_value(),flush=True)
                snapshot(page,"route-picked")
            except Exception as err:
                print("ROUTE_UI_ERROR",type(err).__name__,str(err)[:330],flush=True)

        except Exception as e:
            print("BROWSER_ERROR",type(e).__name__,str(e)[:600],flush=True)
        finally:
            print("API_REQUEST_COUNT",len(seen),flush=True)
            context.close()
            browser.close()
if __name__=="__main__": main()
