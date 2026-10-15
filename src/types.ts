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
