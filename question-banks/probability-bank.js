window.CBT_SUBJECT_BANKS = window.CBT_SUBJECT_BANKS || [];

window.CBT_SUBJECT_BANKS.push(`Subject: Probability
Duration: 30

Topic: Basic Probability

SubTopic: Sample Spaces & Events
Type: MCQ
Q001: A fair six-sided die is rolled once. What is the probability of getting an even number?
Option: A: \\( \\frac{1}{6} \\)
Option: B: \\( \\frac{1}{3} \\)
Option: C: \\( \\frac{1}{2} \\)
Option: D: \\( \\frac{2}{3} \\)
Answer: C
Explanation: The even outcomes are 2, 4 and 6, so there are 3 favourable outcomes out of 6 equally likely outcomes. Hence \\( P(\\text{even}) = \\frac{3}{6} = \\frac{1}{2} \\).

Type: Fill
Q002: A certain (sure) event has a probability equal to ____.
Answer: 1
Explanation: By the axioms of probability, \\( P(S) = 1 \\) for the whole sample space \\( S \\), so a sure event always has probability 1.

Type: MCQ
Q003: Two fair coins are tossed. What is the probability of getting exactly two heads?
Option: A: \\( \\frac{1}{4} \\)
Option: B: \\( \\frac{1}{2} \\)
Option: C: \\( \\frac{3}{4} \\)
Option: D: \\( 1 \\)
Answer: A
Explanation: The sample space is \\( \\{HH, HT, TH, TT\\} \\) with 4 equally likely outcomes, and only HH has two heads, so the probability is \\( \\frac{1}{4} \\).

SubTopic: Conditional Probability
Type: MCQ
Q004: Given \\( P(A) = 0.5 \\), \\( P(B) = 0.4 \\) and \\( P(A \\cap B) = 0.2 \\), find \\( P(A \\mid B) \\).
Option: A: 0.2
Option: B: 0.4
Option: C: 0.5
Option: D: 0.8
Answer: C
Explanation: Using \\( P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)} = \\frac{0.2}{0.4} = 0.5 \\).

Type: MCQ
Q005: Events A and B are independent with \\( P(A) = 0.3 \\) and \\( P(B) = 0.5 \\). What is \\( P(A \\cap B) \\)?
Option: A: 0.80
Option: B: 0.20
Option: C: 0.15
Option: D: 0.65
Answer: C
Explanation: For independent events \\( P(A \\cap B) = P(A)\\,P(B) = 0.3 \\times 0.5 = 0.15 \\).

Type: Fill
Q006: If A and B are mutually exclusive events, then \\( P(A \\cap B) = \\) ____.
Answer: 0
Explanation: Mutually exclusive events cannot occur together, so their intersection is the empty set and \\( P(A \\cap B) = 0 \\).

Type: Theory
Q007: State Bayes' theorem and explain, with a short example, how it is used to update a probability when new evidence is observed.
Marks: 10
Explanation: Bayes' theorem states that \\( P(A \\mid B) = \\frac{P(B \\mid A)\\,P(A)}{P(B)} \\). It updates the prior probability P(A) into a posterior probability P(A | B) after observing evidence B. Example: in medical testing, the probability that a patient has a disease given a positive test depends on the test sensitivity, the false-positive rate and the prior prevalence of the disease.

Topic: Random Variables

SubTopic: Expectation & Variance
Type: MCQ
Q008: What is the expected value of the score when a fair six-sided die is rolled?
Option: A: 3
Option: B: 3.5
Option: C: 4
Option: D: 6
Answer: B
Explanation: \\( E[X] = \\frac{1+2+3+4+5+6}{6} = \\frac{21}{6} = 3.5 \\).

Type: MCQ
Q009: If \\( \\text{Var}(X) = 4 \\) and \\( Y = 3X + 2 \\), what is \\( \\text{Var}(Y) \\)?
Option: A: 12
Option: B: 14
Option: C: 36
Option: D: 38
Answer: C
Explanation: Adding a constant does not change variance, and scaling by a multiplies variance by \\( a^2 \\). So \\( \\text{Var}(Y) = 3^2 \\times 4 = 36 \\).

Type: Fill
Q010: The expected value of a Bernoulli random variable with success probability p is ____.
Answer: p
Explanation: \\( E[X] = 1 \\cdot p + 0 \\cdot (1-p) = p \\).

SubTopic: Distributions
Type: MCQ
Q011: A binomial random variable has parameters \\( n = 10 \\) and \\( p = 0.5 \\). What is its mean?
Option: A: 2.5
Option: B: 5
Option: C: 10
Option: D: 0.5
Answer: B
Explanation: The mean of a binomial distribution is \\( np = 10 \\times 0.5 = 5 \\).

Type: Theory
Q012: Describe the Poisson distribution. State its parameter, its mean and variance, and give one real-world situation that it models well.
Marks: 10
Explanation: The Poisson distribution models the number of events occurring in a fixed interval when events occur independently at a constant average rate \\( \\lambda \\). Its pmf is \\( P(X=k) = \\frac{e^{-\\lambda}\\lambda^k}{k!} \\), and both its mean and variance equal \\( \\lambda \\). Examples include the number of calls arriving at a call centre per hour or the number of typing errors per page.
`);
