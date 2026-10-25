# Buyer-facing charts and inspection explanations

## Market comparison

The market story starts with a plain-language conclusion, followed by the difference in money and percent relative to the nearest market-range edge. Above, below, and within-range asking prices have distinct copy. The chart uses separate, directly labelled rows on one shared price scale. Values sit outside the drawing so nearby prices cannot cause overlapping labels. A visible note identifies the cropped scale. The comparison remains readable as text without interpreting colour.

The market range is an estimate from asking prices and adjustments, rather than confirmed transactions. The demonstration label and explanation remain visible. Confidence describes data quality, rather than probability of sale.

Reference: [Datawrapper: text in data visualizations](https://www.datawrapper.de/blog/text-in-data-visualizations) — direct labels, units beside values, annotations, and a clear reading hierarchy.

## Explanations

Technical terms use a shared Ukrainian/English glossary. Explain unfamiliar calculations and abbreviations; do not add help icons to ordinary facts such as area or asking price. Definitions follow the actual valuation and investment formulas. A focusable help button opens on mouse hover, keyboard focus, or touch. Escape and outside taps close the popup. Portals and viewport positioning prevent clipping by cards. The popup stays available while the pointer moves over it.

Reference: [W3C: WCAG 2.2, Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) — dismissible, hoverable, persistent content.

## Inspection diagrams

Empty photo placeholders are replaced by Three.js diagrams selected by inspection section, with a numbered focus area and adjacent text. A buyer can switch between finding and example remedy. Green findings retain their observation view. Schemes explicitly identify themselves as illustrations, rather than actual property photographs or proof of repairs. Actual inspection attachments take precedence.

Three.js loads on demand for expanded, nearby cards. Rendering happens on resize or view changes, with no continuous animation. Geometries, materials, observers and WebGL contexts are released when the diagram unmounts. A text explanation remains available when WebGL is unavailable, and no motion is required to understand the content.
