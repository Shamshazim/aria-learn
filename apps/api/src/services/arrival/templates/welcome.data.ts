export const WELCOME_COPY = {
  first: (name: string) => `Hi ${name}. I am glad you are here.`,
  recent: (name: string) => `Welcome back, ${name}. You finished a practice step last time.`,
  longAbsence: (name: string) => `Welcome back, ${name}. We can start fresh today.`,
  checkIn: 'Would you like an easy start or a challenge?',
} as const;
