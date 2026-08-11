export const Logger = {
  DEBUG: (msg: string, ...args: any[]) => {
    if (Deno.env.get("DEBUG") === "true") {
      console.debug(`[DEBUG] ${msg}`, ...args);
    }
  },
  INFO: (msg: string, ...args: any[]) => {
    console.info(`[INFO] ${msg}`, ...args);
  },
  WARN: (msg: string, ...args: any[]) => {
    console.warn(`[WARN] ${msg}`, ...args);
  },
  ERROR: (msg: string, ...args: any[]) => {
    console.error(`[ERROR] ${msg}`, ...args);
  }
};
