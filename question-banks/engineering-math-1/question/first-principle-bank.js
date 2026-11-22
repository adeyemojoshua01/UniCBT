window.CBT_SUBJECT_BANKS = window.CBT_SUBJECT_BANKS || [];

window.CBT_SUBJECT_BANKS.push(`Subject: Engineering math 1
Topic: First principle method
SubTopic: Direct substitution
Type: MCQ
Q001: Using first principle method, solve    \\(x^{2} + 3x +2 \\) with  respect to   \\(x \\) 
Option: A:  \\(2x^{2} +3x +2 \\)
Option: B:  \\(3x + 2 \\)
Option: C:  \\(2x + 3 \\)
Option: D:  \\(2x + 2 \\)
Answer: C
Explanation:  \\(lim_{ \\Delta x \\rightarrow 0}  \\frac{f(x+ \\Delta x) - f(x)}{ \\Delta x} \\) 

Break down
 \\(f(x) =x^{2} + 3x +2 \\) 

 \\(f(x+ \\Delta x) =(x+ \\Delta x)^{2} + 3(x+ \\Delta x) +2 \\)
 \\(f(x+ \\Delta x)= \\)  \\(x^{2} + 2x \\Delta x + \\Delta x^{2}+3x+3 \\Delta x+2 \\)

 \\(f(x+ \\Delta x)-f(x)= \\)  \\((x^{2} + 2x \\Delta x + \\Delta x^{2}+3x+3 \\Delta x+2 )-(x^2 +3x+2) \\)
 \\(f(x+ \\Delta x)-f(x)= \\)  \\(x^{2} + 2x \\Delta x + \\Delta x^{2}+3x+3 \\Delta x+2 -x^2 -3x-2 \\)

Like terms cancel out
 \\(f(x+ \\Delta x)-f(x)= \\)  \\(2x \\Delta x + \\Delta x^{2}+3 \\Delta x  \\)

 \\( \\frac{f(x+ \\Delta x)-f(x)}{ \\Delta x} =  \\frac{2x \\Delta x + \\Delta x^{2}+3 \\Delta x}{ \\Delta x} \\)

Divide the numerator by the denominator
 \\( \\frac{f(x+ \\Delta x)-f(x)}{ \\Delta x} = 2x+ \\Delta x+3 \\)

 \\(lim_{ \\Delta x \\rightarrow 0} 2x+ \\Delta x +3 \\) 
 \\(lim_{ \\Delta x \\rightarrow 0} 2x+0 +3 \\) 


 \\( \\therefore   \\frac {dy}{dx} = 2x+3 \\)
`);
