
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TEACHER_PASSWORD } from './constants';
import { UserRole, type Student, type Essay, type EssayData, type BodyPart, type Comment } from './types';
import { getTopicSuggestions } from './services/geminiService';
import { getAllEssays, addEssay, findEssayByEditCode, updateEssay, deleteEssay, incrementLike, decrementLike, getComments, addComment } from './services/supabaseService';
import {
  UserIcon, TeacherIcon, SparklesIcon, PlusIcon, TrashIcon,
  ChevronRightIcon, ChevronLeftIcon, CheckCircleIcon, ArrowLeftIcon, HeartIcon, ChatBubbleIcon, XIcon
} from './components/icons';
import LoadingSpinner from './components/LoadingSpinner';
import EssayCard from './components/EssayCard';

// ---------- SUB-COMPONENTS (Defined outside App to prevent re-creation on re-renders) ----------

const LandingPage: React.FC<{ onSelectRole: (role: UserRole) => void }> = ({ onSelectRole }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-white p-4">
        <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-indigo-800 mb-4">주장하는 글쓰기 도우미</h1>
            <p className="text-lg text-gray-600">AI와 함께 논리적인 글쓰기 능력을 키워보아요!</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
            <button onClick={() => onSelectRole(UserRole.STUDENT)} className="group flex flex-col items-center p-8 bg-white rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-indigo-500">
                <UserIcon className="w-16 h-16 text-indigo-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
                <span className="text-2xl font-semibold text-gray-800">학생</span>
            </button>
            <button onClick={() => onSelectRole(UserRole.TEACHER)} className="group flex flex-col items-center p-8 bg-white rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-teal-500">
                <TeacherIcon className="w-16 h-16 text-teal-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
                <span className="text-2xl font-semibold text-gray-800">선생님</span>
            </button>
        </div>
    </div>
);


