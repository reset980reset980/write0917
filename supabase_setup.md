학생들의 글과 댓글을 저장할 테이블을 생성하고, 데이터 접근 정책(RLS)을 설정합니다. 아래 코드 블록 안의 내용을 **모두** 복사하여 SQL Editor에 붙여넣고 실행해주세요.

```sql
-- START: 이 라인부터 복사를 시작하세요.

-- 기존 테이블이 존재하면 삭제합니다. (초기 설정 시 안전 장치)
DROP TABLE IF EXISTS public.comments;
DROP TABLE IF EXISTS public.essays;

-- 글 저장 테이블 (essays) 생성
CREATE TABLE public.essays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_grade INTEGER NOT NULL,
  author_class INTEGER NOT NULL,
  author_number INTEGER NOT NULL,
  author_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  likes INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 댓글 저장 테이블 (comments) 생성
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  essay_id UUID REFERENCES public.essays(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_grade INTEGER NOT NULL,
  author_class INTEGER NOT NULL,
  author_number INTEGER NOT NULL,
  author_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 테이블 접근 권한 설정 (Row Level Security 활성화)
ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 글과 댓글을 읽을 수 있도록 설정
CREATE POLICY "Allow public read access" ON public.essays FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON public.comments FOR SELECT TO anon USING (true);

-- 모든 사용자가 글과 댓글을 작성할 수 있도록 설정
CREATE POLICY "Allow public insert" ON public.essays FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public insert" ON public.comments FOR INSERT TO anon WITH CHECK (true);

-- 모든 사용자가 글과 댓글을 수정할 수 있도록 설정
CREATE POLICY "Allow public update" ON public.essays FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow public update" ON public.comments FOR UPDATE TO anon USING (true);

-- 모든 사용자가 글과 댓글을 삭제할 수 있도록 설정 (관리자 기능용)
CREATE POLICY "Allow public delete" ON public.essays FOR DELETE TO anon USING (true);
CREATE POLICY "Allow public delete" ON public.comments FOR DELETE TO anon USING (true);

-- 기존 함수 삭제 후 재생성
DROP FUNCTION IF EXISTS delete_essay_by_id(UUID);

-- 강화된 삭제 함수 생성
CREATE OR REPLACE FUNCTION delete_essay_by_id(essay_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- 글이 존재하는지 확인
  IF NOT EXISTS (SELECT 1 FROM public.essays WHERE id = essay_id) THEN
    RETURN json_build_object('success', false, 'error', 'Essay not found');
  END IF;
  
  -- 삭제 실행
  DELETE FROM public.essays WHERE id = essay_id;
  
  -- 성공 응답
  RETURN json_build_object('success', true, 'message', 'Essay deleted successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 실행 권한 부여
GRANT EXECUTE ON FUNCTION delete_essay_by_id(UUID) TO anon;
GRANT EXECUTE ON FUNCTION delete_essay_by_id(UUID) TO authenticated;

-- 좋아요 기능을 위한 함수
CREATE OR REPLACE FUNCTION increment_likes(essay_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_likes_count INTEGER;
BEGIN
  UPDATE public.essays 
  SET likes = likes + 1
  WHERE id = essay_id
  RETURNING likes INTO new_likes_count;
  
  RETURN COALESCE(new_likes_count, 0);
END;
$$;

-- 좋아요 감소 함수
CREATE OR REPLACE FUNCTION decrement_likes(essay_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_likes_count INTEGER;
BEGIN
  UPDATE public.essays 
  SET likes = GREATEST(likes - 1, 0)
  WHERE id = essay_id
  RETURNING likes INTO new_likes_count;
  
  RETURN COALESCE(new_likes_count, 0);
END;
$$;

-- 좋아요 함수들에 권한 부여
GRANT EXECUTE ON FUNCTION increment_likes(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_likes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_likes(UUID) TO anon;
GRANT EXECUTE ON FUNCTION decrement_likes(UUID) TO authenticated;

-- END: 이 라인까지 복사하세요.
```

---
## 2. API 키 설정 (참고)
애플리케이션은 이미 올바른 API 키로 설정되어 있습니다. 이 섹션은 정보 제공용입니다.