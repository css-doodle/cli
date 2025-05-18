import { styleText } from 'node:util';

export function msgTip(message) {
    return styleText('dim', message);
}

export function msgKey(message) {
    return bold(yellow(message));
}

export function msgWarning(message) {
    return `${yellow('warn')}: ${message}`;
}

export function msgError(message) {
    return `${red('error')}: ${message}`;
}

export function msgSuccess(message) {
    return styleText('green', message);
}

export function msgCommand(message) {
    return styleText('blue', message);
}

function red(message) {
    return styleText('red', message);
}

function yellow(message) {
    return styleText('yellow', message);
}

function bold(message) {
    return styleText('bold', message);
}
