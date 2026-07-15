import jwt from "jsonwebtoken";

const generateToken = (
  payload: object,
  secret: string,
  expiresIn: string,
): string => {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
};

const verifyToken = (token: string, secret: string): jwt.JwtPayload => {
  return jwt.verify(token, secret) as jwt.JwtPayload;
};

export const jwtHelpers = {
  generateToken,
  verifyToken,
};
