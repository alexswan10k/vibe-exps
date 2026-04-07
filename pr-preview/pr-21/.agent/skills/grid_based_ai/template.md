# Grid-Based AI Implementation Template

## Component: [Vehicle/Entity Name]

### 1. Road & Intersection Handling
- **Semantic Type Usage**: [How does the entity use road types 'horizontal', 'vertical', 'crossroad'?]
- **Intersection Logic**: [How are 90-degree snaps and U-turn prevention implemented?]

### 2. Collision & Evasion
- **Evasion Strategy**: [Describe the targetDirection override and backward ejection logic.]
- **Unstick Mechanism**: [Describe the positional sampling and recovery routine.]

### 3. Implementation Checklist
- [ ] Use semantic road `type` from map data for navigation.
- [ ] Implement intersection direction constraints.
- [ ] Implement `unstick` routine with positional history.
