export type Bindings = {
  OPENAI_API_KEY: string
  ANTHROPIC_API_KEY: string
  GEMINI_API_KEY: string
  PERPLEXITY_API_KEY: string
  QA_APP_SECRET: string
  ADMIN_KEY: string     // 관리자 API 인증 키
  JYSK_API_URL: string  // 원격 DB API 프록시 URL
  JYSK_API_KEY: string  // 원격 DB API 키
  DB: D1Database
  R2: R2Bucket
  KV: KVNamespace
}
