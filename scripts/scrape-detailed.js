const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeRegexr() {
    const imagesDir = '/home/lin/Desktop/Temp/RegexrWeb/images';
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    console.log('启动浏览器...');
    const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: '/usr/bin/google-chrome-stable',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('导航到 regexr.com...');
    await page.goto('https://regexr.com/', { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('body', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    await page.screenshot({ path: imagesDir + '/regexr-full.png', fullPage: true });
    await page.screenshot({ path: imagesDir + '/regexr-viewport.png' });
    console.log('✓ 截图保存');

    // 获取详细结构
    const data = await page.evaluate(() => {
        const getStyle = (el) => {
            if (!el) return null;
            const s = getComputedStyle(el);
            return {
                backgroundColor: s.backgroundColor,
                color: s.color,
                fontFamily: s.fontFamily,
                fontSize: s.fontSize,
                height: s.height,
                width: s.width,
                padding: s.padding,
                margin: s.margin,
                border: { color: s.borderColor, width: s.borderWidth, radius: s.borderRadius },
                display: s.display,
                position: s.position
            };
        };
        
        const findElement = (selectors) => {
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) return { selector: sel, element: el };
            }
            return null;
        };
        
        const navEl = findElement(['header', '#header', '.header', '.main-header']);
        const regexInputEl = findElement(['.regex-input', 'textarea', '[placeholder*="regex"]']);
        const flagsEl = findElement(['.flags', '.flags-container']);
        const editorEl = findElement(['.ace_editor', '.editor-container']);
        const rightPanelEl = findElement(['.panel-right', '.right-panel', '.details-panel']);
        const tabsEl = findElement(['.tabs', '[role="tablist"]']);
        
        const cssFiles = [];
        for (const sheet of document.styleSheets) {
            try {
                let css = '';
                const rules = sheet.cssRules || sheet.rules;
                for (let i = 0; i < Math.min(rules.length, 100); i++) {
                    css += rules[i].cssText.substring(0, 200) + '\n';
                }
                cssFiles.push({ href: sheet.href || 'inline', rules: css.substring(0, 3000) });
            } catch (e) {
                cssFiles.push({ href: sheet.href || 'inline', error: e.message });
            }
        }
        
        const colors = new Set();
        const allElements = document.querySelectorAll('*');
        for (const el of Array.from(allElements).slice(0, 3000)) {
            try {
                const s = getComputedStyle(el);
                ['backgroundColor', 'color', 'borderColor'].forEach(p => {
                    const c = s[p];
                    if (c && !c.includes('transparent')) colors.add(c);
                });
            } catch (e) {}
        }
        
        return {
            components: {
                nav: { style: navEl ? getStyle(navEl.element) : null },
                regexInput: { style: regexInputEl ? getStyle(regexInputEl.element) : null },
                flags: { style: flagsEl ? getStyle(flagsEl.element) : null },
                editor: { style: editorEl ? getStyle(editorEl.element) : null },
                rightPanel: { style: rightPanelEl ? getStyle(rightPanelEl.element) : null },
                tabs: { style: tabsEl ? getStyle(tabsEl.element) : null }
            },
            cssFiles: cssFiles.slice(0, 10),
            colors: Array.from(colors).slice(0, 40)
        };
    });

    fs.writeFileSync(imagesDir + '/full-structure.json', JSON.stringify(data, null, 2));
    console.log('✓ 详细结构保存');

    await browser.close();
    console.log('完成!');
}

scrapeRegexr().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
