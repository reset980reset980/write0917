
import React from 'react';
import { Essay } from '../types';
import { TrashIcon, HeartIcon } from './icons';

interface EssayCardProps {
  essay: Essay;
  onSelect: () => void;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  isLiked?: boolean;
}

const EssayCard: React.FC<EssayCardProps> = ({ essay, onSelect, isAdmin = false, onDelete, isLiked = false }) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && window.confirm("정말로 이 글을 삭제하시겠습니까? 삭제된 글은 복구할 수 없습니다.")) {
      onDelete(essay.id);
    }
  };

  return (
    <div
      onClick={onSelect}
      className="relative flex flex-col bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 p-6 cursor-pointer border border-gray-200"
    >
      {isAdmin && onDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 p-2 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors z-10"
          aria-label="삭제하기"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      )}
      <div className="flex-grow">
        <h3 className="text-lg font-bold text-indigo-700 mb-2 truncate pr-8">{essay.topic}</h3>
        <p className="text-sm text-gray-500 mb-4">
          {essay.student.grade}학년 {essay.student.classNumber}반 {essay.student.studentId}번 {essay.student.name}
        </p>
        <p className="text-gray-600 text-sm line-clamp-3 h-16">{essay.introduction}</p>
      </div>
      <div className="mt-4">
        {isAdmin && (
            <div className="mb-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded-md inline-block">
                    수정 코드: <span className="font-bold text-indigo-700">{essay.editCode}</span>
                </p>
            </div>
        )}
        <div className={`flex justify-between items-center ${!isAdmin ? 'pt-3 border-t border-gray-100' : ''}`}>
          <div className="flex items-center gap-2 text-red-500">
            <HeartIcon className="w-5 h-5" filled={isLiked}/>
            <span className="text-sm font-semibold">{essay.likes}</span>
          </div>
          <div className="text-right text-xs text-gray-400">
            {new Date(essay.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EssayCard;