import { parse } from 'yaml';

interface Tokens {
  mean: number;
  stddev?: number;
}
interface Preset {
  name: string;
  version: number;
  description: string;
  workload: { dataset: { input_tokens: Tokens; output_tokens: Tokens } };
}

const files = import.meta.glob<string>('./servtuner/presets/*.yaml', { eager: true, query: '?raw', import: 'default' });
const tokens = (t: Tokens) => (t.stddev ? `${t.mean} ± ${t.stddev}` : `${t.mean}`);

export default Object.values(files).map((text) => {
  const p = parse(text) as Preset;
  const { input_tokens, output_tokens } = p.workload.dataset;
  return {
    id: `${p.name}@${p.version}`,
    input: tokens(input_tokens),
    output: tokens(output_tokens),
    description: p.description,
  };
});
