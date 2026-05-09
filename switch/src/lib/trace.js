import { randomUUID } from "node:crypto";
export const newTraceId = () => randomUUID().replace(/-/g, "").slice(0, 16);
