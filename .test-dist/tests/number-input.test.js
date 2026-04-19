import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMetricValue, normalizeDecimalInput, parseLocaleNumberInput, } from '../src/lib/number-input.js';
test('normalizeDecimalInput accepts comma decimal separators', () => {
    assert.equal(normalizeDecimalInput('68,5'), '68.5');
    assert.equal(normalizeDecimalInput(' 68,50 '), '68.50');
});
test('parseLocaleNumberInput accepts dot and comma decimals', () => {
    assert.equal(parseLocaleNumberInput('68.5'), 68.5);
    assert.equal(parseLocaleNumberInput('68,5'), 68.5);
    assert.equal(parseLocaleNumberInput(68.5), 68.5);
});
test('parseLocaleNumberInput rejects invalid numeric text', () => {
    assert.equal(parseLocaleNumberInput('abc'), null);
    assert.equal(parseLocaleNumberInput('68,5,1'), null);
    assert.equal(parseLocaleNumberInput(''), null);
});
test('formatMetricValue trims trailing decimal zeros', () => {
    assert.equal(formatMetricValue(68), '68');
    assert.equal(formatMetricValue(68.5), '68.5');
    assert.equal(formatMetricValue(68.25), '68.25');
});
