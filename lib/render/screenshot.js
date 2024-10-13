const defaultWidth = 1600;
const defaultHeight = 900;

export async function screenshot(page, options = {}) {
    const { scale, output, selector } = options;

    await page.setViewport({
        width: defaultWidth,
        height: defaultHeight,
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
        width: Math.ceil(info.width) || defaultWidth,
        height: Math.ceil(info.height) || defaultHeight,
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
