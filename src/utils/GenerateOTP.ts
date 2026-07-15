import crypto from "crypto";

export const generateOTP = (
  validTime = 5,
): { otp: number; otpExpires: Date } => {
  const otp = crypto.randomInt(1000, 9999);
  const otpExpires = new Date(Date.now() + validTime * 60 * 1000);
  return { otp, otpExpires };
};
