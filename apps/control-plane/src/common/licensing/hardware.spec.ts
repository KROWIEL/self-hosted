import { hardwareIsVisible, hardwareMarks } from './hardware';

/**
 * The marks are what a licence server uses to tell one machine from another, so
 * the properties that matter are: nothing identifying leaves the machine, the
 * same host answers the same way twice, and two licences on one host cannot be
 * linked to each other.
 */
describe('hardware marks', () => {
  const KEY = 'licence-key-one';

  it('says the same thing about the same machine twice', () => {
    expect(hardwareMarks(KEY)).toEqual(hardwareMarks(KEY));
  });

  it('never carries a raw identifier', () => {
    for (const mark of hardwareMarks(KEY)) {
      // Hex digest, nothing that could be read back into a machine id.
      expect(mark.h).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it('looks like a different machine under a different licence', () => {
    const mine = hardwareMarks(KEY);
    const theirs = hardwareMarks('licence-key-two');
    const shared = mine.filter((mark) =>
      theirs.some((other) => other.k === mark.k && other.h === mark.h),
    );
    expect(shared).toHaveLength(0);
  });

  it('reports nothing at all without a licence to key on', () => {
    expect(hardwareMarks('')).toEqual([]);
  });

  it('counts one strong mark, or two weak ones, as knowing the machine', () => {
    expect(hardwareIsVisible([{ k: 'machine-id', h: 'x' }])).toBe(true);
    expect(hardwareIsVisible([{ k: 'profile', h: 'x' }])).toBe(false);
    expect(
      hardwareIsVisible([
        { k: 'profile', h: 'x' },
        { k: 'board-serial', h: 'y' },
      ]),
    ).toBe(true);
    expect(hardwareIsVisible([])).toBe(false);
  });
});
