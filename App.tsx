
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TEACHER_PASSWORD } from './constants';
import { UserRole, type Student, type Essay, type EssayData, type BodyPart, type Comment } from './types';
import { getTopicSuggestions } from './services/geminiService';
import { isSupabaseConfigured, getAllEssays, addEssay, deleteEssay, incrementLike, getComments, addComment, findEssayByEditCode, updateEssay } from './services/supabaseService';
import {
  UserIcon, TeacherIcon, SparklesIcon, PlusIcon, TrashIcon,
  ChevronRightIcon, ChevronLeftIcon, CheckCircleIcon, ArrowLeftIcon, HeartIcon, ChatBubbleIcon, XIcon
} from './components/icons';
import LoadingSpinner from './components/LoadingSpinner';
import EssayCard from './components/EssayCard';


// ---------- HELPERS / SMALLER COMPONENTS ----------

const Linkify: React.FC<{ text: string }> = ({ text }) => {
    // A simple regex to find URLs.
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return (
        <>
            {parts.map((part, i) =>
                urlRegex.test(part) ? (
                    <a href={part} key={i} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{part}</a>
                ) : (
                    <React.Fragment key={i}>{part}</React.Fragment>
                )
            )}
        </>
    );
};


// ---------- VIEWS / MAJOR COMPONENTS ----------

const SupabaseSetupNeeded: React.FC = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="w-full max-w-2xl p-8 space-y-6 bg-white rounded-xl shadow-lg border-2 border-red-200">
            <h2 className="text-3xl font-bold text-center text-red-700">🚨 Supabase 설정이 필요합니다 🚨</h2>
            <p className="text-center text-gray-700">
                애플리케이션이 데이터베이스에 연결할 수 없습니다. 계속하려면 Supabase 프로젝트를 설정하고
                API 키를 입력해야 합니다.
            </p>
            <div className="space-y-4 text-left p-6 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-lg text-gray-800">설정 방법:</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                    <li><a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-semibold">Supabase</a>에 가입하고 새 프로젝트를 만드세요.</li>
                    <li>프로젝트 대시보드에서 <strong>SQL Editor</strong>로 이동하여 <code>supabase_setup.md</code> 파일의 SQL 코드를 실행하세요.</li>
                    <li>프로젝트 대시보드의 <strong>Project Settings &gt; API</strong>에서 <strong>Project URL</strong>과 <strong>Project API Keys</strong>의 <code>anon</code> <code>public</code> 키를 복사하세요.</li>
                    <li><code>constants.ts</code> 파일을 열고 복사한 URL과 키를 <code>SUPABASE_URL</code>과 <code>SUPABASE_ANON_KEY</code> 변수에 붙여넣으세요.</li>
                </ol>
            </div>
            <p className="text-center text-sm text-gray-500 pt-4">
                설정을 완료한 후 페이지를 새로고침 해주세요.
            </p>
        </div>
    </div>
);

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

interface WritingWizardProps {
    student: Student;
    onBackToGallery: () => void;
    onComplete?: (essay: Omit<Essay, 'id' | 'createdAt' | 'likes'>) => void;
    initialData?: Essay | null;
    onUpdate?: (updates: EssayData) => void;
}

