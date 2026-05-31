const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to the app (assuming it runs on port 5173 which is default for Vite)
  await page.goto('http://localhost:5173');
  
  // Wait for the app to load
  await page.waitForTimeout(2000);
  
  // Type 'AAPL' in the search bar and hit enter
  await page.fill('input[type="text"]', 'AAPL');
  await page.keyboard.press('Enter');
  
  // Wait for the data to load
  await page.waitForTimeout(4000);
  
  // Click the Deep Charting tab
  await page.click('text="Deep Charting"');
  
  // Wait for the chart to render
  await page.waitForTimeout(2000);
  
  // Take a screenshot
  await page.screenshot({ path: '/Users/amitkumar/Desktop/SectorTrackerApp/chart_screenshot.png' });
  
  // Also dump console errors to a file
  const logs = [];
  page.on('console', msg => {
      if (msg.type() === 'error') {
          console.log(`PAGE ERROR: ${msg.text()}`);
      }
  });
  
  await browser.close();
})();
