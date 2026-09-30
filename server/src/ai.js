import { GoogleGenAI, Type } from '@google/genai';
import { config } from './config.js';

const ai = config.geminiApiKey ? new GoogleGenAI({ apiKey: config.geminiApiKey }) : null;

export const isAiConfigured = !!ai;

function gradeLabel(grade) {
  const g = Number(grade);
  return Number.isInteger(g) && g >= 1 && g <= 6 ? `초등학교 ${g}학년` : '초등학교';
}

export async function getTopicSuggestions(originalTopic, grade) {
  if (!ai) {
    return { refinedTopic: 'AI 기능이 아직 설정되지 않았어요. 선생님께 알려주세요.', suggestions: [] };
  }

  const prompt = `${gradeLabel(grade)} 학생이 주장하는 글(논설문)의 주제를 작성했습니다.
모든 주제는 명확한 '주장'이 드러나도록 "~해야 한다", "~하자"와 같은 서술로 끝나야 합니다. 설명하는 듯한 제목은 피해주세요.
학생의 학년 수준에 맞는 쉬운 말로 써주세요.

1. 원래 주제를 더 명확하고, 흥미로우며, 논리적인 '주장'으로 다듬어 주세요.
2. 원래 주제와 관련하여, 학생들이 흥미를 가질 만한 새로운 대안 '주장' 3가지를 제안해주세요.

원래 주제: "${originalTopic}"

JSON 형식으로 응답해주세요.`;

  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          refinedTopic: { type: Type.STRING, description: '원래 주제를 다듬은 버전입니다.' },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '대안으로 제시하는 3가지 새로운 주제입니다.',
          },
        },
        required: ['refinedTopic', 'suggestions'],
      },
    },
  });

  const parsed = JSON.parse(response.text);
  return {
    refinedTopic: String(parsed.refinedTopic || ''),
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String).slice(0, 5) : [],
  };
}

export async function getWritingAssistantResponse(context, question, grade) {
  if (!ai) {
    return 'AI 기능이 아직 설정되지 않았어요. 선생님께 알려주세요.';
  }

  const systemInstruction = `당신은 '글쓰기 요정'입니다. 한국의 ${gradeLabel(grade)} 학생이 '주장하는 글'을 쓰는 것을 돕는, 친절하고 상냥한 AI 조수입니다.
- 항상 학생을 격려하는 말투를 사용하고, 학생의 학년 수준에 맞는 이해하기 쉬운 한국어로 설명해주세요.
- 절대로 학생 대신 글을 써주지 마세요.
- 대신, 학생이 스스로 생각하고 더 나은 글을 쓸 수 있도록 '질문'을 던지거나, '예시'를 보여주거나, '단계별 조언'을 해주세요.
- 답변은 간결하고 명확하게 유지해주세요.`;

  const prompt = `학생의 현재 글쓰기 상황:
- 주제: ${context.topic || '(아직 정하지 않았음)'}
- 서론: ${context.introduction || '(아직 작성하지 않았음)'}
- 본론: ${context.body || '(아직 작성하지 않았음)'}
- 결론: ${context.conclusion || '(아직 작성하지 않았음)'}

학생의 질문: "${question}"

위 상황과 질문을 바탕으로, '글쓰기 요정'으로서 학생에게 도움이 되는 답변을 해주세요.`;

  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents: prompt,
    config: { systemInstruction },
  });

  return response.text || '';
}
