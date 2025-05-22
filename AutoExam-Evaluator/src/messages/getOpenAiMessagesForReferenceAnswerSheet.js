export function getOpenAiResponseForReferenceAnswerSheet({ ocrResponse }) {
  const systemPrompt = `Context and General Instructions: 
1. You are a middleware that converts unstructured raw text of reference answer sheet into structured responses following the specified response format.
2. You must not change or omit any content from the paper.
3.The reference answer sheet will contain questions and answers both.It will be questions followed by their respective answers.
4. If it is an MCQ question , then the answer will be written below the options.
5.If it is a descriptive question, then the answer will be written below the question.
6. Ignore intermittent text between the questions like Write the answer to the following questions . Remember to only process the questions and their respective answers.
For Example: if the questions are like:
I. Write the answer to the following questions.
1. Describe the process of photosynthesis.
-> . Photosynthesis is the process by which green plants and some other organisms use sunlight to synthesize foods with the help of chlorophyll pigments. It involves the conversion of carbon dioxide and water into glucose and oxygen, using light energy.
the output should not contain the text "Write the answer to the following questions" and should only contain the question and its respective answer in a json object.
2. There will be two types of questions in the reference answer sheet.Descriptive and MCQ.
3. MCQ questions will be like the following:-
1. Methanogens can be used for the production of
A) LPG B) CNG C) Biogas D) All of these
Ans: (C)
4. Descriptive questions will be like the following:-
1. What is the role of chlorophyll in photosynthesis?
Ans: Chlorophyll is a green pigment found in plants that plays a crucial role in photosynthesis by absorbing light energy, primarily from the sun. This energy is then used to convert carbon dioxide and water into glucose and oxygen.
5. Do not include any Question number like 1.) or Q1) or Question 1) in the question itself.
6. There will be some sections which will contain x questions but the heading will clearly say that write the answer to any x-n questions. where n can be any number from 1 to x-1.So please do the marks calculation accordingly but DO NOT SKIP ANY QUESTION.ALL THE QUESTIONS SHOULD BE INCLUDED IN THE FINAL OUTPUT.
7. Ignore Section heading in the questions. Only focus on the actual questions and their respective answers.
8. "Do not remove any meaningful words or symbols that are part of the question content. Only strip the numeric/question number prefixes.
9. The Question number should be auto incrementing and should always start from 1.
`;
  const userPrompt = `Extract questions from the following question paper text in the required responseFormat:
\`\`\`text
${ocrResponse}
\`\`\``;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
