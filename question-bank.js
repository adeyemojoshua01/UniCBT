// ============================================
// QUESTION BANK IMPORTER (Developer Tool)
// ============================================
const MY_QUESTION_BANK = `

Subject: Probability I
Topic: Probability Space & Theorems
Type: MCQ
Q001: Define a sample space. What is the sample space for tossing a single fair coin?
Option: A: The set of all possible outcomes of an experiment; {Heads, Tails}
Option: B: The set of all possible outcomes of an experiment; {Tails}
Option: C: The set of favorable outcomes; {Heads, Tails}
Option: D: The set of all possible outcomes of an experiment; {Heads}
Answer: A
Explanation: A sample space is defined as the set of all possible outcomes of a random experiment. For a single fair coin toss, there are exactly two possible outcomes: Heads and Tails. Therefore, the sample space is {Heads, Tails}.

Type: MCQ
Q002: What is an event in probability? Give an example using a standard six-sided die.
Option: A: A subset of the sample space; Rolling a number greater than 4 is {5, 6}
Option: B: The complement of an outcome; Rolling a number greater than 4 is {1, 2, 3, 4}
Option: C: The total number of outcomes; Rolling a number greater than 4 is 2
Option: D: The probability of an outcome; Rolling a number greater than 4 is \\( \\frac{1}{3} \\)
Answer: A
Explanation: An event is defined as any subset of the sample space. For a six-sided die, the sample space is {1, 2, 3, 4, 5, 6}. Rolling a number greater than 4 includes the outcomes {5, 6}, which is a valid subset.

Topic: Probability Spacious
Type: MCQ
Q001: Define a sample space. What is the sample space for tossing a single fair coin?
Option: A: The set of all possible outcomes of an experiment; {Heads, Tails}
Option: B: The set of all possible outcomes of an experiment; {Tails}
Option: C: The set of favorable outcomes; {Heads, Tails}
Option: D: The set of all possible outcomes of an experiment; {Heads}
Answer: A
Explanation: A sample space is defined as the set of all possible outcomes of a random experiment. For a single fair coin toss, there are exactly two possible outcomes: Heads and Tails. Therefore, the sample space is {Heads, Tails}.

Type: MCQ
Q002: What is an event in probability? Give an example using a standard six-sided die.
Option: A: A subset of the sample space; Rolling a number greater than 4 is {5, 6}
Option: B: The complement of an outcome; Rolling a number greater than 4 is {1, 2, 3, 4}
Option: C: The total number of outcomes; Rolling a number greater than 4 is 2
Option: D: The probability of an outcome; Rolling a number greater than 4 is \\( \\frac{1}{3} \\)
Answer: A
Explanation: An event is defined as any subset of the sample space. For a six-sided die, the sample space is {1, 2, 3, 4, 5, 6}. Rolling a number greater than 4 includes the outcomes {5, 6}, which is a valid subset.

Type: Theory
Q001: Explain the concept of a sample space in probability.
Marks: 10
Explanation: A sample space, often denoted by the symbol S or Ω, is the fundamental foundation of probability theory. It is defined as the set of all possible, distinct outcomes that can result from a random experiment or procedure. For example, when tossing a single fair coin, the sample space consists of exactly two possibilities: {Heads, Tails}. Another example is rolling a standard six-sided die, where the sample space is {1, 2, 3, 4, 5, 6}. It is important to note that the sample space must be mutually exclusive and collectively exhaustive, meaning every possible outcome is listed, and no two outcomes can happen at the same time.
`;

