/** The bars, written once (P3-08 ticket, Criteria table). */
export const THRESHOLDS = {
  goldenCohort: 20,
  arrivalP95Ms: 500,
  welcomeConfirmations: 10,
  briefReviews: 50,
  parentCorrections: 5,
  checkInRatings: 10,
  checkInWarmRate: 0.9,
  maxRebuildDrift: 0.05,
  childrenPerBand: 3,
  minimumWeeksOfUse: 2,
  freshDays: 60,
} as const;
