document.addEventListener("DOMContentLoaded", function() {

    // Data Source: Based on the chat log provided
    const cheatSheetData = [
        {
            category: "Operators & Relations",
            items: [
                {
                    concept: "Fraction",
                    katex: "\\frac{a}{b}",
                    meaning: "Divide a by b",
                    fsharp: "let a,b = 7.0,2.0\nlet q = a / b"
                },
                {
                    concept: "Power",
                    katex: "x^n",
                    meaning: "x to the power n",
                    fsharp: "let x,n = 3,4\nlet xn = pown x n"
                },
                {
                    concept: "Roots",
                    katex: "\\sqrt{x}, \\sqrt[n]{x}",
                    meaning: "Square/nth root",
                    fsharp: "let r = sqrt 9.0\nlet nthRoot n x = x ** (1.0 / float n)"
                },
                {
                    concept: "Plus/Minus",
                    katex: "a \\pm b",
                    meaning: "Both a+b and a-b",
                    fsharp: "let a,b = 10.0,3.0\nlet both = [a + b; a - b]"
                },
                {
                    concept: "Approx Equal",
                    katex: "\\approx",
                    meaning: "Approximately equal",
                    fsharp: "let close eps a b = abs (a-b) <= eps"
                },
                {
                    concept: "Not Equal",
                    katex: "\\ne",
                    meaning: "Inequality",
                    fsharp: "let different = (3 <> 4)"
                },
                {
                    concept: "Inequalities",
                    katex: "\\le, \\ge, <, >",
                    meaning: "Order comparisons",
                    fsharp: "let ok1 = 3 <= 5\nlet ok2 = 7 > 2"
                }
            ]
        },
        {
            category: "Big Operators",
            items: [
                {
                    concept: "Summation",
                    katex: "\\sum_{i=1}^n i",
                    meaning: "Add a sequence",
                    fsharp: "let n = 100\nlet s = [1..n] |> List.sum"
                },
                {
                    concept: "Product",
                    katex: "\\prod_{i=1}^n i",
                    meaning: "Multiply a sequence",
                    fsharp: "let n = 6\nlet p = [1..n] |> List.fold (*) 1"
                },
                {
                    concept: "Definite Integral",
                    katex: "\\int_a^b f(x)\\,dx",
                    meaning: "Area under curve (numeric)",
                    fsharp: "let trapz f a b steps =\n  let h = (b-a)/float steps\n  let xs = [0..steps] |> List.map (fun i -> a + h*float i)\n  let ys = xs |> List.map f\n  h * (0.5*List.head ys + (ys |> List.tail |> List.take (steps-1) |> List.sum) + 0.5*List.last ys)"
                }
            ]
        },
        {
            category: "Sets & Logic",
            items: [
                {
                    concept: "Membership",
                    katex: "x \\in A",
                    meaning: "x is in set A",
                    fsharp: "let A = set [1;2;3]\nlet inside = Set.contains 2 A"
                },
                {
                    concept: "Subset",
                    katex: "A \\subseteq B",
                    meaning: "A is a subset of B",
                    fsharp: "let isSubset A B = Set.isSubset A B"
                },
                {
                    concept: "For All",
                    katex: "\\forall x \\in A, P(x)",
                    meaning: "Predicate holds for all",
                    fsharp: "let allP A P = A |> Seq.forall P"
                },
                {
                    concept: "Exists",
                    katex: "\\exists x \\in A, P(x)",
                    meaning: "At least one satisfies",
                    fsharp: "let existsP A P = A |> Seq.exists P"
                },
                {
                    concept: "Implication",
                    katex: "P \\implies Q",
                    meaning: "If P then Q",
                    fsharp: "let implies p q = (not p) || q"
                },
                {
                    concept: "Equivalence",
                    katex: "P \\iff Q",
                    meaning: "Same truth value",
                    fsharp: "let iff p q = (p && q) || ((not p) && (not q))"
                }
            ]
        },
        {
            category: "Layout & Delimiters",
            items: [
                {
                    concept: "Auto-sized Parens",
                    katex: "\\left( \\frac{a}{b} \\right)",
                    meaning: "Brackets grow to fit",
                    fsharp: "let a,b = 1.0,3.0\nlet value = a / b"
                },
                {
                    concept: "Cases / Piecewise",
                    katex: "\\begin{cases} -1 & x < 0 \\\\ 1 & x > 0 \\end{cases}",
                    meaning: "Conditional definition",
                    fsharp: "let sign x = if x < 0 then -1 elif x > 0 then 1 else 0"
                },
                {
                    concept: "Matrix",
                    katex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}",
                    meaning: "2D grid of values",
                    fsharp: "let m = array2D [ [1.0;2.0]; [3.0;4.0] ]\nlet a = m[0,0]"
                },
                {
                    concept: "Aligned",
                    katex: "\\begin{aligned} a &= 3 \\\\ b &= a+1 \\end{aligned}",
                    meaning: "Multi-line alignment",
                    fsharp: "let a = 3\nlet s1 = a + 1\nlet s2 = s1 * 2"
                }
            ]
        },
        {
            category: "Symbols",
            items: [
                {
                    concept: "Greek Letter",
                    katex: "\\lambda, \\Omega",
                    meaning: "Symbol names",
                    fsharp: "let lambda = 0.125 // Domain specific meaning"
                },
                {
                    concept: "Vector",
                    katex: "\\vec{v}",
                    meaning: "Vector notation",
                    fsharp: "type Vec2 = { x: float; y: float }\nlet v = { x=1.0; y=2.0 }"
                },
                {
                    concept: "Reals",
                    katex: "\\mathbb{R}",
                    meaning: "Set of real numbers",
                    fsharp: "let x : float = 1.23"
                }
            ]
        }
    ];

    const contentDiv = document.getElementById("content");
    const searchInput = document.getElementById("searchInput");
    const themeToggle = document.getElementById("themeToggle");

    function renderTables(filterText = "") {
        contentDiv.innerHTML = "";
        const lowerFilter = filterText.toLowerCase();

        cheatSheetData.forEach(section => {
            // Filter items
            const visibleItems = section.items.filter(item =>
                item.concept.toLowerCase().includes(lowerFilter) ||
                item.katex.toLowerCase().includes(lowerFilter) ||
                item.meaning.toLowerCase().includes(lowerFilter) ||
                item.fsharp.toLowerCase().includes(lowerFilter)
            );

            if (visibleItems.length > 0) {
                // Create Section Header
                const h2 = document.createElement("h2");
                h2.className = "section-title";
                h2.textContent = section.category;
                contentDiv.appendChild(h2);

                // Create Table
                const table = document.createElement("table");
                table.className = "cheat-table";

                const thead = document.createElement("thead");
                thead.innerHTML = `
                    <tr>
                        <th class="col-concept">Concept</th>
                        <th class="col-katex">KaTeX (Rendered / Input)</th>
                        <th class="col-meaning">Meaning</th>
                        <th class="col-fsharp">F# Equivalent</th>
                    </tr>
                `;
                table.appendChild(thead);

                const tbody = document.createElement("tbody");
                visibleItems.forEach(item => {
                    const row = document.createElement("tr");

                    // KaTeX Cell: Rendered + Input code
                    const katexCellContent = `
                        <div class="math-render">$$ ${item.katex} $$</div>
                        <code class="language-latex">${item.katex}</code>
                    `;

                    row.innerHTML = `
                        <td>${item.concept}</td>
                        <td>${katexCellContent}</td>
                        <td>${item.meaning}</td>
                        <td><pre><code class="language-fsharp">${item.fsharp}</code></pre></td>
                    `;
                    tbody.appendChild(row);
                });
                table.appendChild(tbody);
                contentDiv.appendChild(table);
            }
        });

        // Trigger KaTeX Auto-render
        if (window.renderMathInElement) {
            renderMathInElement(document.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\\\(', right: '\\\\)', display: false},
                    {left: '\\\\[', right: '\\\\]', display: true}
                ],
                throwOnError : false
            });
        }

        // Trigger Prism Highlight
        if (window.Prism) {
            Prism.highlightAll();
        }
    }

    // Initial Render
    renderTables();

    // Search Handler
    searchInput.addEventListener("input", (e) => {
        renderTables(e.target.value);
    });

    // Theme Handler
    themeToggle.addEventListener("click", () => {
        const html = document.documentElement;
        const current = html.getAttribute("data-theme");
        const next = current === "light" ? "dark" : "light";
        html.setAttribute("data-theme", next);
        themeToggle.textContent = next === "light" ? "🌙" : "☀️";
    });

    // Handle KaTeX loading race condition
    window.addEventListener('load', () => renderTables());
});
