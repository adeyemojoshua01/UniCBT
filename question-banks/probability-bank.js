window.CBT_SUBJECT_BANKS = window.CBT_SUBJECT_BANKS || [];
window.CBT_SUBJECT_BANKS.push(`Subject: Probability
Topic: Combinatorics

SubTopic: Permutations & Combinations
Type: MCQ
Q001: How many distinct ways can the letters of the word "LEVEL" be arranged?
Option: A: 30
Option: B: 60
Option: C: 120
Option: D: 20
Answer: A
Explanation: The letters are L, E, V, E, L: 5 letters with L repeated twice and E repeated twice. Arrangements = \\(\\frac{5!}{2!\\,2!} = \\frac{120}{4} = 30\\).

SubTopic: Permutations & Combinations
Type: MCQ
Q002: A committee of 3 is chosen from 8 people. In how many ways can this be done?
Option: A: 336
Option: B: 56
Option: C: 24
Option: D: 112
Answer: B
Explanation: Order does not matter, so use a combination: \\({}^{8}C_{3} = \\frac{8!}{3!\\,5!} = 56\\).

SubTopic: Permutations & Combinations
Type: MCQ
Q003: How many ways can 4 different books be arranged on a shelf?
Option: A: 4
Option: B: 12
Option: C: 24
Option: D: 16
Answer: C
Explanation: Arrange 4 distinct objects in a row: \\(4! = 4 \\times 3 \\times 2 \\times 1 = 24\\).

SubTopic: Permutations & Combinations
Type: Fill
Q004: A 4-digit PIN is formed from digits 0-9 with repetition allowed. How many possible PINs exist? (give the number)
Answer: 10000
Explanation: Each of the 4 positions has 10 choices, so \\(10^{4} = 10000\\).

SubTopic: Multinomial Counting
Type: Theory
Q005: A multiple-choice test has 8 questions, each with 4 options. In how many ways can a student answer every question? Justify whether you need permutations or the multiplication principle.
Marks: 10
Explanation: Each question is answered independently in 4 ways. By the multiplication principle the total is \\(4^{8} = 65536\\). Order matters within the answer string but the questions are distinct positions, so the multiplication principle applies rather than a permutation formula.

Topic: Conditional Probability

SubTopic: Independence & Bayes
Type: MCQ
Q006: For independent events A and B with P(A) = 0.5 and P(B) = 0.4, what is P(A and B)?
Option: A: 0.9
Option: B: 0.2
Option: C: 0.1
Option: D: 0.45
Answer: B
Explanation: For independent events, \\(P(A \\cap B) = P(A)P(B) = 0.5 \\times 0.4 = 0.2\\).

SubTopic: Independence & Bayes
Type: MCQ
Q007: A fair die is rolled. Given that the result is even, what is the probability that it is greater than 2?
Option: A: \\(\\frac{1}{2}\\)
Option: B: \\(\\frac{2}{3}\\)
Option: C: \\(\\frac{1}{3}\\)
Option: D: \\(\\frac{3}{4}\\)
Answer: B
Explanation: Even outcomes are {2, 4, 6}. Of these, 4 and 6 exceed 2, so the conditional probability is \\(\\frac{2}{3}\\).

SubTopic: Independence & Bayes
Type: MCQ
Q008: Two cards are drawn without replacement from a standard deck. What is the probability that both are aces?
Option: A: \\(\\frac{1}{169}\\)
Option: B: \\(\\frac{1}{221}\\)
Option: C: \\(\\frac{4}{52}\\)
Option: D: \\(\\frac{16}{2704}\\)
Answer: B
Explanation: \\(P = \\frac{4}{52} \\times \\frac{3}{51} = \\frac{12}{2652} = \\frac{1}{221}\\).

SubTopic: Independence & Bayes
Type: Fill
Q009: If \\(P(A) = 0.6\\), \\(P(B) = 0.5\\) and \\(P(A \\cup B) = 0.8\\), what is \\(P(A \\cap B)\\)?
Answer: 0.3
Explanation: Use inclusion-exclusion: \\(P(A \\cap B) = P(A) + P(B) - P(A \\cup B) = 0.6 + 0.5 - 0.8 = 0.3\\).

SubTopic: Independence & Bayes
Type: Theory
Q010: State Bayes' theorem and explain what each term represents. Then describe one practical situation in which Bayes' theorem improves a decision.
Marks: 10
Explanation: Bayes' theorem states \\(P(A \\mid B) = \\frac{P(B \\mid A)P(A)}{P(B)}\\). Here \\(P(A)\\) is the prior belief, \\(P(B \\mid A)\\) is the likelihood, \\(P(B)\\) is the evidence and \\(P(A \\mid B)\\) is the posterior. In medical screening, a positive test updates the prior prevalence using test sensitivity and specificity, so a clinician can interpret a positive result in light of how rare the disease is rather than the test alone.
`);
