// Typed API client. Attaches the JWT access token and transparently refreshes
// once on 401. The single place the frontend talks to the backend.

export type Role = 'PARENT' | 'STUDENT'

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  id: string
  role: Role
  displayName: string
}

export interface Subject { id: string; name: string; slug: string; description: string | null }
export interface Grade { id: string; name: string; levelOrder: number; subjectId: string }
export interface Topic { id: string; name: string; ordering: number; learningObjectives: string[] }
export interface Lesson { id: string; name: string; ordering: number; topics: Topic[] }
export interface Unit { id: string; name: string; ordering: number; lessons: Lesson[] }
export interface GradeTree { gradeId: string; gradeName: string; units: Unit[] }

export interface Visual {
  type: string
  caption?: string | null
  groups?: number | null
  itemsPerGroup?: number | null
  emoji?: string | null
  rows?: number | null
  cols?: number | null
  max?: number | null
  jumps?: number[] | null
  parts?: number | null
  shaded?: number | null
  shape?: string | null
}
export interface KnowledgeContent {
  explanation: string
  realWorldExamples: string[]
  visuals: Visual[]
  commonMistakes: string[]
  tips: string[]
  summary: string
}
export interface KnowledgeView { topicId: string; topicName: string; content: KnowledgeContent }

export interface StudentDto {
  id: string; username: string; displayName: string
  avatar: string | null; currentGradeId: string | null; birthYear: number | null
}

export interface StudentProfile {
  id: string; displayName: string; currentGradeId: string | null; gradeName: string | null
}

export interface PracticeQuestion {
  questionId: string; type: string; difficulty: string; prompt: string; choices: string[] | null
}
export interface PracticeSet { topicId: string; difficulty: string; questions: PracticeQuestion[] }
export interface AnswerResult { correct: boolean; correctAnswer: string; solution: string | null; feedback: string | null }

export interface WorkedExample { problem: string; steps: string[]; answer: string }
export interface ExamplesContent { examples: WorkedExample[] }
export interface ExamplesView { topicId: string; topicName: string; content: ExamplesContent }

export interface GuidedQuestion { questionId: string; type: string; prompt: string; choices: string[] | null }
export interface GuidedFeedback { correct: boolean; hint: string | null; solution: string | null; correctAnswer: string | null }

export interface QuizQuestion { questionId: string; type: string; prompt: string; choices: string[] | null }
export interface QuizDto { quizId: string; attemptId: string; timeLimitSec: number; passingPct: number; questions: QuizQuestion[] }
export interface QuestionResult {
  questionId: string; prompt: string; yourAnswer: string | null
  correct: boolean; correctAnswer: string; solution: string | null; feedback: string | null
}
export interface QuizResult { scorePct: number; passed: boolean; correct: number; total: number; results: QuestionResult[] }

export interface EnrolledSubject { subjectId: string; subjectName: string; gradeId: string; gradeName: string }

export type TopicStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'MASTERED'
export interface TopicProgress {
  topicId: string; topicName: string; unitName: string; lessonName: string
  status: TopicStatus; masteryScore: number; mastered: boolean
}
export interface MasteryBreakdown {
  topicId: string; knowledgeScore: number | null; practiceScore: number | null
  quizBestScore: number | null; homeworkScore: number | null
  totalScore: number; requiredPct: number; mastered: boolean
}
export interface MasteryConfig {
  weightKnowledge: number; weightPractice: number; weightQuiz: number; weightHomework: number
  requiredPct: number; maxQuizAttempts: number
}

export type HomeworkStatus = 'ASSIGNED' | 'EVALUATING' | 'EVALUATED'
export interface HomeworkSummary {
  homeworkId: string; topicId: string; topicName: string
  status: HomeworkStatus; score: number | null; dueAt: string | null; createdAt: string
}
export interface HomeworkQuestionDto { questionId: string; type: string; prompt: string; choices: string[] | null }
export interface HomeworkDetail {
  homeworkId: string; topicId: string; topicName: string
  status: HomeworkStatus; score: number | null; questions: HomeworkQuestionDto[]
}
export interface HomeworkAnswerResult {
  questionId: string; prompt: string; yourAnswer: string | null
  correct: boolean; partialCredit: number; feedback: string | null
  misconception: string | null; correctAnswer: string; solution: string | null
}
export interface HomeworkResult {
  homeworkId: string; topicName: string; status: HomeworkStatus
  overallScore: number | null; summary: string | null; recommendations: string | null
  results: HomeworkAnswerResult[]
}
export interface ParentSettings { autoAssignHomework: boolean }

