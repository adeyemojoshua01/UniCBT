/* Linear Algebra — study notes and study images */
window.CBT_SUBJECT_NOTES = window.CBT_SUBJECT_NOTES || {};
window.CBT_SUBJECT_NOTES['Linear Algebra'] = {
  'Matrices': `<h2>Matrices — working notes</h2>
<p>A matrix is a rectangular array of numbers acting as a linear map between coordinate spaces.</p>
<h3>Determinants</h3>
<p>For \\(\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\\), \\(\\det = ad - bc\\). The map is invertible exactly when \\(\\det A \\neq 0\\).</p>
<h3>Inverses</h3>
<p>\\(A^{-1} = \\frac{1}{\\det A}\\,\\text{adj}(A)\\). Always verify \\(AA^{-1} = I\\).</p>
<ul><li>Product dimension: \\((m \\times n)(n \\times p) = m \\times p\\).</li><li>Transpose swaps rows and columns.</li><li>Singular matrices have dependent rows and non-trivial kernels.</li></ul>`
};

window.CBT_SUBJECT_IMAGES = window.CBT_SUBJECT_IMAGES || {};
window.CBT_SUBJECT_IMAGES['Linear Algebra'] = {
  'Matrices': [
    { data: 'question-banks/linear-algebra/linear-map.svg', filename: 'linear-map.svg' }
  ]
};
