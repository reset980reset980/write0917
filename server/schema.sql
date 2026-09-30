-- 주장하는 글쓰기 도우미 DB 구조
-- 여러 번 실행해도 안전합니다 (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS essays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  introduction TEXT NOT NULL,
  body JSONB NOT NULL,
  conclusion TEXT NOT NULL,
  full_text TEXT NOT NULL,
  edit_code TEXT NOT NULL UNIQUE,
  author_grade INTEGER NOT NULL,
  author_class INTEGER NOT NULL,
  author_number INTEGER NOT NULL,
  author_name TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  essay_id UUID NOT NULL REFERENCES essays(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_grade INTEGER NOT NULL,
  author_class INTEGER NOT NULL,
  author_number INTEGER NOT NULL,
  author_name TEXT NOT NULL,
  is_teacher BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS essays_created_at_idx ON essays (created_at DESC);
CREATE INDEX IF NOT EXISTS essays_grade_class_idx ON essays (author_grade, author_class);
CREATE INDEX IF NOT EXISTS comments_essay_id_idx ON comments (essay_id, created_at);

-- 선생님이 바꾸는 설정 (예: 글쓰기 글자 수 조건)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
