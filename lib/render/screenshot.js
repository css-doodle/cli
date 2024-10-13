export async function screenshot(page, options = {}) {
    const { scale, output, selector, windowWidth, windowHeight } = options;

    await page.setViewport({
        width: windowWidth,
        height: windowHeight,
        deviceScaleFactor: scale
    });

    const info = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (element) {
            const { width, height } = element.getBoundingClientRect();
            return {
                width,
                height: height || width,
                node: true
            };
        } else {
            const doc = document.documentElement;
            return {
                width: doc.scrollWidth,
                height: doc.scrollHeight,
                node: false
            };
        }
    }, selector);

    await page.setViewport({
        width: Math.ceil(info.width) || windowWidth,
        height: Math.ceil(info.height) || windowHeight,
        deviceScaleFactor: scale
    });

    if (info.node) {
        const element = await page.$(selector);
        await element.screenshot({
            path: output,
            omitBackground: true
        });
    } else {
        await page.screenshot({
            path: output,
            fullPage: true
        });
    }

    return output;
}
