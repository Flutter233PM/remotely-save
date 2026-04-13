export default function cleanStack(stack) {
  if (typeof stack !== "string") {
    return undefined;
  }

  return stack
    .replace(/\r\n/g, "\n")
    .replace(/\\/g, "/")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");
}
