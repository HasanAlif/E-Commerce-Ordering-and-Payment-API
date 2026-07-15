-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DOCTOR', 'PATIENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPEND', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "mobileNumber" VARCHAR(20),
    "password" VARCHAR(255),
    "profilePicture" VARCHAR(500),
    "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationOtp" VARCHAR(10),
    "verificationOtpExpiry" TIMESTAMP(3),
    "resetPasswordOtp" VARCHAR(10),
    "resetPasswordOtpExpiry" TIMESTAMP(3),
    "googleId" VARCHAR(255),
    "premiumPlanExpiry" TIMESTAMP(3),
    "isEnjoyedTrial" BOOLEAN NOT NULL DEFAULT false,
    "country" VARCHAR(100),
    "currency" VARCHAR(10),
    "language" VARCHAR(10),
    "timezone" VARCHAR(50),
    "monthStartDate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_user_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_user_status" ON "users"("status");

-- CreateIndex
CREATE INDEX "idx_user_mobile" ON "users"("mobileNumber");

-- CreateIndex
CREATE INDEX "idx_user_google_id" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "idx_user_is_deleted" ON "users"("isDeleted");
