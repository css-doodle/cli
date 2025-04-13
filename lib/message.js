import { styleText } from 'node:util';

export function msgTip(message) {
  return styleText('dim', message);
}

export function msgKey(message) {
    return bold(yellow(message));
}

export function msgWarning(message) {
    return `${yellow('warn')}: ${format(message)}`;
}

export function msgError(message) {
    return `${red('error')}: ${format(message)}`;
}

export function msgSuccess(message) {
    return styleText('greenBright', message);
}

export function msgCommand(message) {
    return styleText('blueBright', message);
}

function format(message) {
    return message.trim().replace(/\n+\s+/g, '\n');
}

function red(message) {
  return styleText('redBright', message);
}

function yellow(message) {
  return styleText('yellowBright', message);
}

function bold(message) {
  return styleText('bold', message);
}
