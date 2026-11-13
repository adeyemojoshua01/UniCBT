/* Physics — study notes and study images */
window.CBT_SUBJECT_NOTES = window.CBT_SUBJECT_NOTES || {};
window.CBT_SUBJECT_NOTES['Physics'] = {
  'Thermodynamics': `<h2>Thermodynamics — core notes</h2>
<p><strong>System and surroundings.</strong> A thermodynamic system is the part of the universe under study. Its boundary may allow heat or work to cross.</p>
<h3>First law</h3>
<p>Energy is conserved: \\(\\Delta U = Q - W\\), where \\(Q\\) is heat added to the system and \\(W\\) is work done <em>by</em> the system.</p>
<ul>
<li><strong>Isothermal</strong> — constant temperature, \\(\\Delta U = 0\\) for an ideal gas.</li>
<li><strong>Adiabatic</strong> — no heat exchange, \\(Q = 0\\), so \\(\\Delta U = -W\\).</li>
<li><strong>Isobaric</strong> — constant pressure, \\(W = P\\Delta V\\).</li>
<li><strong>Isochoric</strong> — constant volume, \\(W = 0\\).</li>
</ul>
<h3>Second law and entropy</h3>
<p>Spontaneous change increases total entropy. For a reversible step, \\(\\Delta S = \\frac{Q_{rev}}{T}\\), and microscopically \\(S = k_B \\ln \\Omega\\).</p>
<blockquote>Exam tip: always state the sign convention you are using before substituting into \\(\\Delta U = Q - W\\).</blockquote>`
};

window.CBT_SUBJECT_IMAGES = window.CBT_SUBJECT_IMAGES || {};
window.CBT_SUBJECT_IMAGES['Physics'] = {
  'Thermodynamics': [
    { data: 'question-banks/physics/pv-diagram.svg',    filename: 'pv-diagram.svg' },
    { data: 'question-banks/physics/carnot-cycle.svg',  filename: 'carnot-cycle.svg' }
  ]
};