export interface StrengthDto { topicId: string; topicName: string; score: number }
export interface WeaknessDto { topicId: string; topicName: string; score: number; reason: string }
export interface MistakeDto { topicId: string; topicName: string; misconception: string; count: number }
export interface RecommendationDto { type: string; topicId: string | null; topicName: string | null; reason: string }
export interface AdaptiveProfile {
  accuracy: number; masteredCount: number; inProgressCount: number; confidence: number
  pace: string; advice: string | null
  strengths: StrengthDto[]; weaknesses: WeaknessDto[]
  mistakes: MistakeDto[]; recommendations: RecommendationDto[]
}

export interface StreakDto { current: number; longest: number }
export interface GoalDto { period: string; metric: string; target: number; progress: number }
export interface AchievementDto {
  code: string; name: string; description: string; icon: string
  earned: boolean; earnedAt: string | null
}
export interface GamificationSummary {
  xpTotal: number; level: number; xpIntoLevel: number; xpForNextLevel: number
  streak: StreakDto; goals: GoalDto[]; achievements: AchievementDto[]
}

export interface ChildSummary {
  studentId: string; displayName: string; level: number; xpTotal: number; streak: number
  masteredCount: number; inProgressCount: number; accuracy: number
  weeklyActivities: number; weeklyTarget: number
}
export interface TopicMasteryChart {
  topicId: string; topicName: string; status: string; total: number
  knowledge: number | null; practice: number | null; quiz: number | null; homework: number | null
}
export interface ActivityDay { date: string; xp: number; count: number }
export interface ParentCharts { masteryByTopic: TopicMasteryChart[]; activityByDay: ActivityDay[] }

export interface PromptSummary { name: string; category: string; activeVersion: number; modelTier: string; updatedAt: string }
export interface PromptVersion {
  id: string; name: string; category: string; version: number; active: boolean
  systemPrompt: string; userPromptTemplate: string; modelTier: string
  temperature: number; maxTokens: number; jsonMode: boolean; createdAt: string
}
export interface PromptTestResult { output: string; model: string; promptTokens: number; completionTokens: number; latencyMs: number }
export interface PromptUsage { promptName: string; calls: number; tokensIn: number; tokensOut: number }
export interface DayUsage { date: string; tokens: number; calls: number }
export interface AiUsage { totalCalls: number; totalTokens: number; byPrompt: PromptUsage[]; byDay: DayUsage[] }

export interface AdminTopic { id: string; name: string; ordering: number; objectives: string[]; active: boolean; studentsWithProgress: number }
export interface AdminLesson { id: string; name: string; ordering: number; active: boolean; topics: AdminTopic[] }
export interface AdminUnit { id: string; name: string; ordering: number; active: boolean; lessons: AdminLesson[] }
export interface AdminGrade { id: string; name: string; levelOrder: number; active: boolean; units: AdminUnit[] }
export interface AdminSubject { id: string; name: string; slug: string; description: string | null; active: boolean; grades: AdminGrade[] }

export interface NotificationDto {
  id: string; type: string; title: string; message: string
  link: string | null; read: boolean; createdAt: string
}
export interface NotificationPreference { type: string; label: string; enabled: boolean }

export interface ReportTopicLine { topicName: string; status: string; total: number; quiz: number | null; homework: number | null }
export interface Report {
  reportId: string; studentName: string; gradeName: string
  scope: string; periodStart: string; periodEnd: string; generatedAt: string
  level: number; xpTotal: number; streak: number
  accuracy: number; masteredCount: number; inProgressCount: number; totalTopics: number
  periodXp: number; periodActivities: number; activeDays: number
  masteryByTopic: ReportTopicLine[]
  strengths: string[]; weaknesses: string[]; recommendations: string[]; advice: string | null
}

const ACCESS = 'mt_access'
const REFRESH = 'mt_refresh'