const StudentInfoForm: React.FC<{ onStart: (info: Student) => void; onBack: () => void; }> = ({ onStart, onBack }) => {
    const [info, setInfo] = useState({ grade: '6', classNumber: '', studentId: '', name: '' });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (info.classNumber && info.studentId && info.name) {
            onStart(info);
        } else {
            alert('모든 정보를 입력해주세요.');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInfo({ ...info, [e.target.name]: e.target.value });
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-center text-gray-800">학생 정보를 입력해주세요</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="grade" className="block text-sm font-medium text-gray-700">학년</label>
                            <input type="text" id="grade" name="grade" value={info.grade} readOnly className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="classNumber" className="block text-sm font-medium text-gray-700">반</label>
                            <input type="number" id="classNumber" name="classNumber" value={info.classNumber} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">번호</label>
                            <input type="number" id="studentId" name="studentId" value={info.studentId} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">이름</label>
                        <input type="text" id="name" name="name" value={info.name} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                     <div className="flex flex-col-reverse sm:flex-row gap-2">
                        <button type="button" onClick={onBack} className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            뒤로가기
                        </button>
                        <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            글쓰기 시작!
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const TeacherLogin: React.FC<{ onLogin: () => void; onBack: () => void; }> = ({ onLogin, onBack }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === TEACHER_PASSWORD) {
            onLogin();
        } else {
            setError('비밀번호가 올바르지 않습니다.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-center text-gray-800">선생님 로그인</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="password-teacher" className="sr-only">비밀번호</label>
                        <input
                            id="password-teacher"
                            name="password"
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (error) setError('');
                            }}
                            required
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="비밀번호"
                        />
                    </div>
                    {error && <p className="text-sm text-red-600 -mt-2 mb-2">{error}</p>}
                    <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                        <button type="button" onClick={onBack} className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            뒤로가기
                        </button>
                        <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                            관리자 페이지로 이동
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const WritingWizard: React.FC<{ student: Student; onComplete: (essay: Omit<Essay, 'id' | 'createdAt' | 'likes'>) => void; onBackToGallery: () => void; }> = ({ student, onComplete, onBackToGallery }) => {
    const [step, setStep] = useState(1);
    const [topic, setTopic] = useState('');
    const [refinedTopic, setRefinedTopic] = useState('');
    const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
    const [introduction, setIntroduction] = useState('');
    const [body, setBody] = useState<BodyPart[]>([{ reason: '', source: '' }]);
    const [conclusion, setConclusion] = useState('');
    const [isRefining, setIsRefining] = useState(false);
    const [finalFullText, setFinalFullText] = useState('');

    const handleRefineTopic = async () => {
        if (!topic.trim()) {
            alert('먼저 주제를 입력해주세요.');
            return;
        }
        setIsRefining(true);
        setRefinedTopic('');
        setTopicSuggestions([]);
        const result = await getTopicSuggestions(topic);
        setRefinedTopic(result.refinedTopic);
        setTopicSuggestions(result.suggestions);
        setIsRefining(false);
    };

    const addReason = () => setBody([...body, { reason: '', source: '' }]);
    
    const updateBodyPart = (index: number, field: 'reason' | 'source', value: string) => {
        const newBody = [...body];
        newBody[index] = { ...newBody[index], [field]: value };
        setBody(newBody);
    };

    const removeReason = (index: number) => {
        if (body.length > 1) {
            setBody(body.filter((_, i) => i !== index));
        } else {
            alert('최소 한 개의 근거는 필요합니다.');
        }
    };

    const finalTopic = refinedTopic || topic;

    useEffect(() => {
        if (step === 3) {
            const bodyText = body.map(part => part.reason).join('\n\n');
            const initialFullText = `${introduction}\n\n${bodyText}\n\n${conclusion}`;
            setFinalFullText(initialFullText);
        }
    }, [step, introduction, body, conclusion]);

    const validations = {
        step1: finalTopic.trim().length > 0,
        step2: introduction.length >= 100 && body.every(b => b.reason.trim().length > 0 && b.source.trim().length > 0) && conclusion.length >= 100,
        step3: finalFullText.length >= 500,
    };

    const handleComplete = () => {
        if (!validations.step3) {
            alert(`글자 수가 부족합니다. (현재 ${finalFullText.length}자 / 500자 이상)`);
            return;
        }
        const editCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const firstParagraph = finalFullText.split('\n\n')[0] || '';

        onComplete({
            student,
            topic: finalTopic,
            introduction: firstParagraph,
            body, 
            conclusion,
            fullText: finalFullText,
            editCode,
        });
    };
    
    const ProgressBar = () => (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-8">
            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${(step / 3) * 100}%` }}></div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
             <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold text-gray-800">주장하는 글쓰기</h1>
                <button onClick={onBackToGallery} className="text-sm text-indigo-600 hover:underline">갤러리로 가기</button>
            </div>
            <ProgressBar />
            <div className="bg-white p-8 rounded-xl shadow-lg">
                {/* Step 1: Topic */}
                {step === 1 && (
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-700 mb-1">1단계: 주제 정하기</h2>
                        <p className="text-gray-500 mb-6">어떤 내용으로 글을 쓰고 싶은지 주제를 정해 보세요.</p>
                        <div className="space-y-4">
                            <textarea
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="예시) 초등학생의 스마트폰 사용을 줄여야 한다."
                                className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition"
                                rows={3}
                            />
                            <button onClick={handleRefineTopic} disabled={isRefining} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">
                                {isRefining ? <LoadingSpinner /> : <SparklesIcon />}
                                AI로 주제 다듬기
                            </button>
                            {refinedTopic && (
                                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-md space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-indigo-800 mb-2">AI 추천 주제 (수정 가능) ✨</h3>
                                        <textarea
                                            value={refinedTopic}
                                            onChange={(e) => setRefinedTopic(e.target.value)}
                                            className="w-full p-2 bg-white border border-indigo-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                            rows={2}
                                        />
                                    </div>
                                    {topicSuggestions.length > 0 && (
                                     <div>
                                        <h4 className="font-semibold text-gray-700 mb-2">다른 주제 제안</h4>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            {topicSuggestions.map((suggestion, index) => (
                                                <button 
                                                    key={index}
                                                    onClick={() => setRefinedTopic(suggestion)}
                                                    className="flex-1 text-left p-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:border-indigo-400 transition"
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                     </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 2: Structure */}
                {step === 2 && (
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-700 mb-1">2단계: 글의 뼈대 세우기</h2>
                        <p className="text-gray-500 mb-6">서론, 본론, 결론에 들어갈 내용을 작성해 보세요.</p>
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">서론 <span className="text-sm font-normal text-gray-500">(주장 펼치기)</span></h3>
                                <textarea value={introduction} onChange={e => setIntroduction(e.target.value)} placeholder="글을 쓰게 된 문제 상황과 자신의 주장을 명확하게 밝혀주세요." className="w-full p-3 border border-gray-300 rounded-md" rows={4} />
                                <p className={`text-right text-sm mt-1 ${introduction.length < 100 ? 'text-red-500' : 'text-green-600'}`}>{introduction.length} / 100자 이상</p>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">본론 <span className="text-sm font-normal text-gray-500">(근거 제시하기)</span></h3>
                                {body.map((part, index) => (
                                    <div key={index} className="relative mb-4 p-4 border rounded-lg bg-gray-50">
                                        <textarea value={part.reason} onChange={e => updateBodyPart(index, 'reason', e.target.value)} placeholder={`근거 ${index + 1}: 주장을 뒷받침하는 이유와 구체적인 예시를 들어 설명해주세요.`} className={`w-full p-3 border rounded-md transition-colors ${part.reason.trim().length > 0 ? 'border-gray-300' : 'border-red-400'}`} rows={3} />
                                        <div className="mt-2">
                                            <label htmlFor={`source-${index}`} className="block text-sm font-medium text-gray-600 mb-1">출처 (필수)</label>
                                            <input type="text" id={`source-${index}`} value={part.source} onChange={e => updateBodyPart(index, 'source', e.target.value)} placeholder="예: https://www.example.com 또는 '네이버 지식백과'" className={`w-full p-2 border rounded-md text-sm transition-colors ${part.source.trim().length > 0 ? 'border-gray-300' : 'border-red-400'}`} />
                                        </div>
                                        {body.length > 1 && (
                                            <button onClick={() => removeReason(index)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"><TrashIcon /></button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addReason} className="flex items-center gap-2 text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"><PlusIcon /> 근거 추가하기</button>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">결론 <span className="text-sm font-normal text-gray-500">(주장 다지기)</span></h3>
                                <textarea value={conclusion} onChange={e => setConclusion(e.target.value)} placeholder="본론의 내용을 요약하고, 자신의 주장을 다시 한번 강조하며 마무리해주세요." className="w-full p-3 border border-gray-300 rounded-md" rows={4} />
                                <p className={`text-right text-sm mt-1 ${conclusion.length < 100 ? 'text-red-500' : 'text-green-600'}`}>{conclusion.length} / 100자 이상</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Finalize */}
                {step === 3 && (
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-700 mb-1">3단계: 글 완성하기</h2>
                        <p className="text-gray-500 mb-6">지금까지 작성한 내용을 하나의 글로 합쳤어요. 내용을 다듬어 완성해 보세요.</p>
                        <div className="p-4 border rounded-md bg-gray-50 space-y-4">
                            <h3 className="text-xl font-bold text-center text-gray-800">{finalTopic}</h3>
                            <textarea
                                value={finalFullText}
                                onChange={(e) => setFinalFullText(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-md min-h-[300px]"
                            />
                            <p className={`text-right text-sm mt-1 ${finalFullText.length < 500 ? 'text-red-500' : 'text-green-600'}`}>{finalFullText.length} / 500자 이상</p>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="mt-8 flex justify-between items-center">
                    <button
                        onClick={() => setStep(s => s > 1 ? s - 1 : 1)}
                        disabled={step === 1}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                    >
                        <ChevronLeftIcon /> 이전
                    </button>
                    {step < 3 && (
                         <button
                            onClick={() => setStep(s => s < 3 ? s + 1 : 3)}
                            disabled={
                                (step === 1 && !validations.step1) ||
                                (step === 2 && !validations.step2)
                            }
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
                        >
                            다음 <ChevronRightIcon />
                        </button>
                    )}
                    {step === 3 && (
                        <button
                            onClick={handleComplete}
                            disabled={!validations.step3}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300"
                        >
                            <CheckCircleIcon /> 완성하고 제출하기
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const EssayGallery: React.FC<{
  essays: Essay[];
  onStartWriting: () => void;
  onSelectEssay: (essay: Essay) => void;
  isLoading: boolean;
  isAdmin: boolean;
  onBackToLanding: () => void;
  dbError: string | null;
  onEditRequest: () => void;
  onDeleteEssay?: (id: string) => void;
  likedEssayIds: string[];
}> = ({ essays, onStartWriting, onSelectEssay, isLoading, isAdmin, onBackToLanding, dbError, onEditRequest, onDeleteEssay, likedEssayIds }) => (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
            <div className="flex items-center gap-4">
              <button onClick={onBackToLanding} className="p-2 rounded-full hover:bg-gray-100">
                  <ArrowLeftIcon className="w-6 h-6 text-gray-600" />
              </button>
              <h1 className="text-3xl font-bold text-gray-800">{isAdmin ? "학생 글 관리" : "주장 갤러리"}</h1>
            </div>
            {!isAdmin && (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                        onClick={onEditRequest}
                        className="w-full sm:w-auto px-6 py-3 bg-white text-indigo-700 font-semibold rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors duration-300"
                    >
                        글 수정하기
                    </button>
                    <button
                        onClick={onStartWriting}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300"
                    >
                        새 글쓰기 시작하기
                    </button>
                </div>
            )}
        </div>
        {isLoading ? (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner size="w-12 h-12" />
            </div>
        ) : dbError ? (
            <div className="text-center py-16 px-4 bg-white rounded-lg shadow border border-red-200">
                <h3 className="text-xl font-semibold text-red-700">오류가 발생했습니다</h3>
                <p className="text-gray-600 mt-2 bg-red-50 p-3 rounded-md">{dbError}</p>
                <p className="text-gray-500 mt-4 text-sm">
                    이 문제가 계속되면 관리자에게 문의하거나, 제공된 <code>supabase_setup.md</code> 파일의 쿼리를 실행하여 'essays' 테이블이 올바르게 생성되었는지 확인해주세요.
                </p>
            </div>
        ) : essays.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {essays.map(essay => (
                    <EssayCard key={essay.id} essay={essay} onSelect={() => onSelectEssay(essay)} isAdmin={isAdmin} onDelete={onDeleteEssay} isLiked={likedEssayIds.includes(essay.id)} />
                ))}
            </div>
        ) : (
            <div className="text-center py-16 px-4 bg-white rounded-lg shadow">
                <h3 className="text-xl font-semibold text-gray-700">아직 등록된 글이 없어요.</h3>
                <p className="text-gray-500 mt-2">{isAdmin ? "학생들이 글을 제출하면 이곳에서 확인할 수 있습니다." : "첫 번째 글을 작성해 보세요!"}</p>
            </div>
        )}
    </div>
);

const SubmissionSuccessPage: React.FC<{ editCode: string; onGoToGallery: () => void; }> = ({ editCode, onGoToGallery }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(editCode).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
    } else {
        alert("클립보드 복사를 지원하지 않는 환경입니다. 코드를 직접 복사해주세요.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-indigo-50 p-4">
      <div className="w-full max-w-lg p-8 text-center bg-white rounded-xl shadow-2xl border-t-4 border-green-500">
        <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-800 mb-2">제출 완료!</h2>
        <p className="text-gray-600 mb-6">글이 성공적으로 갤러리에 등록되었습니다.</p>

        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-2">나중에 글을 수정하려면 아래 코드가 필요해요. 꼭! 보관해주세요.</p>
          <div className="flex items-center justify-center p-4 bg-indigo-50 rounded-lg border-2 border-dashed border-indigo-200">
            <span className="text-3xl font-mono tracking-widest text-indigo-700">{editCode}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-300 ${
              copied
                ? 'bg-green-100 text-green-800 border-green-300'
                : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            {copied ? '복사 완료!' : '수정 코드 복사하기'}
          </button>
          <button
            onClick={onGoToGallery}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            갤러리로 이동
          </button>
        </div>
      </div>
    </div>
  );
};

const EditCodeEntry: React.FC<{ onFind: (code: string) => void; onBack: () => void; isFinding: boolean; }> = ({ onFind, onBack, isFinding }) => {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedCode = code.trim().toUpperCase();
        if (trimmedCode.length === 6) {
            onFind(trimmedCode);
        } else {
            setError('수정 코드는 6자리여야 합니다.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-center text-gray-800">수정 코드 입력</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="edit-code" className="sr-only">수정 코드</label>
                        <input
                            id="edit-code"
                            name="code"
                            type="text"
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value);
                                if (error) setError('');
                            }}
                            required
                            maxLength={6}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-center font-mono tracking-widest"
                            placeholder="ABCDEF"
                        />
                    </div>
                    {error && <p className="text-sm text-red-600 text-center -mt-2 mb-2">{error}</p>}
                    <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                        <button type="button" onClick={onBack} disabled={isFinding} className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                            뒤로가기
                        </button>
                        <button type="submit" disabled={isFinding} className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300">
                            {isFinding ? <LoadingSpinner /> : '글 불러오기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EssayEditor: React.FC<{ essay: Essay; onSave: (updates: Partial<EssayData>) => void; onCancel: () => void; isSaving: boolean; }> = ({ essay, onSave, onCancel, isSaving }) => {
    const [topic, setTopic] = useState(essay.topic);
    const [fullText, setFullText] = useState(essay.fullText);

    const handleSave = () => {
        if (!topic.trim() || !fullText.trim()) {
            alert('주제와 본문 내용을 모두 입력해주세요.');
            return;
        }
        onSave({
            topic,
            fullText,
            introduction: fullText.split('\n')[0] || '',
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <div className="flex justify-between items-start mb-6">
                <h1 className="text-3xl font-bold text-gray-800">글 수정하기</h1>
                <div className="text-sm text-gray-600 text-right">
                    <p>{essay.student.grade}학년 {essay.student.classNumber}반</p>
                    <p className="font-semibold">{essay.student.name}</p>
                </div>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-lg space-y-6">
                <div>
                    <label htmlFor="edit-topic" className="block text-lg font-semibold text-gray-800 mb-2">주제</label>
                    <input
                        id="edit-topic"
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition"
                    />
                </div>
                <div>
                    <label htmlFor="edit-fulltext" className="block text-lg font-semibold text-gray-800 mb-2">전체 글</label>
                    <textarea
                        id="edit-fulltext"
                        value={fullText}
                        onChange={(e) => setFullText(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md min-h-[400px] leading-relaxed"
                    />
                </div>
                <div className="mt-8 flex justify-end items-center gap-4">
                    <button onClick={onCancel} disabled={isSaving} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50">취소</button>
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">
                        {isSaving ? <LoadingSpinner /> : <CheckCircleIcon />} 저장하기
                    </button>
                </div>
            </div>
        </div>
    );
};

const EssayDetailView: React.FC<{
  essay: Essay;
  comments: Comment[];
  onClose: () => void;
  onLike: (id: string) => void;
  isLiked: boolean;
  onAddComment: (content: string) => Promise<void>;
  currentUserName?: string;
  isLiking: boolean;
  isCommenting: boolean;
  isAdmin: boolean;
  onDelete?: (id: string) => void;
}> = ({ essay, comments, onClose, onLike, isLiked, onAddComment, currentUserName, isLiking, isCommenting, isAdmin, onDelete }) => {
    const [commentContent, setCommentContent] = useState('');

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUserName || !commentContent.trim()) {
            alert('의견 내용을 입력해주세요.');
            return;
        }
        await onAddComment(commentContent.trim());
        setCommentContent('');
    };

    const handleDelete = () => {
        if (onDelete && window.confirm("정말로 이 글을 삭제하시겠습니까? 삭제된 글은 복구할 수 없습니다.")) {
            onDelete(essay.id);
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-full max-h-[90vh] flex flex-col">
                <header className="p-4 border-b flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 truncate pr-4">{essay.topic}</h2>
                    <div className="flex items-center gap-2">
                        {isAdmin && onDelete && (
                             <button
                                onClick={handleDelete}
                                className="p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                                aria-label="삭제하기"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <XIcon className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="mb-6">
                        <p className="text-sm text-gray-500">{essay.student.grade}학년 {essay.student.classNumber}반 {essay.student.studentId}번</p>
                        <p className="font-semibold text-gray-700">{essay.student.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(essay.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="prose prose-indigo max-w-none whitespace-pre-wrap leading-relaxed">
                        {essay.fullText}
                    </div>
                </main>
                <footer className="p-4 border-t bg-gray-50 flex-shrink-0">
                     <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => onLike(essay.id)} disabled={isLiking} className="flex items-center gap-2 text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors">
                                <HeartIcon className="w-6 h-6" filled={isLiked} />
                                <span className="font-semibold">{essay.likes}</span>
                            </button>
                            <div className="flex items-center gap-2 text-blue-500">
                                <ChatBubbleIcon className="w-6 h-6" />
                                <span className="font-semibold">{comments.length}</span>
                            </div>
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-3 mb-4 p-3 bg-white rounded-md border">
                        {comments.length > 0 ? comments.map(comment => (
                            <div key={comment.id} className="text-sm break-words">
                                <span className="font-bold text-gray-800">{comment.authorName}: </span>
                                <span className="text-gray-600">{comment.content}</span>
                            </div>
                        )) : <p className="text-sm text-gray-400 text-center py-2">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>}
                    </div>
                    <form onSubmit={handleCommentSubmit} className="flex items-start gap-2">
                        <div className="w-24 px-2 py-1.5 border rounded-md bg-gray-100 text-center text-sm font-medium text-gray-700 truncate" title={currentUserName}>
                            {currentUserName || '??'}
                        </div>
                        <input type="text" value={commentContent} onChange={e => setCommentContent(e.target.value)} placeholder="의견을 남겨주세요..." className="flex-1 px-3 py-1.5 border rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                        <button type="submit" disabled={isCommenting || !currentUserName} className="px-4 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center w-20">
                            {isCommenting ? <LoadingSpinner size="w-4 h-4" /> : '등록'}
                        </button>
                    </form>
                </footer>
            </div>
        </div>
    );
};

// ---------- LOCALSTORAGE HELPERS ----------
// 각 학생마다 독립적인 '좋아요' 기록을 저장하기 위해 학생 정보를 기반으로 고유 키를 생성합니다.
// 이를 통해 한 컴퓨터에서 여러 학생이 사용하더라도 '좋아요' 상태가 겹치지 않습니다.
const getStudentKey = (student: Student | null): string => {
    if (!student) return 'teacher-or-default'; // 학생 정보가 없는 경우 (선생님 또는 초기 상태)
    return `student-${student.grade}-${student.classNumber}-${student.studentId}-${student.name.replace(/\s/g, '')}`;
}

const getLikedEssays = (studentKey: string): string[] => {
    const LIKED_ESSAYS_KEY = `writing-app-liked-essays-${studentKey}`;
    try {
        const liked = localStorage.getItem(LIKED_ESSAYS_KEY);
        return liked ? JSON.parse(liked) : [];
    } catch (error) {
        console.error("Failed to parse liked essays from localStorage", error);
        return [];
    }
};

const addLikedEssay = (id: string, studentKey: string) => {
    const LIKED_ESSAYS_KEY = `writing-app-liked-essays-${studentKey}`;
    const liked = getLikedEssays(studentKey);
    if (!liked.includes(id)) {
        localStorage.setItem(LIKED_ESSAYS_KEY, JSON.stringify([...liked, id]));
    }
};

const removeLikedEssay = (id: string, studentKey: string) => {
    const LIKED_ESSAYS_KEY = `writing-app-liked-essays-${studentKey}`;
    const liked = getLikedEssays(studentKey);
    localStorage.setItem(LIKED_ESSAYS_KEY, JSON.stringify(liked.filter(likedId => likedId !== id)));
};

// ---------- MAIN APP COMPONENT ----------

type View = 'landing' | 'student-info' | 'teacher-login' | 'gallery' | 'writing' | 'submitted' | 'edit-entry' | 'editing';

const App: React.FC = () => {
    const [view, setView] = useState<View>('landing');
    const [role, setRole] = useState<UserRole | null>(null);
    const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
    
    const [student, setStudent] = useState<Student | null>(null);
    const [essays, setEssays] = useState<Essay[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dbError, setDbError] = useState<string | null>(null);

    const [lastSubmittedCode, setLastSubmittedCode] = useState<string>('');
    const [essayToEdit, setEssayToEdit] = useState<Essay | null>(null);
    const [isFinding, setIsFinding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [selectedEssay, setSelectedEssay] = useState<Essay | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLiking, setIsLiking] = useState(false);
    const [isCommenting, setIsCommenting] = useState(false);
    
    const [likedEssayIds, setLikedEssayIds] = useState<string[]>([]);
    const studentKey = useMemo(() => getStudentKey(student), [student]);

    useEffect(() => {
        setLikedEssayIds(getLikedEssays(studentKey));
    }, [studentKey]);

    const fetchEssays = useCallback(async () => {
        setIsLoading(true);
        setDbError(null);
        try {
            const data = await getAllEssays();
            setEssays(data);
        } catch (error: any) {
            console.error(error);
            setDbError(error.message || '데이터를 불러오는 데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (view === 'gallery' || isTeacherLoggedIn) {
            fetchEssays();
        }
    }, [view, isTeacherLoggedIn, fetchEssays]);

    const resetState = () => {
        setView('landing');
        setRole(null);
        setIsTeacherLoggedIn(false);
        setStudent(null);
        setEssayToEdit(null);
        setSelectedEssay(null);
    };

    const handleSelectRole = (selectedRole: UserRole) => {
        setRole(selectedRole);
        if (selectedRole === UserRole.STUDENT) setView('student-info');
        if (selectedRole === UserRole.TEACHER) setView('teacher-login');
    };

    const handleStudentStart = (info: Student) => {
        setStudent(info);
        setView('gallery');
    };
    
    const handleCompleteWriting = async (essayData: Omit<Essay, 'id' | 'createdAt' | 'likes'>) => {
        setIsSaving(true);
        try {
            const newEssay = await addEssay(essayData);
            setEssays(prev => [newEssay, ...prev]);
            setLastSubmittedCode(newEssay.editCode);
            setView('submitted');
        } catch (error) {
            alert('글 저장에 실패했습니다. 다시 시도해주세요.');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleFindEssayToEdit = async (code: string) => {
        setIsFinding(true);
        try {
            const found = await findEssayByEditCode(code);
            if (found) {
                setEssayToEdit(found);
                setView('editing');
            } else {
                alert('해당 코드를 가진 글을 찾을 수 없습니다.');
            }
        } catch (error) {
            alert('글을 찾는 중 오류가 발생했습니다.');
            console.error(error);
        } finally {
            setIsFinding(false);
        }
    };
    
    const handleSaveEdit = async (updates: Partial<EssayData>) => {
        if (!essayToEdit) return;
        setIsSaving(true);
        try {
            const updatedEssay = await updateEssay(essayToEdit.editCode, updates);
            setEssays(prev => prev.map(e => e.id === updatedEssay.id ? updatedEssay : e));
            setView('gallery');
            setEssayToEdit(null);
            alert('글이 성공적으로 수정되었습니다.');
        } catch (error) {
            alert('수정에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEssay = useCallback(async (id: string) => {
        try {
            await deleteEssay(id);
            setEssays(prev => prev.filter(essay => essay.id !== id));
            if (selectedEssay?.id === id) {
                setSelectedEssay(null);
            }
        } catch (error) {
            console.error("Failed to delete essay:", error);
            alert("글 삭제에 실패했습니다. 다시 시도해주세요.");
        }
    }, [selectedEssay]);

    const handleSelectEssay = useCallback(async (essay: Essay) => {
        setSelectedEssay(essay);
        setComments([]);
        try {
            const fetchedComments = await getComments(essay.id);
            setComments(fetchedComments);
        } catch (error) {
            console.error("Failed to fetch comments:", error);
            alert("댓글을 불러오는 데 실패했습니다.");
        }
    }, []);

    const handleLike = useCallback(async (id: string) => {
        const isLiked = likedEssayIds.includes(id);
        setIsLiking(true);
        try {
            const updatedEssay = isLiked ? await decrementLike(id) : await incrementLike(id);
            
            if (isLiked) {
                removeLikedEssay(id, studentKey);
                setLikedEssayIds(prev => prev.filter(likedId => likedId !== id));
            } else {
                addLikedEssay(id, studentKey);
                setLikedEssayIds(prev => [...prev, id]);
            }

            setEssays(prev => prev.map(e => e.id === id ? updatedEssay : e));
            if (selectedEssay?.id === id) {
                setSelectedEssay(updatedEssay);
            }
        } catch (error) {
            console.error("Failed to toggle like on essay:", error);
            alert("좋아요 처리에 실패했습니다.");
        } finally {
            setIsLiking(false);
        }
    }, [selectedEssay, likedEssayIds, studentKey]);

    const isAdmin = role === UserRole.TEACHER && isTeacherLoggedIn;
    const currentUserName = isAdmin ? '선생님' : student?.name;

    const handleAddComment = useCallback(async (content: string) => {
        if (!selectedEssay || !currentUserName) return;
        setIsCommenting(true);
        try {
            const newComment = await addComment(selectedEssay.id, currentUserName, content);
            setComments(prev => [...prev, newComment]);
        } catch (error) {
            console.error("Failed to add comment:", error);
            alert("댓글 등록에 실패했습니다.");
        } finally {
            setIsCommenting(false);
        }
    }, [selectedEssay, currentUserName]);

    // Main render logic
    const renderContent = () => {
        if (selectedEssay) {
            return (
                <EssayDetailView
                    essay={selectedEssay}
                    comments={comments}
                    onClose={() => setSelectedEssay(null)}
                    onLike={handleLike}
                    isLiked={likedEssayIds.includes(selectedEssay.id)}
                    onAddComment={handleAddComment}
                    currentUserName={currentUserName}
                    isLiking={isLiking}
                    isCommenting={isCommenting}
                    isAdmin={isAdmin}
                    onDelete={isAdmin ? handleDeleteEssay : undefined}
                />
            );
        }

        switch (view) {
            case 'landing':
                return <LandingPage onSelectRole={handleSelectRole} />;
            case 'student-info':
                return <StudentInfoForm onStart={handleStudentStart} onBack={resetState} />;
            case 'teacher-login':
                return <TeacherLogin onLogin={() => { setIsTeacherLoggedIn(true); setView('gallery'); }} onBack={resetState} />;
            case 'gallery':
                return (
                    <EssayGallery
                        essays={essays}
                        onStartWriting={() => setView('writing')}
                        onSelectEssay={handleSelectEssay}
                        isLoading={isLoading}
                        isAdmin={isAdmin}
                        onBackToLanding={resetState}
                        dbError={dbError}
                        onEditRequest={() => setView('edit-entry')}
                        onDeleteEssay={isAdmin ? handleDeleteEssay : undefined}
                        likedEssayIds={likedEssayIds}
                    />
                );
            case 'writing':
                if (!student) return <StudentInfoForm onStart={handleStudentStart} onBack={() => setView('gallery')} />;
                return <WritingWizard student={student} onComplete={handleCompleteWriting} onBackToGallery={() => setView('gallery')} />;
            case 'submitted':
                return <SubmissionSuccessPage editCode={lastSubmittedCode} onGoToGallery={() => setView('gallery')} />;
            case 'edit-entry':
                return <EditCodeEntry onFind={handleFindEssayToEdit} onBack={() => setView('gallery')} isFinding={isFinding} />;
            case 'editing':
                if (!essayToEdit) return <EditCodeEntry onFind={handleFindEssayToEdit} onBack={() => setView('gallery')} isFinding={isFinding} />;
                return <EssayEditor essay={essayToEdit} onSave={handleSaveEdit} onCancel={() => { setView('gallery'); setEssayToEdit(null); }} isSaving={isSaving} />;
            default:
                return <LandingPage onSelectRole={handleSelectRole} />;
        }
    };
    
    return <>{renderContent()}</>;
};

export default App;