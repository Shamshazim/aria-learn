/** A minimal valid `ai.yaml`; tests derive the invalid cases from it by string replacement. */
export const VALID_AI_CONFIG = `
app:
  ai:
    routing:
      TEACH: { endpoint: primary }
      FAST: { endpoint: primary }
    endpoints:
      primary:
        api: anthropic
        base-url: https://api.anthropic.com
        api-key: \${ANTHROPIC_API_KEY}
        model: claude-sonnet
        max-tokens: 2048
        timeout-seconds: 60
        cost-per-mtok-in: 3
        cost-per-mtok-out: 15
`;

/** An OpenAI-style block with no key, indented to sit under `endpoints:` after the fixture. */
export const KEYLESS_OPENAI_ENDPOINT = `
      dormant:
        api: openai
        base-url: https://api.openai.com/v1
        model: gpt-5
        max-tokens: 2048
        timeout-seconds: 60
        cost-per-mtok-in: 1.25
        cost-per-mtok-out: 10
`;
