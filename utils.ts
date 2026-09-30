import type { Essay } from './types';

export function studentLabel(s: { grade: string | number; classNumber: string | number; studentId: string | number; name: string }) {
    return `${s.grade}학년 ${s.classNumber}반 ${s.studentId}번 ${s.name}`;
}

/** "방금", "3분 전", "어제", "9월 3일" */
export function relativeTime(iso: string, now = Date.now()) {
    const t = new Date(iso).getTime();
    const diff = Math.max(0, now - t) / 1000;
    if (diff < 60) return '방금';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 86400 * 2) return '어제';
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
    const d = new Date(t);
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    return d.toLocaleDateString('ko-KR', sameYear ? { month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' });
}

export function fullDate(iso: string) {
    return new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** 글자 수 (공백 제외) */
export function countChars(text: string) {
    return text.replace(/\s/g, '').length;
}

/** 엑셀에서 한글이 깨지지 않는 CSV 내려받기 */
export function downloadEssaysCsv(essays: Essay[], fileLabel: string) {
    const header = ['작성일', '학년', '반', '번호', '이름', '주제', '글자수', '좋아요', '수정코드', '출처', '전체 글'];
    const rows = essays.map((e) => [
        new Date(e.createdAt).toLocaleString('ko-KR'),
        e.student.grade,
        e.student.classNumber,
        e.student.studentId,
        e.student.name,
        e.topic,
        String(countChars(e.fullText)),
        String(e.likes),
        e.editCode || '',
        e.body.map((b) => b.source).filter(Boolean).join(' / '),
        e.fullText,
    ]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `주장하는글_${fileLabel}_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
