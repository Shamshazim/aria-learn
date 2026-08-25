/** A recognisable wrong idea and the concrete teaching response that addresses it. */
export type Misconception = Readonly<{
  id: string;
  skillCode: string;
  name: string;
  signature: string;
  remediation: string;
}>;
