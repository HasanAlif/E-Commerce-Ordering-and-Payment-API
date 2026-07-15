import { NextFunction, Request, Response } from "express";
import auth from "./auth.js";

const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  auth()(req, res, () => next());
};

export default optionalAuth;
