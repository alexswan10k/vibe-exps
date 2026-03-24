# TSP Genome Visualizer

## Component: TSP Permutation Strip

### 1. Internal State Mapping
- **Input Data Type**: Permutation of City Indices.
- **Visual Encoding**: Each city index is mapped to a unique hue using `hsl(index / totalCities * 360, 70%, 50%)`. The genome is rendered as a horizontal strip of these colored blocks.

### 2. Inspector UI
- **Active Gauges**:
  - **Match Rate**: A circular gauge showing the percentage of edges that match the current best-known solution.
  - **Genome Strip**: A 1D timeline showing the current ordering of cities.
- **Zero-State Behavior**: Displays a randomized genome strip from the initial population.

### 3. Implementation Checklist
- [x] Explicitly handle normalization of fitness/performance values.
- [x] Implement color mapping for sequence inspection.
- [x] Bind UI labels contextually.
