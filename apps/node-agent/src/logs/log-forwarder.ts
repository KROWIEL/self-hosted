import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface } from "node:readline";

type EmitLogFn = (line: { appId: string; stream: "stdout" | "stderr"; line: string }) => void;

export class LogForwarder {
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>();

  start(appId: string, composePath: string, serviceName: string, emitLog: EmitLogFn) {
    this.stop(appId);

    const child = spawn(
      "docker",
      ["compose", "-f", composePath, "logs", "-f", "--no-color", serviceName],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    const stdoutReader = createInterface({ input: child.stdout });
    const stderrReader = createInterface({ input: child.stderr });

    stdoutReader.on("line", (line) => emitLog({ appId, stream: "stdout", line }));
    stderrReader.on("line", (line) => emitLog({ appId, stream: "stderr", line }));

    child.on("exit", () => {
      this.processes.delete(appId);
    });

    this.processes.set(appId, child);
  }

  stop(appId: string) {
    const existing = this.processes.get(appId);
    if (existing) {
      existing.kill();
      this.processes.delete(appId);
    }
  }

  stopAll() {
    for (const appId of this.processes.keys()) {
      this.stop(appId);
    }
  }
}
