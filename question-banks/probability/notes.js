/* Probability — study notes and study images */
window.CBT_SUBJECT_NOTES = window.CBT_SUBJECT_NOTES || {};
window.CBT_SUBJECT_NOTES['Probability'] = {
  'Conditional Probability': `<h2>Conditional probability &amp; Bayes</h2>
<p>The conditional probability of \\(A\\) given \\(B\\) is \\(P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}\\), provided \\(P(B) &gt; 0\\).</p>
<h3>Independence</h3>
<p>Events are independent when \\(P(A \\cap B) = P(A)P(B)\\). Equivalently, knowing \\(B\\) does not change the chance of \\(A\\).</p>
<h3>Total probability and Bayes</h3>
<p>For a partition \\(B_1, \\dots, B_n\\): \\(P(A) = \\sum_i P(A \\mid B_i)P(B_i)\\), and therefore</p>
<p>\\[P(B_j \\mid A) = \\frac{P(A \\mid B_j)P(B_j)}{\\sum_i P(A \\mid B_i)P(B_i)}\\]</p>
<ul><li>Prior × likelihood gives the posterior numerator.</li><li>The denominator is the overall evidence.</li><li>Without replacement, the sample space shrinks each draw.</li></ul>`
};

window.CBT_SUBJECT_IMAGES = window.CBT_SUBJECT_IMAGES || {};
window.CBT_SUBJECT_IMAGES['Probability'] = {
  'Conditional Probability': [
    { data: 'question-banks/probability/probability-tree.svg', filename: 'probability-tree.svg' }
  ]
};

window.CBT_SUBJECT_REFERENCE_IMAGES = window.CBT_SUBJECT_REFERENCE_IMAGES || {};
window.CBT_SUBJECT_REFERENCE_IMAGES['Probability'] = [
  { data: 'question-banks/probability/probability-reference.svg', filename: 'probability-reference.svg' }
];
