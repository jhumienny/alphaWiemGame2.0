export function isAdminRole(role) {
  return role === 'admin'
}

export function flattenUserQuestions(userQuestions = {}) {
  return Object.entries(userQuestions)
    .flatMap(([uid, questions]) => Object.entries(questions || {}).map(([id, question]) => ({
      id,
      uid,
      ...question,
      text: question?.q || question?.text || '(brak treści)',
      answers: question?.a || question?.answers || [],
    })))
    .sort((first, second) => (second.createdAt || 0) - (first.createdAt || 0))
}
