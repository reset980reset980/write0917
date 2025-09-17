import { createClient } from '@supabase/supabase-js';
import { Essay, Comment } from '../types';

const supabaseUrl = 'https://fdrujdhlnqahucmqdvez.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkcnVqZGhsbnFhaHVjbXFkdmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU5MDU0NjYsImV4cCI6MjA0MTQ4MTQ2Nn0.h0g7wgKNOKl1FWmDWYqJEe-Bef4LfmJAYDKW8xI0Bi4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Supabase에서 가져온 데이터를 애플리케이션 타입으로 변환
function essayFromSupabase(data: any): Essay {
  return {
    id: data.id,
    title: data.title,
    content: data.content,
    authorGrade: data.author_grade,
    authorClass: data.author_class,
    authorNumber: data.author_number,
    authorName: data.author_name,
    createdAt: new Date(data.created_at),
    likes: data.likes || 0
  };
}

function commentFromSupabase(data: any): Comment {
  return {
    id: data.id,
    essayId: data.essay_id,
    content: data.content,
    authorGrade: data.author_grade,
    authorClass: data.author_class,
    authorNumber: data.author_number,
    authorName: data.author_name,
    createdAt: new Date(data.created_at)
  };
}

// 글 작성
export async function saveEssay(essay: Omit<Essay, 'id' | 'createdAt' | 'likes'>): Promise<Essay> {
    const { data, error } = await supabase
        .from('essays')
        .insert({
            title: essay.title,
            content: essay.content,
            author_grade: essay.authorGrade,
            author_class: essay.authorClass,
            author_number: essay.authorNumber,
            author_name: essay.authorName
        })
        .select()
        .single();

    if (error) {
        throw error;
    }
    return essayFromSupabase(data);
}

// 모든 글 불러오기
export async function loadEssays(): Promise<Essay[]> {
    const { data, error } = await supabase
        .from('essays')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }
    return data.map(essayFromSupabase);
}

// 좋아요 증가
export async function incrementLikes(essayId: string): Promise<number> {
    const { data, error } = await supabase.rpc('increment_likes', { essay_id: essayId });
    if (error) {
        throw error;
    }
    return data;
}

// 좋아요 감소
export async function decrementLikes(essayId: string): Promise<number> {
    const { data, error } = await supabase.rpc('decrement_likes', { essay_id: essayId });
    if (error) {
        throw error;
    }
    return data;
}

// 글 삭제 - 요청하신 최신 SQL 기반으로 전면 수정
export async function deleteEssay(id: string): Promise<{ success: boolean }> {
  try {
    console.log('Attempting to delete essay with ID:', id);
    
    // RPC 함수 호출
    const { data, error } = await supabase.rpc('delete_essay_by_id', {
      essay_id: id
    });
    
    if (error) {
      console.error('RPC delete failed:', error);
      
      // RPC 실패 시 직접 삭제 시도
      const { error: directError } = await supabase
        .from('essays')
        .delete()
        .eq('id', id);
      
      if (directError) {
        console.error('Direct delete also failed:', directError);
        throw directError;
      }
      
      console.log('Essay deleted successfully via direct method');
      return { success: true };
    }
    
    // RPC 응답 확인
    if (data && data.success === false) {
      console.error('Database function returned error:', data.error);
      throw new Error(data.error || 'Delete operation failed');
    }
    
    console.log('Essay deleted successfully via RPC:', data);
    return { success: true };
  } catch (error) {
    console.error('Error in deleteEssay:', error);
    throw error;
  }
}

// 댓글 작성
export async function saveComment(comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
    const { data, error } = await supabase
        .from('comments')
        .insert({
            essay_id: comment.essayId,
            content: comment.content,
            author_grade: comment.authorGrade,
            author_class: comment.authorClass,
            author_number: comment.authorNumber,
            author_name: comment.authorName
        })
        .select()
        .single();

    if (error) {
        throw error;
    }
    return commentFromSupabase(data);
}

// 특정 글의 댓글들 불러오기
export async function loadComments(essayId: string): Promise<Comment[]> {
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