(function loadQuestionBank() {
    function waitForApp() {
        if (typeof app === 'undefined' || !app.data) { setTimeout(waitForApp, 200); return; }

        // 1. Manually load current subjects from storage into memory
        const saved = localStorage.getItem('cbt_subjects');
        if (saved) {
            try { app.data.subjects = JSON.parse(saved); } catch(e) {}
        }

        // 2. CLEANUP: Automatically delete "General Science" if it exists
        let cleaned = false;
        for (let id in app.data.subjects) {
            if (app.data.subjects[id].name === 'General Science') {
                delete app.data.subjects[id];
                cleaned = true;
            }
        }
        if (cleaned) {
            app.saveSubjects();
            console.log('🧹 Removed old General Science data automatically.');
        }

        function parseQuestions(text) {
            const lines = text.split('\n');
            const subjects = {};
            let currentSubject = null;
            let currentTopic = null;
            let currentQuestion = null;
            let currentOptions = {};
            let explanationLines = [];
            let readingExplanation = false;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                if (line === '' || line.startsWith('===')) continue;

                if (line.match(/^Subject:/i)) {
                    if (currentQuestion) finalizeQuestion();
                    const subjectName = line.substring(8).trim();
                    if (subjectName) {
                        const newId = 'subj_' + Date.now() + '_' + Math.random();
                        currentSubject = {
                            id: newId,
                            name: subjectName,
                            duration: 30,
                            questions: [],
                            topics: [],
                            notes: {},
                            topicImages: {}
                        };
                        subjects[newId] = currentSubject;
                    }
                    continue;
                }

                if (!currentSubject) continue;

                if (line.match(/^Topic:/i)) {
                    if (currentQuestion) finalizeQuestion();
                    const topicName = line.substring(6).trim();
                    if (topicName) {
                        let existingTopic = currentSubject.topics.find(t => t.name === topicName);
                        if (!existingTopic) {
                            existingTopic = {
                                id: 'topic_' + Date.now() + '_' + Math.random(),
                                name: topicName
                            };
                            currentSubject.topics.push(existingTopic);
                        }
                        currentTopic = existingTopic;
                    }
                    continue;
                }

                if (line.match(/^Type:/i)) {
                    if (currentQuestion) finalizeQuestion();
                    const type = line.substring(5).trim().toLowerCase();
                    currentQuestion = {
                        id: Date.now() + Math.random(),
                        text: '',
                        type: type === 'mcq' ? 'objective' : (type === 'theory' ? 'theory' : 'fill'),
                        correct: '',
                        explanation: '',
                        options: type === 'mcq' ? {} : null,
                        topicId: currentTopic ? currentTopic.id : 'general',
                        maxMarks: 10
                    };
                    currentOptions = {};
                    explanationLines = [];
                    readingExplanation = false;
                    continue;
                }

                const marksMatch = line.match(/^Marks:\s*(\d+)$/i);
                if (marksMatch && currentQuestion.type === 'theory') {
                    currentQuestion.maxMarks = parseInt(marksMatch[1]);
                    continue;
                }

                if (!currentQuestion) continue;

                const qMatch = line.match(/^Q\d+:\s*(.*)$/i);
                if (qMatch) {
                    currentQuestion.text = qMatch[1].trim();
                    continue;
                }

                let optMatch = line.match(/^Option:\s*([A-D]):\s*(.*)$/i);
                if (!optMatch && currentQuestion.type === 'objective') {
                    optMatch = line.match(/^([A-D]):\s*(.*)$/i);
                }
                if (optMatch && currentQuestion.type === 'objective') {
                    const letter = optMatch[1].toUpperCase();
                    const text = optMatch[2].trim();
                    currentQuestion.options[letter] = text;
                    continue;
                }

                const ansMatch = line.match(/^Answer:\s*(.*)$/i);
                if (ansMatch) {
                    currentQuestion.correct = ansMatch[1].trim();
                    readingExplanation = false;
                    continue;
                }

                const expMatch = line.match(/^Explanation:\s*(.*)$/i);
                if (expMatch) {
                    readingExplanation = true;
                    const expText = expMatch[1].trim();
                    if (expText) explanationLines.push(expText);
                    continue;
                }

                if (readingExplanation && line) {
                    explanationLines.push(line);
                }
            }

            function finalizeQuestion() {
                if (currentQuestion && currentQuestion.text) {
                    if (explanationLines.length > 0) {
                        currentQuestion.explanation = explanationLines.join(' ');
                    }
                    
                    if (currentQuestion.type === 'objective') {
                        const optionCount = Object.keys(currentQuestion.options).length;
                        if (optionCount >= 2 && currentQuestion.correct) {
                            currentSubject.questions.push({ ...currentQuestion });
                        }
                    } else if (currentQuestion.type === 'fill') {
                        if (currentQuestion.correct) {
                            currentSubject.questions.push({ ...currentQuestion });
                        }
                    } else if (currentQuestion.type === 'theory') {
                        currentSubject.questions.push({ ...currentQuestion });
                    }
                }
                currentQuestion = null;
                currentOptions = {};
                explanationLines = [];
                readingExplanation = false;
            }

            finalizeQuestion();

            for (let id in subjects) {
                if (subjects[id].topics.length === 0) {
                    subjects[id].topics.push({ id: 'general', name: 'General' });
                }
            }
            return subjects;
        }

        function importToApp() {
            const newSubjects = parseQuestions(MY_QUESTION_BANK);
            let totalQuestions = 0;

            for (let id in newSubjects) {
                const newSubj = newSubjects[id];
                
                // Find if subject already exists by name
                let existingId = null;
                for (let key in app.data.subjects) {
                    if (app.data.subjects[key].name === newSubj.name) {
                        existingId = key;
                        break;
                    }
                }

                // OVERWRITE the existing subject so new questions (like Theory) show up!
                if (existingId) {
                newSubj.id = existingId;
                    app.data.subjects[existingId] = newSubj; 
                } else {
                    app.data.subjects[id] = newSubj;
                }
                totalQuestions += newSubj.questions.length;
            }

            try {
                app.saveSubjects();
                console.log(`✅ Successfully loaded ${totalQuestions} questions from question-bank.js`);
                if (app.data.mode === 'landing') app.showLanding();
            } catch (e) {
                console.error('Import failed:', e);
            }
        }

        importToApp();
    }
    waitForApp();
})();
