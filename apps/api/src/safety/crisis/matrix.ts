export type CrisisCategory =
  'self_harm' | 'immediate_danger' | 'household_abuse' | 'general_distress';
export type EscalationRoute = 'parent' | 'emergency_contact' | 'safeguarding_handoff';

export type EscalationRule = Readonly<{
  route: EscalationRoute;
  severity: 'critical' | 'high' | 'moderate';
  response: string;
}>;

export const ESCALATION_MATRIX: Readonly<Record<CrisisCategory, EscalationRule>> = {
  self_harm: {
    route: 'safeguarding_handoff',
    severity: 'critical',
    response: 'I hear you. A safe grown-up will help you now.',
  },
  immediate_danger: {
    route: 'emergency_contact',
    severity: 'critical',
    response: 'I hear you. A safe grown-up will help you now.',
  },
  household_abuse: {
    route: 'safeguarding_handoff',
    severity: 'high',
    response: 'Thank you. This is not your fault. A safe helper will come.',
  },
  general_distress: {
    route: 'parent',
    severity: 'moderate',
    response: 'Thank you. Let us stop and get a grown-up you trust.',
  },
};

export const UNCERTAIN_HIGH_RISK_RESPONSE = 'I want to be sure. Can you say that again?';
