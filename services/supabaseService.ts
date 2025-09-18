import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Essay, Comment, Student, EssayData, BodyPart } from '../types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

const supabase: SupabaseClient | null = (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project-url'))
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export const isSupabaseConfigured = !!supabase;

if (!isSupabaseConfigured) {
    console.warn("Supabase 자격 증명이 constants.ts에 설정되지 않았습니다. 데이터베이스 기능을 사용할 수 없습니다.");
}

// Helper to ensure the Supabase client is available before making a call.
const getSupabase = (): SupabaseClient => {
    if (!supabase) {
        throw new Error("Supabase가 설정되지 않았습니다. constants.ts 파일에 SUPABASE_URL과 SUPABASE_ANON_KEY를 올바르게 입력했는지 확인해주세요.");
    }
    return supabase;
};

// Supabase에서 가져온 데이터를 애플리케이션 타입으로 변환
function essayFromSupabase(data: any): Essay {
    if (!data) {
        throw new Error("Received null data from Supabase where an essay object was expected.");
    }

    const student: Student = {
        grade: String(data.author_grade),
        classNumber: String(data.author_class),
        studentId: String(data.author_number),
        name: data.author_name,
    };

    return {
        id: data.id,
        topic: data.title,
        introduction: data.introduction,
        body: Array.isArray(data.body) ? data.body as BodyPart[] : [],
        conclusion: data.conclusion,
        fullText: data.full_text,
        student: student,
        editCode: data.edit_code,
        createdAt: new Date(data.created_at).toISOString(),
        likes: data.likes || 0,
    };
}

function commentFromSupabase(data: any): Comment {
    if (!data) {
        throw new Error("Received null data from Supabase where a comment object was expected.");
    }
    return {
        id: data.id,
        essayId: data.essay_id,
        content: data.content,
        authorGrade: data.author_grade,
        authorClass: data.author_class,
        authorNumber: data.author_number,
        authorName: data.author_name,
        createdAt: new Date(data.created_at).toISOString(),
    };
}

// 글 작성
export async function addEssay(essay: Omit<Essay, 'id' | 'createdAt' | 'likes'>): Promise<Essay> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('essays')
        .insert({
            title: essay.topic,
            introduction: essay.introduction,
            body: essay.body,
            conclusion: essay.conclusion,
            full_text: essay.fullText,
            edit_code: essay.editCode,
            author_grade: parseInt(essay.student.grade, 10),
            author_class: parseInt(essay.student.classNumber, 10),
            author_number: parseInt(essay.student.studentId, 10),
            author_name: essay.student.name,
        })
        .select()
        .single();

    if (error) {
        throw error;
    }
    
    return essayFromSupabase(data);
}

// 모든 글 불러오기
export async function getAllEssays(): Promise<Essay[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('essays')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }
    return data.map(essayFromSupabase);
}

// 수정 코드로 글 찾기
export async function findEssayByEditCode(code: string): Promise<Essay | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('essays')
      .select('*')
      .eq('edit_code', code)
      .single();

    if (error) {
        if (error.code === 'PGRST116') { // PostgREST error for "no rows found"
            return null;
        }
        throw error;
    }
    return data ? essayFromSupabase(data) : null;
}

// 글 수정
export async function updateEssay(editCode: string, updates: Partial<EssayData>): Promise<Essay> {
    const supabase = getSupabase();
    const updateData: { [key: string]: any } = {};

    if (updates.topic) updateData.title = updates.topic;
    if (updates.introduction) updateData.introduction = updates.introduction;
    if (updates.body) updateData.body = updates.body;
    if (updates.conclusion) updateData.conclusion = updates.conclusion;
    if (updates.fullText) updateData.full_text = updates.fullText;
    
    const { data, error } = await supabase
        .from('essays')
        .update(updateData)
        .eq('edit_code', editCode)
        .select()
        .single();

    if (error) {
        throw error;
    }
    return essayFromSupabase(data);
}


// 좋아요 증가
export async function incrementLike(essayId: string): Promise<Essay> {
    const supabase = getSupabase();
    const { error: rpcError } = await supabase.rpc('increment_likes', { essay_id: essayId });
    if (rpcError) throw rpcError;
    
    const { data, error } = await supabase.from('essays').select('*').eq('id', essayId).single();
    if (error) throw error;
    
    return essayFromSupabase(data);
}

// 글 삭제
export async function deleteEssay(id: string): Promise<{ success: boolean }> {
    const supabase = getSupabase();
    const { error } = await supabase
        .from('essays')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error in deleteEssay:', error);
        throw error;
    }
    
    return { success: true };
}

// 댓글 작성
export async function addComment(essayId: string, authorName: string, content: string, authorInfo: { grade: number; class: number; number: number }): Promise<Comment> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('comments')
        .insert({
            essay_id: essayId,
            content: content,
            author_grade: authorInfo.grade,
            author_class: authorInfo.class,
            author_number: authorInfo.number,
            author_name: authorName
        })
        .select()
        .single();

    if (error) {
        throw error;
    }
    return commentFromSupabase(data);
}

// 특정 글의 댓글들 불러오기
export async function getComments(essayId: string): Promise<Comment[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('essay_id', essayId)
        .order('created_at', { ascending: true });

    if (error) {
        throw error;
    }
    return data.map(commentFromSupabase);
}