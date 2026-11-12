window.CBT_SUBJECT_BANKS = window.CBT_SUBJECT_BANKS || [];
window.CBT_SUBJECT_BANKS.push(`Subject: Linear Algebra
Duration: 40
Topic: Matrices

SubTopic: Operations & Determinants
Type: MCQ
Q001: What is the determinant of the matrix \\(\\begin{pmatrix} 2 & 1 \\\\ 3 & 4 \\end{pmatrix}\\)?
Option: A: 5
Option: B: 8
Option: C: 11
Option: D: -5
Answer: A
Explanation: For a 2x2 matrix \\(\\det = ad - bc = (2)(4) - (1)(3) = 8 - 3 = 5\\).

SubTopic: Operations & Determinants
Type: MCQ
Q002: A 3x3 matrix is singular. What is its determinant?
Option: A: 1
Option: B: -1
Option: C: 0
Option: D: Positive but not 1
Answer: C
Explanation: A singular matrix is not invertible, which occurs exactly when its determinant equals zero. Its rows are linearly dependent.

SubTopic: Operations & Determinants
Type: MCQ
Q003: If A is 2x3 and B is 3x4, what are the dimensions of AB?
Option: A: 3x3
Option: B: 2x4
Option: C: 4x2
Option: D: Undefined
Answer: B
Explanation: Matrix product AB is defined because A's column count (3) matches B's row count (3), and the result has A's row count and B's column count: 2x4.

SubTopic: Operations & Determinants
Type: Fill
Q004: The transpose of a 2x3 matrix has dimensions ______.
Answer: 3x2
Explanation: Transposing swaps rows and columns, so an m x n matrix becomes n x m.

SubTopic: Inverses
Type: Theory
Q005: Explain how to determine whether a given square matrix is invertible, and describe the method of finding its inverse using the adjugate.
Marks: 10
Explanation: A square matrix A is invertible if and only if \\(\\det A \\neq 0\\); equivalently, its columns are linearly independent and its null space contains only the zero vector. When \\(\\det A \\neq 0\\), the inverse is \\(A^{-1} = \\frac{1}{\\det A}\\,\\text{adj}(A)\\), where the adjugate is the transpose of the cofactor matrix. It is wise to verify by multiplying A and A inverse to obtain the identity, since no free parameters exist in the inverse.

Topic: Vector Spaces

SubTopic: Basis & Dimension
Type: MCQ
Q006: The dimension of the vector space R^3 is:
Option: A: 2
Option: B: 3
Option: C: 4
Option: D: Infinite
Answer: B
Explanation: R^3 has the standard basis {(1,0,0), (0,1,0), (0,0,1)}, containing three independent vectors.

SubTopic: Basis & Dimension
Type: MCQ
Q007: Which set is a basis for R^2?
Option: A: {(1,0), (2,0)}
Option: B: {(1,0), (0,1)}
Option: C: {(0,0), (1,1)}
Option: D: {(1,1)}
Answer: B
Explanation: The standard basis {(1,0), (0,1)} is linearly independent and spans R^2. The set {(1,0),(2,0)} is dependent and spans only a line.

SubTopic: Basis & Dimension
Type: MCQ
Q008: A set of vectors is linearly independent if the only solution to \\(c_1v_1 + ... + c_nv_n = 0\\) is:
Option: A: Any real coefficients
Option: B: All coefficients equal to 1
Option: C: All coefficients equal to 0
Option: D: One non-zero coefficient
Answer: C
Explanation: Linear independence means the trivial combination is the only one producing the zero vector; otherwise the vectors are dependent.

SubTopic: Basis & Dimension
Type: Fill
Q009: A basis of a vector space must be both linearly independent and must ______ the space.
Answer: span
Explanation: Independence prevents redundancy and spanning ensures every element is representable. The number of basis vectors is the dimension.

SubTopic: Linear Maps
Type: Theory
Q010: Explain the rank-nullity theorem and illustrate it with a linear map from R^4 to R^3.
Marks: 10
Explanation: For a linear map \\(T: V \\to W\\) on a finite-dimensional space, \\(\\dim V = \\text{rank}(T) + \\text{nullity}(T)\\). The rank is the dimension of the image and the nullity is the dimension of the kernel. For \\(T: R^4 \\to R^3\\), the domain dimension is four while the rank cannot exceed three. If, for example, the image has dimension 3, then the kernel has dimension 1, so the map is onto but not one-to-one. The theorem captures the conservation of degrees of freedom between inputs, outputs and collapsed directions.
`);
