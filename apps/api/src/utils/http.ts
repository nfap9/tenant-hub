import type { Response } from 'express';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export const ok = <T>(res: Response, data: T) => res.json({ data });
