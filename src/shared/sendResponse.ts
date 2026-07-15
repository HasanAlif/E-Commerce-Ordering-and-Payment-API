import { Response } from "express";

interface IMeta {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
}

interface IResponse<T> {
  statusCode: number;
  success: boolean;
  message: string;
  meta?: IMeta;
  data: T | null;
}

const sendResponse = <T>(res: Response, data: IResponse<T>) => {
  const responseData: Record<string, unknown> = {
    success: data.success,
    message: data.message,
    data: data.data,
  };

  if (data.meta) {
    responseData.meta = data.meta;
  }

  res.status(data.statusCode).json(responseData);
};

export default sendResponse;
