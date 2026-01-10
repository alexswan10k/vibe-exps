document.addEventListener("DOMContentLoaded", function () {

    // Data Source: Expanded with comprehensive Math <-> F# mappings
    const cheatSheetData = [
        {
            category: "Logic & Sets",
            items: [
                {
                    concept: "Negation",
                    katex: "\\neg P",
                    meaning: "Not P",
                    fsharp: "not p"
                },
                {
                    concept: "Conjunction (And)",
                    katex: "P \\land Q",
                    meaning: "Both P and Q true",
                    fsharp: "p && q"
                },
                {
                    concept: "Disjunction (Or)",
                    katex: "P \\lor Q",
                    meaning: "At least one true",
                    fsharp: "p || q"
                },
                {
                    concept: "Exclusive Or",
                    katex: "P \\oplus Q",
                    meaning: "Exactly one true",
                    fsharp: "(p <> q)"
                },
                {
                    concept: "Implication",
                    katex: "P \\implies Q",
                    meaning: "If P then Q",
                    fsharp: "if p then q else true\n// or: (not p) || q"
                },
                {
                    concept: "Equivalence",
                    katex: "P \\iff Q",
                    meaning: "P and Q are same",
                    fsharp: "p = q"
                },
                {
                    concept: "For All",
                    katex: "\\forall x \\in S, P(x)",
                    meaning: "True for every x in S",
                    fsharp: "S |> Seq.forall (fun x -> P x)"
                },
                {
                    concept: "Exists",
                    katex: "\\exists x \\in S, P(x)",
                    meaning: "True for some x in S",
                    fsharp: "S |> Seq.exists (fun x -> P x)"
                },
                {
                    concept: "Membership",
                    katex: "x \\in S",
                    meaning: "x is in set S",
                    fsharp: "Set.contains x S"
                },
                {
                    concept: "Union",
                    katex: "A \\cup B",
                    meaning: "In A or B",
                    fsharp: "Set.union A B"
                },
                {
                    concept: "Intersection",
                    katex: "A \\cap B",
                    meaning: "In both A and B",
                    fsharp: "Set.intersect A B"
                },
                {
                    concept: "Difference",
                    katex: "A \\setminus B",
                    meaning: "In A but not B",
                    fsharp: "Set.difference A B"
                },
                {
                    concept: "Subset",
                    katex: "A \\subseteq B",
                    meaning: "A is contained in B",
                    fsharp: "Set.isSubset A B"
                },
                {
                    concept: "Empty Set",
                    katex: "\\emptyset",
                    meaning: "Set with no elements",
                    fsharp: "Set.empty"
                }
            ]
        },
        {
            category: "Arithmetic & Algebra",
            items: [
                {
                    concept: "Power",
                    katex: "x^n",
                    meaning: "x to the nth power",
                    fsharp: "pown x n      // integer n\nx ** y        // float y"
                },
                {
                    concept: "Roots",
                    katex: "\\sqrt[n]{x}",
                    meaning: "nth root of x",
                    fsharp: "sqrt x        // square root\nx ** (1.0/n)  // nth root"
                },
                {
                    concept: "Logarithm",
                    katex: "\\log_b x",
                    meaning: "Log base b",
                    fsharp: "log x         // natural log (ln)\nlog10 x       // base 10\nMath.Log(x,b) // base b"
                },
                {
                    concept: "Absolute Value",
                    katex: "|x|",
                    meaning: "Distance from zero",
                    fsharp: "abs x"
                },
                {
                    concept: "Ceilling & Floor",
                    katex: "\\lceil x \\rceil, \\lfloor x \\rfloor",
                    meaning: "Round up/down",
                    fsharp: "ceil x, floor x"
                },
                {
                    concept: "Modulo",
                    katex: "a \\equiv b \\pmod n",
                    meaning: "Remainder",
                    fsharp: "a % n"
                },
                {
                    concept: "Infinity",
                    katex: "\\infty",
                    meaning: "Infinity",
                    fsharp: "infinity      // or Double.PositiveInfinity\n-infinity"
                },
                {
                    concept: "Constants",
                    katex: "\\pi, e",
                    meaning: "Pi, Euler's number",
                    fsharp: "Math.PI\nMath.E"
                },
                {
                    concept: "Complex Numbers",
                    katex: "z = a + bi",
                    meaning: "Complex number",
                    fsharp: "input System.Numerics\nlet z = Complex(a, b)"
                },
                {
                    concept: "Complex Magnitude",
                    katex: "|z|",
                    meaning: "Modulus",
                    fsharp: "z.Magnitude"
                }
            ]
        },
        {
            category: "Sequences & Statistics",
            items: [
                {
                    concept: "Summation",
                    katex: "\\sum_{i=1}^n x_i",
                    meaning: "Sum of elements",
                    fsharp: "List.sum xs\nxs |> Seq.sum"
                },
                {
                    concept: "Product",
                    katex: "\\prod_{i=1}^n x_i",
                    meaning: "Product of elements",
                    fsharp: "xs |> List.fold (*) 1"
                },
                {
                    concept: "Mean",
                    katex: "\\bar{x} = \\frac{1}{n}\\sum x_i",
                    meaning: "Average",
                    fsharp: "List.average xs"
                },
                {
                    concept: "Max / Min",
                    katex: "\\max(S), \\min(S)",
                    meaning: "Maximum / Minimum",
                    fsharp: "List.max xs\nList.min xs"
                }
            ]
        },
        {
            category: "Linear Algebra",
            items: [
                {
                    concept: "Vector Construction",
                    katex: "\\vec{v} = \\begin{bmatrix} v_1 \\\\ v_2 \\\\ v_3 \\end{bmatrix}",
                    meaning: "Column vector",
                    fsharp: "let v = vector [1.0; 2.0; 3.0] // MathNet\n// or simply List/Array"
                },
                {
                    concept: "Dot Product",
                    katex: "\\vec{a} \\cdot \\vec{b}",
                    meaning: "Scalar product",
                    fsharp: "let dot a b = List.map2 (*) a b |> List.sum"
                },
                {
                    concept: "Cross Product",
                    katex: "\\vec{a} \\times \\vec{b}",
                    meaning: "Vector product (3D)",
                    fsharp: "// Custom 3D cross product\nlet cross (a1,a2,a3) (b1,b2,b3) = \n  (a2*b3 - a3*b2, a3*b1 - a1*b3, a1*b2 - a2*b1)"
                },
                {
                    concept: "Norm (Length)",
                    katex: "\\|\\vec{v}\\|",
                    meaning: "Euclidean length",
                    fsharp: "let norm v = v |> List.map (fun x -> x*x) |> List.sum |> sqrt"
                },
                {
                    concept: "Matrix Construction",
                    katex: "A = \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}",
                    meaning: "Matrix",
                    fsharp: "let A = array2D [[a; b]; [c; d]]"
                },
                {
                    concept: "Transpose",
                    katex: "A^T",
                    meaning: "Swap rows/cols",
                    fsharp: "// MathNet:\nA.Transpose()\n// Vanilla:\nlet transpose m n A = Array2D.init n m (fun i j -> A[j,i])"
                },
                {
                    concept: "Matrix Multiplication",
                    katex: "AB",
                    meaning: "Matrix product",
                    fsharp: "// MathNet:\nA * B\n// Vanilla is verbose (triple loop)"
                },
                {
                    concept: "Identity Matrix",
                    katex: "I_n",
                    meaning: "Diagonal 1s",
                    fsharp: "Array2D.init n n (fun i j -> if i=j then 1.0 else 0.0)"
                },
                {
                    concept: "Eigenvalues",
                    katex: "Av = \\lambda v",
                    meaning: "Eigenvalue equation",
                    fsharp: "// Requires MathNet.Numerics\nlet evd = A.Evd()\nlet lambda = evd.EigenValues"
                }

            ]
        },
        {
            category: "Calculus",
            items: [
                {
                    concept: "Function Definition",
                    katex: "f(x) = x^2 + 1",
                    meaning: "Maps x to value",
                    fsharp: "let f x = x**2.0 + 1.0"
                },
                {
                    concept: "Limit",
                    katex: "\\lim_{x \\to a} f(x)",
                    meaning: "Value as x approaches a",
                    fsharp: "// Analytical, involves symbolics usually.\n// Numeric approx:\nlet limit f a h = f(a + h)"
                },
                {
                    concept: "Derivative",
                    katex: "\\frac{df}{dx} \\approx \\frac{f(x+h)-f(x)}{h}",
                    meaning: "Rate of change",
                    fsharp: "let diff f x h = (f(x+h) - f(x)) / h"
                },
                {
                    concept: "Partial Derivative",
                    katex: "\\frac{\\partial f}{\\partial x}",
                    meaning: "Slope along x",
                    fsharp: "let partialX f (x,y) h = (f(x+h,y) - f(x,y)) / h"
                },
                {
                    concept: "Gradient",
                    katex: "\\nabla f",
                    meaning: "Vector of partials",
                    fsharp: "let grad f (x,y) h = (partialX f (x,y) h, partialY f (x,y) h)"
                },
                {
                    concept: "Composition",
                    katex: "(g \\circ f)(x) = g(f(x))",
                    meaning: "Apply f then g",
                    fsharp: "let h = f >> g  // or g << f"
                }
            ]
        },
        {
            category: "Functions",
            items: [
                {
                    concept: "Piecewise",
                    katex: "\\begin{cases} 0 & x < 0 \\\\ 1 & x \\ge 0 \\end{cases}",
                    meaning: "Conditional values",
                    fsharp: "let step x = \n  if x < 0.0 then 0.0 \n  else 1.0"
                },
                {
                    concept: "Inverse Function",
                    katex: "f^{-1}(y) = x",
                    meaning: "Reverse mapping",
                    fsharp: "// No generic operator.\n// Must implement specific inverse."
                },
                {
                    concept: "Map",
                    katex: "\\{ f(x) : x \\in S \\}",
                    meaning: "Apply to all",
                    fsharp: "S |> List.map f"
                },
                {
                    concept: "Filter",
                    katex: "\\{ x \\in S : P(x) \\}",
                    meaning: "Select satisfying P",
                    fsharp: "S |> List.filter P"
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
                // item.katex.toLowerCase().includes(lowerFilter) || // Don't search raw katex if hidden? Optional.
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
                        <th class="col-math">Symbol</th>
                        <th class="col-meaning">Meaning</th>
                        <th class="col-fsharp">F# Equivalent</th>
                    </tr>
                `;
                table.appendChild(thead);

                const tbody = document.createElement("tbody");
                visibleItems.forEach(item => {
                    const row = document.createElement("tr");

                    // KaTeX Cell: ONLY Rendered
                    const katexCellContent = `
                        <div class="math-render">$$ ${item.katex} $$</div>
                    `;

                    row.innerHTML = `
                        <td class="cell-concept">${item.concept}</td>
                        <td class="cell-math">${katexCellContent}</td>
                        <td class="cell-meaning">${item.meaning}</td>
                        <td class="cell-fsharp"><pre><code class="language-fsharp">${item.fsharp}</code></pre></td>
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
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                ],
                throwOnError: false
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
    if (document.readyState === 'loading') {
        window.addEventListener('load', () => renderTables());
    }
});
