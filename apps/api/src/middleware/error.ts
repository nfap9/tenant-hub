import type { ErrorRequestHandler } from "express";
import { HttpError } from "../utils/http.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err?.name === "ZodError") {
    return res.status(400).json({ error: "参数不正确", details: err.flatten?.() });
  }

  console.error(err);
  return res.status(500).json({ error: "服务器内部错误" });
};
