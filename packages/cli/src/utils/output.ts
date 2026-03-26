/**
 * CLI Output Protocol - 与 Python cli_output.py 兼容的 JSON 输出协议
 */
export interface SuccessPayload {
  status: 'success';
  message: string;
  data?: unknown;
  warnings?: string[];
}

export interface ErrorDetail {
  code: string;
  message: string;
  suggestion?: string;
  details?: Record<string, unknown>;
}

export interface ErrorPayload {
  status: 'error';
  error: ErrorDetail;
}

export type OutputPayload = SuccessPayload | ErrorPayload;

/**
 * 构建成功响应
 */
export function buildSuccess(
  data?: unknown,
  message: string = 'ok',
  warnings?: string[]
): SuccessPayload {
  const payload: SuccessPayload = {
    status: 'success',
    message,
  };
  if (data !== undefined) {
    payload.data = data;
  }
  if (warnings && warnings.length > 0) {
    payload.warnings = warnings;
  }
  return payload;
}

/**
 * 构建错误响应
 */
export function buildError(
  code: string,
  message: string,
  suggestion?: string,
  details?: Record<string, unknown>
): ErrorPayload {
  const error: ErrorDetail = {
    code,
    message,
  };
  if (suggestion) {
    error.suggestion = suggestion;
  }
  if (details) {
    error.details = details;
  }
  return {
    status: 'error',
    error,
  };
}

/**
 * 打印 JSON 到 stdout
 */
export function printJson(payload: OutputPayload): void {
  console.log(JSON.stringify(payload, null, 0));
}

/**
 * 构建并打印成功响应
 */
export function printSuccess(
  data?: unknown,
  message: string = 'ok',
  warnings?: string[]
): void {
  printJson(buildSuccess(data, message, warnings));
}

/**
 * 构建并打印错误响应
 */
export function printError(
  code: string,
  message: string,
  suggestion?: string,
  details?: Record<string, unknown>
): void {
  printJson(buildError(code, message, suggestion, details));
}

/**
 * 格式化打印（带缩进，用于调试）
 */
export function printJsonPretty(payload: OutputPayload): void {
  console.log(JSON.stringify(payload, null, 2));
}
