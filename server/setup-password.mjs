import { createInterface } from "node:readline";
// No password echo, command-line argument, file, history or log output.
export async function readSetupPasswords(
  input = process.stdin,
  output = process.stdout,
) {
  if (!input.isTTY) {
    const lines = createInterface({
      input,
      terminal: false,
      crlfDelay: Infinity,
    });
    const values = [];
    try {
      for await (const line of lines) {
        if (Buffer.byteLength(line) > 256)
          throw Error("Password exceeds 256 bytes.");
        values.push(line);
        if (values.length === 2) return values;
      }
    } finally {
      lines.close();
    }
    throw Error(
      "Two matching password lines are required on stdin. Prefer the interactive hidden prompt.",
    );
  }
  const wasRaw = !!input.isRaw;
  let buffer = "",
    queued = [],
    waiter = null,
    failure = null,
    lastCR = false;
  const fail = () => {
    failure = Error("Setup cancelled. No administrator was created.");
    if (waiter) {
      waiter.reject(failure);
      waiter = null;
    }
  };
  const receive = (chunk) => {
    for (const c of chunk.toString()) {
      if (c === "\u0003" || c === "\u0004") {
        fail();
        return;
      }
      if (c === "\n" && lastCR) {
        lastCR = false;
        continue;
      }
      lastCR = c === "\r";
      if (c === "\r" || c === "\n") {
        const value = buffer;
        buffer = "";
        if (waiter) {
          waiter.resolve(value);
          waiter = null;
        } else if (queued.length < 2) queued.push(value);
      } else if (c === "\u007f" || c === "\b")
        buffer = Array.from(buffer).slice(0, -1).join("");
      else if (c >= " ") {
        buffer += c;
        if (Buffer.byteLength(buffer) > 256) {
          failure = Error("Password exceeds 256 bytes.");
          if (waiter) {
            waiter.reject(failure);
            waiter = null;
          }
          return;
        }
      }
    }
  };
  const next = () => {
    if (failure) return Promise.reject(failure);
    if (queued.length) return Promise.resolve(queued.shift());
    return new Promise((resolve, reject) => {
      waiter = { resolve, reject };
    });
  };
  input.setEncoding("utf8");
  input.setRawMode(true);
  input.on("data", receive);
  input.on("end", fail);
  input.resume();
  try {
    output.write("New administrator password (12+ characters, hidden): ");
    const first = await next();
    output.write("\nConfirm password (hidden): ");
    const second = await next();
    output.write("\n");
    return [first, second];
  } finally {
    buffer = "";
    queued = [];
    input.off("data", receive);
    input.off("end", fail);
    input.setRawMode(wasRaw);
    input.pause();
  }
}
