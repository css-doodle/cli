import { styleText } from 'node:util';

function getStyleProxy() {
    let names = [];
    const p = new Proxy(function() {}, {
        get(_, prop) {
            names.push(prop);
            return p;
        },
        apply(_, ___, args) {
            const result = styleText(names, ...args);
            names = [];
            return result;
        }
    });

    return p;
}

const style = getStyleProxy();

export { style };
