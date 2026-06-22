import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function runCommand(command: string, workingDirectory?: string) {
  return execAsync(command, {
    cwd: workingDirectory
  });
}