const WritingWizard: React.FC<WritingWizardProps> = (props) => {
    const { student, onBackToGallery, onComplete, initialData, onUpdate } = props;
    const isEditMode = !!initialData;
    
    const MIN_LEN = 100;
    const [step, setStep] = useState(1);
    const [topic, setTopic] = useState(initialData?.topic || '');
    const [refinedTopic, setRefinedTopic] = useState(initialData?.topic || '');
    const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
    const [introduction, setIntroduction] = useState(initialData?.introduction || '');
    const [body, setBody] = useState<BodyPart[]>(initialData?.body || [{ reason: '', source: '' }]);
    const [conclusion, setConclusion] = useState(initialData?.conclusion || '');
    const [isRefining, setIsRefining] = useState(false);
    const [finalFullText, setFinalFullText] = useState(initialData?.fullText || '');

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
        newBody[index][field] = value;
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

    const generateFullText = useCallback(() => {
        const bodyText = body.map(part => part.reason).join('\n\n');
        return `${introduction}\n\n${bodyText}\n\n${conclusion}`;
    }, [introduction, body, conclusion]);
    
    const validations = useMemo(() => ({
        step1: finalTopic.trim().length > 0,
        step2: introduction.trim().length >= MIN_LEN && 
               body.every(b => b.reason.trim().length > 0 && b.source.trim().length > 0) &&
               conclusion.trim().length >= MIN_LEN,
        step3: finalFullText.trim().length > 0,
    }), [finalTopic, introduction, body, conclusion, finalFullText]);
    
    const handleFinalSubmit = () => {
        if (!validations.step3) {
             alert(`글의 최종 내용을 확인하고 수정해주세요.`);
             return;
        }
        
        const essayData: EssayData = {
            topic: finalTopic,
            introduction,
            body,
            conclusion,
            fullText: finalFullText.trim(),
        };

        if (isEditMode && onUpdate) {
            onUpdate(essayData);
        } else if (onComplete) {
            const editCode = Math.random().toString(36).substring(2, 8);
            onComplete({
                ...essayData,
                student,
                editCode,
            });
        }
    };

    const goToNextStep = () => {
        if (step === 1 && !validations.step1) return;
        if (step === 2) {
            if (!validations.step2) {
                alert(`서론과 결론은 각각 ${MIN_LEN}자 이상, 본론의 모든 근거와 출처를 입력해야 합니다.`);
                return;
            }
            // Always regenerate full text when moving from step 2 to 3
            setFinalFullText(generateFullText());
        }
        setStep(s => s + 1);
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div>
                        <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
                            어떤 주장에 대해 글을 쓰고 싶나요? 주제를 자유롭게 적어보세요.
                        </label>
                        <div className="flex gap-2">
                            <input
                                id="topic"
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="예: 초등학생의 스마트폰 사용을 금지해야 한다"
                                className="flex-grow block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                            <button
                                onClick={handleRefineTopic}
                                disabled={isRefining}
                                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                            >
                                {isRefining ? <LoadingSpinner /> : <SparklesIcon />}
                                <span className="ml-2">AI 추천</span>
                            </button>
                        </div>
                        
                        {isRefining && <p className="text-sm text-gray-500 mt-4">AI가 더 좋은 주제를 찾고 있어요. 잠시만 기다려주세요...</p>}
                        
                        {refinedTopic && (
                            <div className="mt-6 bg-indigo-50 p-4 rounded-lg">
                                <h3 className="font-semibold text-gray-800 mb-3">AI가 추천하는 주제예요!</h3>
                                <div className="space-y-2">
                                    <button onClick={() => { setRefinedTopic(refinedTopic); setTopic(refinedTopic); }} className="w-full text-left p-3 bg-white rounded-md shadow-sm hover:bg-indigo-100 transition-colors">
                                        <p className="font-bold text-indigo-700">{refinedTopic}</p>
                                        <p className="text-xs text-gray-500">(원래 주제를 다듬었어요)</p>
                                    </button>
                                    {topicSuggestions.map((s, i) => (
                                        <button key={i} onClick={() => { setRefinedTopic(s); setTopic(s); }} className="w-full text-left p-3 bg-white rounded-md shadow-sm hover:bg-indigo-100 transition-colors">
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-semibold text-gray-800">서론</h3>
                                <span className={`text-sm ${introduction.length < MIN_LEN ? 'text-red-500' : 'text-gray-500'}`}>{introduction.length} / {MIN_LEN}자 이상</span>
                            </div>
                            <textarea
                                value={introduction}
                                onChange={(e) => setIntroduction(e.target.value)}
                                placeholder="글을 쓰게 된 이유, 문제 상황, 그리고 나의 주장을 명확하게 밝혀주세요."
                                className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">본론</h3>
                            {body.map((part, index) => (
                                <div key={index} className="bg-gray-50 p-4 rounded-lg mb-4 relative">
                                    {body.length > 1 && (
                                        <button onClick={() => removeReason(index)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <textarea
                                        value={part.reason}
                                        onChange={(e) => updateBodyPart(index, 'reason', e.target.value)}
                                        placeholder={`주장을 뒷받침하는 근거 #${index + 1}을 작성해주세요.`}
                                        className="w-full h-24 p-2 mb-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <input
                                        type="text"
                                        value={part.source}
                                        onChange={(e) => updateBodyPart(index, 'source', e.target.value)}
                                        placeholder="근거의 출처 (예: 뉴스 기사, 책, 내 경험 등)"
                                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            ))}
                            <button onClick={addReason} className="mt-2 inline-flex items-center px-3 py-1.5 border border-dashed border-gray-400 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50">
                                <PlusIcon className="w-4 h-4 mr-2" /> 근거 추가하기
                            </button>
                        </div>
                        <div>
                           <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-semibold text-gray-800">결론</h3>
                                <span className={`text-sm ${conclusion.length < MIN_LEN ? 'text-red-500' : 'text-gray-500'}`}>{conclusion.length} / {MIN_LEN}자 이상</span>
                            </div>
                            <textarea
                                value={conclusion}
                                onChange={(e) => setConclusion(e.target.value)}
                                placeholder="지금까지의 내용을 요약하고, 주장을 다시 한번 강조하며 글을 마무리해주세요."
                                className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">글을 마지막으로 확인해주세요</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            아래 상자에서 글의 전체 내용을 확인하고, 오타나 어색한 문장이 있다면 자유롭게 수정할 수 있어요.
                            모두 확인했다면 '{isEditMode ? '수정 완료' : '완성'}' 버튼을 눌러주세요.
                        </p>
                        <div className="p-4 bg-white border border-gray-200 rounded-md mb-4">
                            <h4 className="font-bold text-indigo-700 text-xl mb-3">{finalTopic}</h4>
                            <p className="text-sm text-gray-500 mb-4">
                              {student.grade}학년 {student.classNumber}반 {student.studentId}번 {student.name}
                            </p>
                        </div>
                        <textarea
                            value={finalFullText}
                            onChange={(e) => setFinalFullText(e.target.value)}
                            className="w-full h-80 p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            aria-label="최종 글 내용"
                        />
                        <div className="mt-4">
                            <h4 className="font-semibold text-gray-800 mb-2">출처 목록</h4>
                            <ul className="list-disc list-inside bg-gray-50 p-3 rounded-md text-sm text-gray-700 space-y-1">
                                {body.filter(p => p.source.trim()).map((part, index) => (
                                    <li key={index}><Linkify text={part.source} /></li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );
             default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full mx-auto">
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <div className="flex justify-between items-start mb-6 border-b pb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">
                              {step === 1 && '1단계: 주제 정하기'}
                              {step === 2 && '2단계: 내용 작성하기'}
                              {step === 3 && `3단계: ${isEditMode ? '수정하고 제출하기' : '완성하고 제출하기'}`}
                            </h2>
                            <p className="text-gray-500 mt-1 truncate max-w-md">{finalTopic || '아직 주제가 정해지지 않았어요.'}</p>
                        </div>
                        <button onClick={onBackToGallery} className="text-sm text-gray-500 hover:text-gray-800 flex-shrink-0 ml-4">갤러리로 돌아가기</button>
                    </div>
                    
                    <div className="min-h-[500px]">
                        {renderStep()}
                    </div>

                    <div className="mt-8 pt-6 border-t flex justify-between items-center">
                        <button
                            onClick={() => setStep(s => s - 1)}
                            disabled={step === 1}
                            className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeftIcon className="w-5 h-5 mr-2" />
                            이전
                        </button>
                        {step < 3 ? (
                            <button
                                onClick={goToNextStep}
                                disabled={ (step === 1 && !validations.step1) }
                                className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
                            >
                                다음
                                <ChevronRightIcon className="w-5 h-5 ml-2" />
                            </button>
                        ) : (
                            <button
                                onClick={handleFinalSubmit}
                                disabled={!validations.step3}
                                className="flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300"
                            >
                                <CheckCircleIcon className="w-5 h-5 mr-2" />
                                {isEditMode ? '수정 완료!' : '완성!'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


const GalleryView: React.FC<{
    essays: Essay[];
    onSelectEssay: (essay: Essay) => void;
    onNewEssay: () => void;
    onModifyEssay: () => void;
    onDeleteEssay: (id: string) => Promise<void>;
    isAdmin: boolean;
    likedEssayIds: Set<string>;
    onGoHome: () => void;
}> = ({ essays, onSelectEssay, onNewEssay, onModifyEssay, onDeleteEssay, isAdmin, likedEssayIds, onGoHome }) => (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">우리들의 글 솜씨 뽐내기</h1>
                <p className="mt-1 text-gray-600">친구들의 글을 읽고, 응원의 '좋아요'와 댓글을 남겨주세요!</p>
            </div>
            <div className="flex items-center gap-2 mt-4 sm:mt-0 flex-shrink-0">
                <button
                    onClick={onGoHome}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                    처음으로
                </button>
                <button
                    onClick={onModifyEssay}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                    글 수정하기
                </button>
                <button
                    onClick={onNewEssay}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    새 글 작성하기
                </button>
            </div>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {essays.map(essay => (
                <EssayCard
                    key={essay.id}
                    essay={essay}
                    onSelect={() => onSelectEssay(essay)}
                    isAdmin={isAdmin}
                    onDelete={onDeleteEssay}
                    isLiked={likedEssayIds.has(essay.id)}
                />
            ))}
        </div>
        {essays.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow-md">
                <h3 className="text-xl font-semibold text-gray-800">아직 등록된 글이 없어요.</h3>
                <p className="mt-2 text-gray-500">첫 번째 글을 작성해서 갤러리를 채워보세요!</p>
            </div>
        )}
    </div>
);


const WritingSuccessView: React.FC<{ essay: Essay; onFinish: () => void; }> = ({ essay, onFinish }) => {
    const [isCopied, setIsCopied] = useState(false);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(essay.editCode).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="w-full max-w-lg p-8 text-center space-y-6 bg-white rounded-xl shadow-lg">
                <CheckCircleIcon className="w-16 h-16 text-teal-500 mx-auto" />
                <h2 className="text-2xl font-bold text-gray-800">글이 성공적으로 등록되었어요!</h2>
                <p className="text-gray-600">
                    나중에 글을 수정하고 싶을 때를 대비해서, 아래 '수정 코드'를 꼭 저장해주세요.
                </p>
                <div className="p-4 bg-indigo-50 rounded-lg">
                    <p className="text-sm text-gray-700">나의 수정 코드</p>
                    <div className="flex items-center justify-center gap-4 mt-2">
                        <p className="text-2xl font-bold font-mono text-indigo-700 tracking-widest">{essay.editCode}</p>
                        <button onClick={handleCopy} className="px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                            {isCopied ? '복사됨!' : '복사'}
                        </button>
                    </div>
                </div>
                <button onClick={onFinish} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700">
                    갤러리로 이동하기
                </button>
            </div>
        </div>
    );
};


const CommentForm: React.FC<{
    onSubmit: (content: string, authorInfo: { grade: number; class: number; number: number; name: string }) => Promise<void>;
    studentInfo: Student | null;
    isAdmin: boolean;
}> = ({ onSubmit, studentInfo, isAdmin }) => {
    const [content, setContent] = useState('');
    const [author, setAuthor] = useState({ grade: '6', classNumber: '', studentId: '', name: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isAdmin) {
            setAuthor({ grade: '0', classNumber: '0', studentId: '0', name: '선생님' });
        } else if (studentInfo) {
            setAuthor({ ...studentInfo, studentId: studentInfo.studentId });
        }
    }, [studentInfo, isAdmin]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAuthor({ ...author, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !author.name.trim() || !author.classNumber.trim() || !author.studentId.trim()) {
            alert('정보와 댓글 내용을 모두 입력해주세요.');
            return;
        }
        setIsSubmitting(true);
        try {
            await onSubmit(content, {
                grade: parseInt(author.grade, 10),
                class: parseInt(author.classNumber, 10),
                number: parseInt(author.studentId, 10),
                name: author.name,
            });
            setContent('');
        } catch (error) {
            alert('댓글 작성 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const isAuthorInfoReadOnly = isAdmin || !!studentInfo;

    return (
        <form onSubmit={handleSubmit} className="border-t pt-6">
            <div className={`grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3 ${isAuthorInfoReadOnly ? 'opacity-70' : ''}`}>
                 <input type="text" value={author.grade} readOnly className="col-span-1 sm:col-span-1 block w-full px-2 py-1.5 bg-gray-100 border border-gray-300 rounded-md text-sm" placeholder="학년"/>
                 <input type="number" name="classNumber" value={author.classNumber} onChange={handleChange} required readOnly={isAuthorInfoReadOnly} className={`col-span-1 sm:col-span-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm ${isAuthorInfoReadOnly ? 'bg-gray-100' : ''}`} placeholder="반"/>
                 <input type="number" name="studentId" value={author.studentId} onChange={handleChange} required readOnly={isAuthorInfoReadOnly} className={`col-span-1 sm:col-span-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm ${isAuthorInfoReadOnly ? 'bg-gray-100' : ''}`} placeholder="번호"/>
                 <input type="text" name="name" value={author.name} onChange={handleChange} required readOnly={isAuthorInfoReadOnly} className={`col-span-1 sm:col-span-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm ${isAuthorInfoReadOnly ? 'bg-gray-100' : ''}`} placeholder="이름"/>
            </div>
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-24 p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="따뜻한 응원과 격려의 댓글을 남겨주세요."
                required
            />
            <div className="text-right mt-3">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                >
                    {isSubmitting ? <LoadingSpinner /> : '댓글 달기'}
                </button>
            </div>
        </form>
    );
};


const EssayDetailView: React.FC<{
    essay: Essay;
    comments: Comment[];
    onBack: () => void;
    onLikeToggle: (essayId: string) => void;
    isLiked: boolean;
    onAddComment: (content: string, authorInfo: { grade: number; class: number; number: number; name: string }) => Promise<void>;
    studentInfo: Student | null;
    isAdmin: boolean;
}> = ({ essay, comments, onBack, onLikeToggle, isLiked, onAddComment, studentInfo, isAdmin }) => {
    
    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="mb-6">
                <button onClick={onBack} className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-indigo-600">
                    <ArrowLeftIcon className="w-5 h-5 mr-2" />
                    목록으로 돌아가기
                </button>
            </div>

            <article className="bg-white rounded-xl shadow-lg p-8">
                <header className="border-b pb-4 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">{essay.topic}</h1>
                    <p className="mt-2 text-sm text-gray-500">
                        {essay.student.grade}학년 {essay.student.classNumber}반 {essay.student.studentId}번 {essay.student.name}
                        <span className="mx-2">•</span>
                        {new Date(essay.createdAt).toLocaleDateString()}
                    </p>
                </header>
                
                <div className="prose prose-indigo max-w-none whitespace-pre-wrap">{essay.fullText}</div>

                 {essay.body && essay.body.some(p => p.source.trim()) && (
                    <div className="mt-8 pt-6 border-t">
                        <h4 className="font-semibold text-gray-800 mb-2">출처 목록</h4>
                        <ul className="list-disc list-inside bg-gray-50 p-3 rounded-md text-sm text-gray-700 space-y-1">
                            {essay.body.filter(p => p.source.trim()).map((part, index) => (
                                <li key={index}><Linkify text={part.source} /></li>
                            ))}
                        </ul>
                    </div>
                )}

                <footer className="mt-8 pt-6 border-t flex items-center justify-between">
                    <button
                        onClick={() => onLikeToggle(essay.id)}
                        disabled={isLiked}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                            isLiked 
                            ? 'bg-red-100 text-red-600 cursor-not-allowed opacity-75' 
                            : 'bg-gray-100 text-gray-600 hover:bg-red-50'
                        }`}
                    >
                        <HeartIcon className="w-5 h-5" filled={isLiked} />
                        <span className="font-semibold">{essay.likes}</span>
                    </button>
                </footer>
            </article>

            <section className="mt-8 bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <ChatBubbleIcon className="w-6 h-6 text-gray-500" />
                    댓글 ({comments.length})
                </h2>
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2">
                    {comments.length > 0 ? (
                        comments.map(comment => (
                            <div key={comment.id} className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-gray-800 whitespace-pre-wrap">{comment.content}</p>
                                <p className="text-xs text-gray-500 mt-2">
                                    {comment.authorName === '선생님' ? '선생님' : `${comment.authorGrade}학년 ${comment.authorClass}반 ${comment.authorNumber}번 ${comment.authorName}`}
                                    <span className="mx-2">•</span>
                                    {new Date(comment.createdAt).toLocaleString()}
                                </p>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-sm">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
                    )}
                </div>
                <CommentForm onSubmit={onAddComment} studentInfo={studentInfo} isAdmin={isAdmin} />
            </section>
        </div>
    );
};

const EditCodePrompt: React.FC<{
    onFind: (code: string) => Promise<boolean>;
    onCancel: () => void;
}> = ({ onFind, onCancel }) => {
    const [code, setCode] = useState('');
    const [isFinding, setIsFinding] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!code.trim()) {
            setError('수정 코드를 입력해주세요.');
            return;
        }
        setIsFinding(true);
        const found = await onFind(code.trim());
        if (!found) {
            setError('코드가 일치하는 글을 찾을 수 없습니다.');
        }
        // On success, the parent component will change the view.
        setIsFinding(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-center text-gray-800">글 수정 또는 삭제</h2>
                <p className="text-center text-sm text-gray-600">글을 작성할 때 받은 수정 코드를 입력해주세요.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="editCode" className="block text-sm font-medium text-gray-700 sr-only">수정 코드</label>
                        <input
                            type="text"
                            id="editCode"
                            name="editCode"
                            value={code}
                            onChange={(e) => { setCode(e.target.value); setError(''); }}
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="수정 코드 (예: a1b2c3)"
                        />
                    </div>

                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                    <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                        <button type="button" onClick={onCancel} className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                            취소
                        </button>
                        <button type="submit" disabled={isFinding} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300">
                            {isFinding ? <LoadingSpinner /> : '글 찾기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const FoundEssayActionsView: React.FC<{
    essay: Essay;
    onEdit: () => void;
    onDelete: () => void;
    onCancel: () => void;
}> = ({ essay, onEdit, onDelete, onCancel }) => {

    const handleDelete = () => {
        // The sandbox environment blocks `window.confirm`, so it was removed.
        // Deletion is now immediate upon click.
        onDelete();
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-center text-gray-800">어떤 작업을 하시겠어요?</h2>
                <div className="p-4 bg-gray-50 rounded-lg text-left">
                    <p className="text-sm text-gray-600">선택한 글:</p>
                    <h3 className="font-bold text-indigo-700 text-lg truncate">{essay.topic}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        작성자: {essay.student.name} ({essay.student.grade}학년 {essay.student.classNumber}반 {essay.student.studentId}번)
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button onClick={onEdit} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                        글 수정하기
                    </button>
                    <button onClick={handleDelete} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                        글 삭제하기
                    </button>
                </div>
                 <div className="text-center pt-2">
                    <button onClick={onCancel} className="text-sm text-gray-600 hover:underline">
                        취소하고 갤러리로 돌아가기
                    </button>
                </div>
            </div>
        </div>
    );
};


// ---------- MAIN APP COMPONENT ----------

type CurrentView = 'landing' | 'student-info' | 'teacher-login' | 'writing' | 'gallery' | 'detail' | 'writing-success' | 'edit-code-prompt' | 'editing' | 'found-essay-actions';

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<CurrentView>('landing');
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [studentInfo, setStudentInfo] = useState<Student | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    
    const [essays, setEssays] = useState<Essay[]>([]);
    const [selectedEssay, setSelectedEssay] = useState<Essay | null>(null);
    const [essayToEdit, setEssayToEdit] = useState<Essay | null>(null);
    const [lastSubmittedEssay, setLastSubmittedEssay] = useState<Essay | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [likedEssayIds, setLikedEssayIds] = useState<Set<string>>(new Set());
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            const liked = window.localStorage.getItem('likedEssays');
            if (liked) {
                setLikedEssayIds(new Set(JSON.parse(liked)));
            }
        } catch (e) {
            console.error("Failed to parse liked essays from localStorage", e);
        }
    }, []);

    const fetchAllEssays = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getAllEssays();
            setEssays(data);
        } catch (err) {
            setError('글 목록을 불러오는 데 실패했습니다.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    useEffect(() => {
        if (currentView === 'gallery') {
            fetchAllEssays();
        }
    }, [currentView, fetchAllEssays]);

    useEffect(() => {
        const fetchComments = async () => {
            if (selectedEssay) {
                try {
                    const data = await getComments(selectedEssay.id);
                    setComments(data);
                } catch (err) {
                    console.error("Failed to fetch comments:", err);
                    alert('댓글을 불러오는 데 실패했습니다.');
                }
            }
        };
        fetchComments();
    }, [selectedEssay]);

    const handleSelectRole = (role: UserRole) => {
        setUserRole(role);
        if (role === UserRole.STUDENT) {
            setCurrentView('student-info');
        } else {
            setCurrentView('teacher-login');
        }
    };

    const handleBackToLanding = () => {
        setCurrentView('landing');
        setUserRole(null);
        setStudentInfo(null);
        setIsAdmin(false);
    };

    const handleStudentStart = (info: Student) => {
        setStudentInfo(info);
        setCurrentView('gallery');
    };
    
    const handleStartWriting = () => {
        if(!studentInfo && !isAdmin) {
             alert("학생 정보가 없습니다. 시작 화면으로 돌아가 다시 정보를 입력해주세요.");
             setCurrentView('student-info');
             return;
        }
         if(!studentInfo) {
             alert("글쓰기는 학생만 가능합니다.");
             return;
        }
        setCurrentView('writing');
    };

    const handleTeacherLogin = () => {
        setIsAdmin(true);
        setCurrentView('gallery');
    };

    const handleWritingComplete = async (essayData: Omit<Essay, 'id' | 'createdAt' | 'likes'>) => {
        setIsLoading(true);
        try {
            const newEssay = await addEssay(essayData);
            setLastSubmittedEssay(newEssay);
            setCurrentView('writing-success');
        } catch (err) {
            alert('글을 저장하는 데 실패했습니다.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleWritingUpdate = async (essayData: EssayData) => {
        if (!essayToEdit) return;
        setIsLoading(true);
        try {
            await updateEssay(essayToEdit.editCode, essayData);
            alert('글이 성공적으로 수정되었습니다.');
            setEssayToEdit(null);
            setCurrentView('gallery');
        } catch (err) {
            alert('글 수정에 실패했습니다. 다시 시도해주세요.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleStartModify = () => {
        setCurrentView('edit-code-prompt');
    };

    const handleFindEssayToEdit = async (code: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);
        try {
            const essay = await findEssayByEditCode(code);
            if (essay) {
                setEssayToEdit(essay);
                setCurrentView('found-essay-actions');
                return true;
            }
            return false;
        } catch (err) {
            setError('코드를 확인하는 중 오류가 발생했습니다.');
            console.error(err);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectEssay = (essay: Essay) => {
        setSelectedEssay(essay);
        setCurrentView('detail');
    };

    const handleBackToGallery = () => {
        setSelectedEssay(null);
        setEssayToEdit(null);
        setComments([]);
        setCurrentView('gallery');
    };
    
    const handleDeleteEssay = async (id: string) => {
        setIsLoading(true);
        try {
            await deleteEssay(id);
            setEssays(prev => prev.filter(e => e.id !== id));
        } catch (err: any) {
            alert(`글 삭제에 실패했습니다: ${err.message}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
     const handleLikeToggle = async (essayId: string) => {
        if (likedEssayIds.has(essayId)) {
            // 이미 '좋아요'를 누른 경우 아무 작업도 하지 않음
            return;
        }

        const newLikedIds = new Set(likedEssayIds);
        newLikedIds.add(essayId);
        setLikedEssayIds(newLikedIds);
        window.localStorage.setItem('likedEssays', JSON.stringify(Array.from(newLikedIds)));

        const updateLikesInState = (updatedEssay: Essay) => {
            setEssays(prevEssays => prevEssays.map(e => e.id === essayId ? updatedEssay : e));
            if (selectedEssay?.id === essayId) {
                setSelectedEssay(updatedEssay);
            }
        };

        try {
            const updatedEssay = await incrementLike(essayId);
            updateLikesInState(updatedEssay);
        } catch (err) {
            console.error('Failed to update likes:', err);
            alert('좋아요 상태 변경에 실패했습니다.');
            // 실패 시 UI 변경사항 되돌리기
            const revertedLikedIds = new Set(likedEssayIds);
            revertedLikedIds.delete(essayId);
            setLikedEssayIds(revertedLikedIds);
            window.localStorage.setItem('likedEssays', JSON.stringify(Array.from(revertedLikedIds)));
        }
    };

    const handleAddComment = async (content: string, authorInfo: { grade: number; class: number; number: number; name: string }) => {
        if (!selectedEssay) return;
        try {
            const newComment = await addComment(selectedEssay.id, authorInfo.name, content, authorInfo);
            setComments(prev => [...prev, newComment].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
        } catch (err) {
            console.error('Failed to add comment:', err);
            throw err;
        }
    };

    const handleStartEditingFoundEssay = () => {
        if (essayToEdit) {
            setCurrentView('editing');
        }
    };

    const handleDeleteFoundEssay = async () => {
        if (essayToEdit) {
            await handleDeleteEssay(essayToEdit.id);
            handleBackToGallery(); // 삭제 후 갤러리로 이동
        }
    };

    const renderContent = () => {
        if (isLoading && !['edit-code-prompt', 'editing', 'found-essay-actions'].includes(currentView)) {
            return <div className="flex justify-center items-center h-screen"><LoadingSpinner size="w-12 h-12" /></div>;
        }
        if (error) {
            return <div className="text-center text-red-500 p-8">{error}</div>;
        }

        switch (currentView) {
            case 'landing':
                return <LandingPage onSelectRole={handleSelectRole} />;
            case 'student-info':
                return <StudentInfoForm onStart={handleStudentStart} onBack={handleBackToLanding} />;
            case 'teacher-login':
                return <TeacherLogin onLogin={handleTeacherLogin} onBack={handleBackToLanding} />;
            case 'writing':
                if (!studentInfo) {
                    setCurrentView('student-info');
                    return null;
                }
                return <WritingWizard student={studentInfo} onComplete={handleWritingComplete} onBackToGallery={handleBackToGallery} />;
            case 'editing':
                if (!essayToEdit) {
                    handleBackToGallery();
                    return null;
                }
                return <WritingWizard student={essayToEdit.student} initialData={essayToEdit} onUpdate={handleWritingUpdate} onBackToGallery={handleBackToGallery} />;
            case 'writing-success':
                 if (!lastSubmittedEssay) {
                    handleBackToGallery();
                    return null;
                 }
                 return <WritingSuccessView essay={lastSubmittedEssay} onFinish={handleBackToGallery} />;
            case 'gallery':
                return <GalleryView
                    essays={essays}
                    onSelectEssay={handleSelectEssay}
                    onNewEssay={handleStartWriting}
                    onModifyEssay={handleStartModify}
                    onDeleteEssay={handleDeleteEssay}
                    isAdmin={isAdmin}
                    likedEssayIds={likedEssayIds}
                    onGoHome={handleBackToLanding}
                />;
            case 'detail':
                if (!selectedEssay) {
                    handleBackToGallery();
                    return null;
                }
                return <EssayDetailView
                    essay={selectedEssay}
                    comments={comments}
                    onBack={handleBackToGallery}
                    onLikeToggle={handleLikeToggle}
                    isLiked={likedEssayIds.has(selectedEssay.id)}
                    onAddComment={handleAddComment}
                    studentInfo={studentInfo}
                    isAdmin={isAdmin}
                 />;
            case 'edit-code-prompt':
                return <EditCodePrompt onFind={handleFindEssayToEdit} onCancel={handleBackToGallery} />;
            case 'found-essay-actions':
                if (!essayToEdit) {
                    handleBackToGallery();
                    return null;
                }
                return <FoundEssayActionsView
                    essay={essayToEdit}
                    onEdit={handleStartEditingFoundEssay}
                    onDelete={handleDeleteFoundEssay}
                    onCancel={handleBackToGallery}
                />;
            default:
                return <LandingPage onSelectRole={handleSelectRole} />;
        }
    };

    if (!isSupabaseConfigured) {
        return <SupabaseSetupNeeded />;
    }

    return <div className="bg-gray-50 min-h-screen">{renderContent()}</div>;
};

export default App;