export const tokens = {
  get access() { return localStorage.getItem(ACCESS) },
  get refresh() { return localStorage.getItem(REFRESH) },
  save(t: TokenResponse) {
    localStorage.setItem(ACCESS, t.accessToken)
    localStorage.setItem(REFRESH, t.refreshToken)
  },
  clear() {
    localStorage.removeItem(ACCESS)
    localStorage.removeItem(REFRESH)
  },
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`

  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && retry && tokens.refresh) {
    const refreshed = await tryRefresh()
    if (refreshed) return request<T>(method, path, body, false)
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const err = await res.json()
      message = err.message || message
    } catch { /* ignore */ }
    throw new Error(message)
  }
  // Handle empty bodies (e.g. void endpoints return 200 with no content).
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refresh }),
    })
    if (!res.ok) { tokens.clear(); return false }
    tokens.save(await res.json())
    return true
  } catch {
    tokens.clear()
    return false
  }
}

export interface FlagItem {
  flagId: string
  questionId: string
  childName: string
  questionType: string | null
  prompt: string
  choices: string[]
  correctAnswer: string | null
  solution: string | null
  reason: string | null
  createdAt: string
}

export const api = {
  login: (usernameOrEmail: string, password: string) =>
    request<TokenResponse>('POST', '/auth/login', { usernameOrEmail, password }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('POST', '/account/change-password', { currentPassword, newPassword }),
  resetChildPassword: (studentId: string, newPassword: string) =>
    request<void>('POST', `/parent/students/${studentId}/password`, { newPassword }),

  subjects: () => request<Subject[]>('GET', '/curriculum/subjects'),
  grades: (subjectId: string) => request<Grade[]>('GET', `/curriculum/subjects/${subjectId}/grades`),
  gradeTree: (gradeId: string) => request<GradeTree>('GET', `/curriculum/grades/${gradeId}/tree`),

  me: () => request<StudentProfile>('GET', '/student/me'),
  listStudents: () => request<StudentDto[]>('GET', '/parent/students'),
  createStudent: (b: { username: string; password: string; displayName: string; gradeId: string }) =>
    request<StudentDto>('POST', '/parent/students', b),

  knowledge: (topicId: string) => request<KnowledgeView>('GET', `/topics/${topicId}/knowledge`),
  elaborate: (topicId: string) => request<KnowledgeView>('GET', `/topics/${topicId}/elaborate`),
  examples: (topicId: string) => request<ExamplesView>('GET', `/topics/${topicId}/examples`),
  practice: (topicId: string, difficulty: string, count: number) =>
    request<PracticeSet>('POST', '/practice/independent', { topicId, difficulty, count }),
  answer: (questionId: string, response: string) =>
    request<AnswerResult>('POST', '/practice/answer', { questionId, response }),

  guidedStart: (topicId: string) =>
    request<GuidedQuestion>('POST', '/practice/guided/start', { topicId }),
  guidedAttempt: (questionId: string, response: string, attempt: number) =>
    request<GuidedFeedback>('POST', '/practice/guided/attempt', { questionId, response, attempt }),
  guidedSolution: (questionId: string) =>
    request<GuidedFeedback>('GET', `/practice/guided/${questionId}/solution`),

  quizStart: (topicId: string) => request<QuizDto>('POST', '/quiz/start', { topicId }),
  quizSubmit: (attemptId: string, answers: { questionId: string; response: string }[]) =>
    request<QuizResult>('POST', '/quiz/submit', { attemptId, answers }),

  progress: (gradeId?: string) =>
    request<TopicProgress[]>('GET', `/student/progress${gradeId ? `?gradeId=${gradeId}` : ''}`),
  mastery: (topicId: string) => request<MasteryBreakdown>('GET', `/student/topics/${topicId}/mastery`),
  childProgress: (studentId: string, gradeId?: string) =>
    request<TopicProgress[]>('GET', `/parent/students/${studentId}/progress${gradeId ? `?gradeId=${gradeId}` : ''}`),

  studentSubjects: () => request<EnrolledSubject[]>('GET', '/student/subjects'),
  childSubjects: (studentId: string) => request<EnrolledSubject[]>('GET', `/parent/students/${studentId}/subjects`),
  enrollChild: (studentId: string, gradeId: string) =>
    request<void>('POST', `/parent/students/${studentId}/enroll`, { gradeId }),

  getMasteryConfig: () => request<MasteryConfig>('GET', '/admin/mastery-config'),
  updateMasteryConfig: (c: MasteryConfig) => request<MasteryConfig>('PUT', '/admin/mastery-config', c),

  listHomework: () => request<HomeworkSummary[]>('GET', '/homework'),
  openHomework: (topicId: string) => request<HomeworkDetail>('POST', `/homework/topic/${topicId}`),
  homeworkDetail: (homeworkId: string) => request<HomeworkDetail>('GET', `/homework/${homeworkId}`),
  submitHomework: (homeworkId: string, answers: { questionId: string; response: string }[]) =>
    request<HomeworkResult>('POST', `/homework/${homeworkId}/submit`, { answers }),
  homeworkResult: (homeworkId: string) => request<HomeworkResult>('GET', `/homework/${homeworkId}/result`),

  getParentSettings: () => request<ParentSettings>('GET', '/parent/settings'),
  updateParentSettings: (s: ParentSettings) => request<ParentSettings>('PUT', '/parent/settings', s),

  studentProfile: (gradeId?: string) =>
    request<AdaptiveProfile>('GET', `/student/profile${gradeId ? `?gradeId=${gradeId}` : ''}`),
  childProfile: (studentId: string, gradeId?: string) =>
    request<AdaptiveProfile>('GET', `/parent/students/${studentId}/profile${gradeId ? `?gradeId=${gradeId}` : ''}`),

  gamification: () => request<GamificationSummary>('GET', '/student/gamification'),
  childGamification: (studentId: string) => request<GamificationSummary>('GET', `/parent/students/${studentId}/gamification`),

  parentOverview: () => request<ChildSummary[]>('GET', '/parent/overview'),
  childCharts: (studentId: string, gradeId?: string) =>
    request<ParentCharts>('GET', `/parent/students/${studentId}/charts${gradeId ? `?gradeId=${gradeId}` : ''}`),

  flagQuestion: (questionId: string, reason?: string) =>
    request<void>('POST', `/questions/${questionId}/flag`, { reason: reason ?? null }),
  parentFlags: () => request<FlagItem[]>('GET', '/parent/flags'),
  resolveFlag: (flagId: string) => request<void>('POST', `/parent/flags/${flagId}/resolve`),

  adminPrompts: () => request<PromptSummary[]>('GET', '/admin/prompts'),
  promptHistory: (name: string) => request<PromptVersion[]>('GET', `/admin/prompts/${name}/history`),
  publishPrompt: (name: string, body: Record<string, unknown>) =>
    request<PromptVersion>('POST', `/admin/prompts/${name}`, body),
  rollbackPrompt: (name: string, version: number) =>
    request<PromptVersion>('POST', `/admin/prompts/${name}/rollback`, { version }),
  testPrompt: (name: string, variables: Record<string, string>) =>
    request<PromptTestResult>('POST', `/admin/prompts/${name}/test`, { variables }),
  aiUsage: (days = 14) => request<AiUsage>('GET', `/admin/ai-usage?days=${days}`),

  adminCurriculum: () => request<AdminSubject[]>('GET', '/admin/curriculum/tree'),
  createCurriculum: (kind: string, body: Record<string, unknown>) =>
    request<{ id: string }>('POST', `/admin/curriculum/${kind}`, body),
  updateCurriculum: (kind: string, id: string, body: Record<string, unknown>) =>
    request<void>('PUT', `/admin/curriculum/${kind}/${id}`, body),
  topicUsage: (id: string) => request<{ studentsWithProgress: number }>('GET', `/admin/curriculum/topics/${id}/usage`),

  notifications: (limit = 20) => request<NotificationDto[]>('GET', `/notifications?limit=${limit}`),
  unreadCount: () => request<{ count: number }>('GET', '/notifications/unread-count'),
  markNotificationsRead: (ids?: string[]) => request<void>('POST', '/notifications/read', ids ? { ids } : {}),
  notificationPreferences: () => request<NotificationPreference[]>('GET', '/notifications/preferences'),
  updateNotificationPreference: (type: string, enabled: boolean) =>
    request<void>('PUT', '/notifications/preferences', { type, enabled }),

  generateReport: (studentId: string, scope: string) =>
    request<Report>('POST', `/parent/students/${studentId}/reports?scope=${scope}`),
  reportPdf: async (reportId: string): Promise<Blob> => {
    const res = await fetch(`/api/v1/parent/reports/${reportId}/pdf`, {
      headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {},
    })
    if (!res.ok) throw new Error(`Could not download PDF (${res.status})`)
    return res.blob()
  },
}
