import { UserRole, UserStatus } from "../../../generated/prisma/client.js";

export interface IUser {
  id?: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  profilePicture?: string;
  role: UserRole;
  status: UserStatus;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IUserFilterRequest = {
  email?: string;
  mobileNumber?: string;
  searchTerm?: string;
};
