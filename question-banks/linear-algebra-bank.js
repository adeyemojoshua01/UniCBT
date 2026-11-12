window.CBT_SUBJECT_BANKS = window.CBT_SUBJECT_BANKS || [];

window.CBT_SUBJECT_BANKS.push(`Subject: Linear Algebra
Duration: 40

Topic: Matrices

SubTopic: Matrix Operations
Type: MCQ
Q001: If A is a \\( 2 \\times 3 \\) matrix and B is a \\( 3 \\times 4 \\) matrix, what is the size of the product AB?
Option: A: \\( 2 \\times 4 \\)
Option: B: \\( 3 \\times 3 \\)
Option: C: \\( 4 \\times 2 \\)
Option: D: AB is not defined
Answer: A
Explanation: The product of an \\( m \\times n \\) matrix and an \\( n \\times p \\) matrix is an \\( m \\times p \\) matrix, so AB is \\( 2 \\times 4 \\).

Type: Fill
Q002: A square matrix that is equal to its own transpose is called a ____ matrix.
Answer: symmetric
Explanation: A matrix A is symmetric when \\( A^{T} = A \\), that is \\( a_{ij} = a_{ji} \\) for all i and j.

Type: MCQ
Q003: What is the trace of the matrix \\( \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix} \\)?
Option: A: 4
Option: B: 5
Option: C: 7
Option: D: 10
Answer: B
Explanation: The trace is the sum of the diagonal entries: \\( 1 + 4 = 5 \\).

SubTopic: Determinants & Inverses
Type: MCQ
Q004: Find the determinant of \\( \\begin{pmatrix} 2 & 1 \\\\ 5 & 3 \\end{pmatrix} \\).
Option: A: 1
Option: B: 6
Option: C: 11
Option: D: -1
Answer: A
Explanation: For a \\( 2 \\times 2 \\) matrix, \\( \\det = ad - bc = (2)(3) - (1)(5) = 6 - 5 = 1 \\).

Type: Fill
Q005: A square matrix A is invertible if and only if \\( \\det(A) \\neq \\) ____.
Answer: 0
Explanation: A zero determinant means the matrix is singular, so no inverse exists.

Type: Theory
Q006: Explain how the inverse of a square matrix can be found using Gauss-Jordan elimination.
Marks: 10
Explanation: Form the augmented matrix \\( [A \\mid I] \\) and apply elementary row operations (swapping rows, scaling a row, adding a multiple of one row to another) to reduce the left block A to the identity matrix I. The same operations transform the right block into \\( A^{-1} \\), giving \\( [I \\mid A^{-1}] \\). If a row of zeros appears in the left block, the matrix is singular and has no inverse.

Topic: Vector Spaces

SubTopic: Eigenvalues
Type: MCQ
Q007: What are the eigenvalues of \\( \\begin{pmatrix} 2 & 0 \\\\ 0 & 3 \\end{pmatrix} \\)?
Option: A: 0 and 5
Option: B: 2 and 3
Option: C: 1 and 6
Option: D: 6 only
Answer: B
Explanation: The eigenvalues of a triangular (here diagonal) matrix are its diagonal entries, namely 2 and 3.

Type: Fill
Q008: The equation \\( \\det(A - \\lambda I) = 0 \\) is called the ____ equation of A.
Answer: characteristic
Explanation: Its roots are exactly the eigenvalues of A.

Type: MCQ
Q009: The sum of the eigenvalues of a square matrix is equal to its:
Option: A: determinant
Option: B: rank
Option: C: trace
Option: D: nullity
Answer: C
Explanation: The sum of the eigenvalues (counted with multiplicity) equals the trace, and their product equals the determinant.

SubTopic: Independence & Basis
Type: MCQ
Q010: What is the dimension of the vector space \\( \\mathbb{R}^3 \\)?
Option: A: 1
Option: B: 2
Option: C: 3
Option: D: Infinite
Answer: C
Explanation: The standard basis \\( \\{e_1, e_2, e_3\\} \\) has three vectors, so \\( \\dim \\mathbb{R}^3 = 3 \\).

Type: Fill
Q011: A set of vectors that is linearly independent and spans a vector space is called a ____ of that space.
Answer: basis
Explanation: Every vector in the space can then be written uniquely as a linear combination of the basis vectors.

Type: Theory
Q012: Define linear independence of a set of vectors and describe a method to test whether three vectors in \\( \\mathbb{R}^3 \\) are linearly independent.
Marks: 10
Explanation: Vectors \\( v_1, \\dots, v_k \\) are linearly independent if the only solution of \\( c_1 v_1 + \\dots + c_k v_k = 0 \\) is \\( c_1 = \\dots = c_k = 0 \\). For three vectors in \\( \\mathbb{R}^3 \\), place them as columns of a \\( 3 \\times 3 \\) matrix: they are independent exactly when its determinant is non-zero (equivalently, when row reduction gives three pivots).
`);
