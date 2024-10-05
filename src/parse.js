import { parse_css } from 'css-doodle/parser';

export function parse(code) {
    return parse_css(code);
}
