export type Verdict = 'AC' | 'WA' | 'PE' | 'CE' | 'RE' | 'PENDING' | 'RUNNING';

export interface TestCase {
  id: number;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  verdict?: Verdict;
  error?: string;
  executionTime?: number;
}

export interface ProblemInfo {
  id: string;
  title: string;
  timeLimit?: string;
  url: string;
  testCases: TestCase[];
}

export interface ExecutionResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

export interface NativeHostStatus {
  available: boolean;
  compilers?: {
    cpp: boolean;
    c: boolean;
    python: boolean;
    javascript: boolean;
    java: boolean;
    csharp: boolean;
  };
  paths?: Record<string, string | null>;
  error?: string;
}

export interface BatchTestCaseResult {
  id: number;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

export interface BatchExecutionResponse {
  success: boolean;
  isCompileError?: boolean;
  compileError?: string;
  compileTime?: number;
  results?: BatchTestCaseResult[];
  error?: string;
}
