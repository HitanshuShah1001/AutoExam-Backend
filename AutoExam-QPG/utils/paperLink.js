const API_AUTOEXAM = "https://api.autoexam.in";
export const getQuestionPaperLinkToSendOverMessage = ({ paperId }) => {
  return `${API_AUTOEXAM}/fetch/paper?id=${paperId}`;
};

export const getSolutionSheetLinkToSendOverMessage = ({ solutionId }) => {
  return `${API_AUTOEXAM}/fetch/solution?id=${solutionId}`;
};
