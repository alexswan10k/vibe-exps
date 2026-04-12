from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("file:///app/index.html")

        # Verify Drone Sim is in the project navigator
        drone_link = page.get_by_role("link", name="Drone Sim 3D")
        expect(drone_link).to_be_visible()
        expect(drone_link).to_have_attribute("href", "drone-sim/index.html")

        page.screenshot(path="navigator.png")

        # Verify the actual Drone Sim page works
        page.goto("file:///app/drone-sim/index.html")
        expect(page.locator("#canvas-container")).to_be_visible()
        expect(page.get_by_role("heading", name="Drone Flight Sim")).to_be_visible()

        page.screenshot(path="drone-sim.png")
        browser.close()

if __name__ == "__main__":
    run()
