/**
 * Logger with verbose mode and progress tracking
 *
 * Supports:
 * - Verbose mode: Shows all subagent activity in real-time
 * - Quiet mode: Only shows final output
 * - Spinner support for long operations
 */

import { EventEmitter } from "events";

export type LogLevel = "debug" | "info" | "warn" | "error" | "progress";

interface LogEntry {
  level: LogLevel;
  phase: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

class Logger extends EventEmitter {
  private verbose = false;
  private quiet = false;
  private logs: LogEntry[] = [];
  private currentSpinner: { text: string; interval?: NodeJS.Timeout } | null = null;
  private spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private spinnerIndex = 0;

  setVerbose(verbose: boolean) {
    this.verbose = verbose;
  }

  setQuiet(quiet: boolean) {
    this.quiet = quiet;
  }

  isVerbose() {
    return this.verbose;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  private writeToStderr(message: string) {
    if (!this.quiet) {
      // Clear spinner line if active
      if (this.currentSpinner) {
        process.stderr.write("\r\x1b[K");
      }
      process.stderr.write(message + "\n");
      // Restore spinner if active
      if (this.currentSpinner) {
        this.renderSpinner();
      }
    }
  }

  private renderSpinner() {
    if (this.currentSpinner && !this.quiet) {
      const frame = this.spinnerFrames[this.spinnerIndex];
      process.stderr.write(`\r${frame} ${this.currentSpinner.text}`);
    }
  }

  startSpinner(text: string) {
    if (this.quiet) return;

    this.stopSpinner();
    this.currentSpinner = {
      text,
      interval: setInterval(() => {
        this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
        this.renderSpinner();
      }, 80),
    };
    this.renderSpinner();
  }

  updateSpinner(text: string) {
    if (this.currentSpinner) {
      this.currentSpinner.text = text;
      this.renderSpinner();
    }
  }

  stopSpinner(finalMessage?: string) {
    if (this.currentSpinner?.interval) {
      clearInterval(this.currentSpinner.interval);
    }
    if (this.currentSpinner && !this.quiet) {
      process.stderr.write("\r\x1b[K");
      if (finalMessage) {
        process.stderr.write(`✓ ${finalMessage}\n`);
      }
    }
    this.currentSpinner = null;
  }

  log(level: LogLevel, phase: string, message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      phase,
      message,
      data,
      timestamp: new Date(),
    };

    this.logs.push(entry);
    this.emit("log", entry);

    if (this.verbose || level === "error" || level === "warn") {
      const prefix = this.getPrefix(level, phase);
      const dataStr = data ? ` ${JSON.stringify(data)}` : "";
      this.writeToStderr(`${prefix} ${message}${this.verbose ? dataStr : ""}`);
    }
  }

  private getPrefix(level: LogLevel, phase: string): string {
    const colors = {
      debug: "\x1b[90m",    // gray
      info: "\x1b[36m",     // cyan
      warn: "\x1b[33m",     // yellow
      error: "\x1b[31m",    // red
      progress: "\x1b[35m", // magenta
    };
    const reset = "\x1b[0m";
    const color = colors[level];

    const phaseColors: Record<string, string> = {
      surface: "\x1b[32m",     // green
      structural: "\x1b[34m",  // blue
      semantic: "\x1b[35m",    // magenta
      synthesis: "\x1b[33m",   // yellow
      orchestrator: "\x1b[36m",// cyan
    };
    const phaseColor = phaseColors[phase] || "\x1b[37m";

    return `${color}[${level.toUpperCase()}]${reset} ${phaseColor}[${phase}]${reset}`;
  }

  // Phase-specific logging methods
  surface(message: string, data?: Record<string, unknown>) {
    this.log("info", "surface", message, data);
  }

  structural(message: string, data?: Record<string, unknown>) {
    this.log("info", "structural", message, data);
  }

  semantic(message: string, data?: Record<string, unknown>) {
    this.log("info", "semantic", message, data);
  }

  synthesis(message: string, data?: Record<string, unknown>) {
    this.log("info", "synthesis", message, data);
  }

  orchestrator(message: string, data?: Record<string, unknown>) {
    this.log("info", "orchestrator", message, data);
  }

  progress(phase: string, message: string, data?: Record<string, unknown>) {
    this.log("progress", phase, message, data);
  }

  debug(phase: string, message: string, data?: Record<string, unknown>) {
    if (this.verbose) {
      this.log("debug", phase, message, data);
    }
  }

  warn(phase: string, message: string, data?: Record<string, unknown>) {
    this.log("warn", phase, message, data);
  }

  error(phase: string, message: string, data?: Record<string, unknown>) {
    this.log("error", phase, message, data);
  }

  // Get all logs for debugging
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }

  // Format logs as a report
  formatReport(): string {
    const phases = new Map<string, LogEntry[]>();

    for (const entry of this.logs) {
      const phaseEntries = phases.get(entry.phase) || [];
      phaseEntries.push(entry);
      phases.set(entry.phase, phaseEntries);
    }

    const lines: string[] = ["=== Analysis Log Report ===\n"];

    for (const [phase, entries] of phases) {
      lines.push(`\n## ${phase.toUpperCase()}`);
      for (const entry of entries) {
        const time = entry.timestamp.toISOString().split("T")[1].slice(0, 12);
        lines.push(`  [${time}] ${entry.level}: ${entry.message}`);
        if (entry.data) {
          lines.push(`           ${JSON.stringify(entry.data)}`);
        }
      }
    }

    return lines.join("\n");
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience export for phases
export function logPhase(phase: string, message: string, data?: Record<string, unknown>) {
  logger.log("info", phase, message, data);
}
