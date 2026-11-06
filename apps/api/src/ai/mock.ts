import type { Extraction, JudgeResult } from '@pinpoint/shared';
import { keywordJudge } from './keywordFallback';
import type { AiProvider, ExtractionInput, JudgeInput } from './provider';

interface BankEntry {
  match: RegExp;
  title: string;
  notes: string;
  keyPoints: string[];
}

/**
 * Small curated bank so a keyless demo still shows plausible, topic-specific
 * study sheets. Matching is on the file name, then on nothing at all.
 */
const BANK: BankEntry[] = [
  {
    match: /photo|plant|chloro/i,
    title: 'Photosynthesis',
    notes:
      'Photosynthesis converts light energy into chemical energy. Chlorophyll in chloroplasts absorbs light, water is split to release oxygen, and the Calvin cycle fixes carbon dioxide into glucose.',
    keyPoints: [
      'Chlorophyll in chloroplasts absorbs light energy',
      'Water is split, releasing oxygen as a by-product',
      'Light reactions produce ATP and NADPH',
      'The Calvin cycle fixes carbon dioxide into glucose',
      'Glucose stores the energy captured from sunlight',
      'Rate depends on light intensity, CO2 and temperature',
    ],
  },
  {
    match: /newton|motion|force|mechanic/i,
    title: "Newton's Laws of Motion",
    notes:
      'Three laws connect force, mass and motion. Inertia keeps a body at rest or in uniform motion, F = ma relates force to acceleration, and every action has an equal and opposite reaction.',
    keyPoints: [
      'First law: a body keeps its state unless a net force acts',
      'Inertia is resistance to a change in motion',
      'Second law: force equals mass times acceleration',
      'Third law: every action has an equal and opposite reaction',
      'Momentum is mass times velocity and is conserved in a closed system',
      'Friction is a force that opposes relative motion',
    ],
  },
  {
    match: /cell|biolog|mitochond/i,
    title: 'Cell Structure',
    notes:
      'Eukaryotic cells compartmentalise chemistry. The nucleus stores DNA, mitochondria produce ATP, ribosomes build proteins and the membrane controls what enters and leaves.',
    keyPoints: [
      'The cell membrane is selectively permeable',
      'The nucleus holds DNA and controls activity',
      'Mitochondria produce ATP through respiration',
      'Ribosomes assemble proteins from amino acids',
      'The endoplasmic reticulum and Golgi package proteins',
      'Plant cells add a cellulose cell wall and chloroplasts',
    ],
  },
  {
    match: /thermo|heat|entropy|energy/i,
    title: 'Laws of Thermodynamics',
    notes:
      'Energy is conserved, entropy of an isolated system never decreases, and no engine can convert all heat into work. These three statements govern every energy conversion.',
    keyPoints: [
      'Zeroth law defines temperature and thermal equilibrium',
      'First law: energy is conserved, ΔU = Q − W',
      'Second law: entropy of an isolated system increases',
      'No heat engine can be perfectly efficient',
      'Absolute zero is the lower limit of temperature',
      'Work is the transfer of energy by a force through a distance',
    ],
  },
];

const GENERIC: BankEntry = {
  match: /.*/,
  title: 'Uploaded study material',
  notes:
    'The pages you uploaded were read and reduced to the ideas you should be able to say out loud. Edit any point before you save it.',
  keyPoints: [
    'Define the core idea in your own words',
    'Name the two things it connects',
    'State the process in order',
    'Give the one example from the material',
    'Explain why it matters',
    'Recall the common mistake',
  ],
};

function pick(fileName: string): BankEntry {
  return BANK.find((entry) => entry.match.test(fileName)) ?? GENERIC;
}

/**
 * Deterministic stand-in for Gemini. No network, no key, same JSON contract.
 * Used automatically whenever GEMINI_API_KEY is empty.
 */
export class MockProvider implements AiProvider {
  readonly name = 'mock' as const;
  readonly live = false;

  async extract(input: ExtractionInput): Promise<Extraction> {
    const entry = pick(input.fileName);
    const count = 5 + (input.buffer.length % 3); // 5-7 points, stable per file
    const keyPoints = entry.keyPoints.slice(0, Math.min(count, entry.keyPoints.length));
    return {
      title: entry.title,
      notes: entry.notes,
      keyPoints: keyPoints.map((text) => ({ text })),
    };
  }

  async judge(input: JudgeInput): Promise<JudgeResult> {
    return keywordJudge({ keyPoints: input.keyPoints, transcript: input.transcript });
  }
}
