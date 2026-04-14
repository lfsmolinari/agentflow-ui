import { createCommandRunner } from './command-runner';

const runner = createCommandRunner();

export const findExecutable = async (name: string): Promise<boolean> => {
  const command = process.platform === 'win32' ? 'where' : 'which';

  try {
    const result = await runner.run(command, [name]);
    return result.exitCode === 0;
  } catch {
    return false;
  }
};
