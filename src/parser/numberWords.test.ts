import { normalizeNumberWords } from './numberWords';

describe('normalizeNumberWords', () => {
  test('single unit', () => {
    expect(normalizeNumberWords('gym ten paid')).toBe('gym 10 paid');
  });

  test('teens', () => {
    expect(normalizeNumberWords('fifteen')).toBe('15');
  });

  test('tens + units', () => {
    expect(normalizeNumberWords('twenty five')).toBe('25');
    expect(normalizeNumberWords('ninety nine')).toBe('99');
  });

  test('hundreds', () => {
    expect(normalizeNumberWords('five hundred')).toBe('500');
    expect(normalizeNumberWords('one hundred and fifty')).toBe('150');
    expect(normalizeNumberWords('hundred')).toBe('100');
  });

  test('thousands', () => {
    expect(normalizeNumberWords('one thousand')).toBe('1000');
    expect(normalizeNumberWords('fifteen thousand')).toBe('15000');
    expect(normalizeNumberWords('fifty thousand')).toBe('50000');
    expect(normalizeNumberWords('two thousand five hundred')).toBe('2500');
  });

  test('indian numbering', () => {
    expect(normalizeNumberWords('one lakh')).toBe('100000');
    expect(normalizeNumberWords('two lakh fifty thousand')).toBe('250000');
    expect(normalizeNumberWords('one crore')).toBe('10000000');
  });

  test('embedded in a command', () => {
    expect(normalizeNumberWords('spent one thousand on grocery')).toBe('spent 1000 on grocery');
    expect(normalizeNumberWords('gym five hundred rupees paid')).toBe('gym 500 rupees paid');
  });

  test('already-digit input is preserved', () => {
    expect(normalizeNumberWords('gym 500 paid')).toBe('gym 500 paid');
  });

  test('no number words → unchanged', () => {
    expect(normalizeNumberWords('how much spent on gym this month')).toBe(
      'how much spent on gym this month'
    );
  });

  test('"and" outside a number run is NOT consumed', () => {
    // "tea and snacks" must stay intact — "and" only joins number words.
    expect(normalizeNumberWords('tea and snacks')).toBe('tea and snacks');
  });

  test('trailing "and" after a number is not absorbed', () => {
    expect(normalizeNumberWords('five and gym')).toBe('5 and gym');
  });

  test('multiple separate numbers in one string', () => {
    expect(normalizeNumberWords('five gym ten')).toBe('5 gym 10');
  });

  test('empty string', () => {
    expect(normalizeNumberWords('')).toBe('');
  });
});
