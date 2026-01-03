from playwright.sync_api import sync_playwright

def verify_accessibility(page):
    page.goto('file:///app/index.html')

    # Check search input aria-label
    search_input = page.locator('#searchInput')
    aria_label = search_input.get_attribute('aria-label')
    print(f"Search input aria-label: {aria_label}")
    if aria_label != 'Search projects':
        print("FAIL: Search input missing correct aria-label")

    # Check shake button aria-label
    shake_btn = page.locator('#shakeButton')
    shake_aria = shake_btn.get_attribute('aria-label')
    print(f"Shake button aria-label: {shake_aria}")
    if shake_aria != 'Explode cards':
        print("FAIL: Shake button missing correct aria-label")

    # Check clear search button aria-label
    clear_btn = page.locator('#clearSearch')
    clear_aria = clear_btn.get_attribute('aria-label')
    print(f"Clear button aria-label: {clear_aria}")
    if clear_aria != 'Clear search':
        print("FAIL: Clear button missing correct aria-label")

    # Check category buttons aria-pressed
    category_btns = page.locator('.category-btn')
    count = category_btns.count()
    print(f"Found {count} category buttons")

    # Click one and check state change
    btn = category_btns.first
    initial_pressed = btn.get_attribute('aria-pressed')
    print(f"Initial aria-pressed: {initial_pressed}")

    btn.click()
    new_pressed = btn.get_attribute('aria-pressed')
    print(f"After click aria-pressed: {new_pressed}")

    if initial_pressed == new_pressed:
         print("FAIL: aria-pressed did not toggle")

    page.screenshot(path='/home/jules/verification/a11y-check.png')

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    verify_accessibility(page)
    browser.close()
