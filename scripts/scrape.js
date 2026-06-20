// 使用 Puppeteer Core 通过浏览器开发者协议获取页面结构
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function scrapeRegexr() {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const imagesDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    console.log('启动浏览器...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    
    // 设置用户代理
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('导航到 regexr.com...');
    await page.goto('https://regexr.com/', { waitUntil: 'networkidle0', timeout: 60000 });
    
    console.log('等待页面加载...');
    await page.waitForSelector('body', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000)); // 等待动态内容

    // 截图
    await page.screenshot({ path: path.join(imagesDir, 'regexr-full.png'), fullPage: true });
    console.log('✓ 截图保存');

    // 获取页面结构
    const structure = await page.evaluate(() => {
        return {
            url: window.location.href,
            title: document.title,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            domStructure: {
                bodyClasses: document.body.className,
            }
        };
    });

    fs.writeFileSync(path.join(__dirname, 'structure.json'), JSON.stringify(structure, null, 2));
    console.log('✓ 页面结构保存');

    // 获取 CSS 样式 - 更详细的信息
    const styles = await page.evaluate(() => {
        // 获取关键元素的计算样式
        const getStyle = (selector) => {
            const el = document.querySelector(selector);
            if (!el) return null;
            const styles = getComputedStyle(el);
            return {
                backgroundColor: styles.backgroundColor,
                color: styles.color,
                fontFamily: styles.fontFamily,
                fontSize: styles.fontSize,
                height: styles.height,
                width: styles.width,
                padding: styles.padding,
                margin: styles.margin,
                borderColor: styles.borderColor,
                borderWidth: styles.borderWidth,
                borderRadius: styles.borderRadius
            };
        };

        return {
            body: getStyle('body'),
            nav: getStyle('header') || getStyle('.header'),
            regexInput: getStyle('.regex-input') || getStyle('textarea') || getStyle('[placeholder="Enter your pattern"]'),
            editor: getStyle('.ace_editor') || getStyle('.editor'),
            tab: getStyle('[role="tab"]'),
            tabActive: getStyle('[role="tab"].active'),
        };
    });

    fs.writeFileSync(path.join(__dirname, 'styles.json'), JSON.stringify(styles, null, 2));
    console.log('✓ 样式信息保存');

    // 获取颜色信息
    const colors = await page.evaluate(() => {
        const colorsFound = new Set();
        
        // 遍历所有元素收集颜色
        const elements = document.querySelectorAll('*');
        for (const el of Array.from(elements).slice(0, 5000)) {
            try {
                const styles = getComputedStyle(el);
                ['backgroundColor', 'color', 'borderColor'].forEach(prop => {
                    const val = styles[prop];
                    if (val && !val.includes('transparent')) {
                        colorsFound.add(val);
                    }
                });
            } catch (e) {}
        }
        
        return Array.from(colorsFound).slice(0, 30);
    });

    fs.writeFileSync(path.join(__dirname, 'colors.json'), JSON.stringify(colors, null, 2));
    console.log('✓ 颜色信息保存');

    await browser.close();
    console.log('完成!');
}

scrapeRegexr().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
