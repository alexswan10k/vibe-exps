const WORLD_DATA = `
W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W
W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W
W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W
W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W W
E E E E E E E E E E E E E E E E E E E E E E E E H H H H H H H H H H H H H H H H E E E E E E E E E E E E E E E E E E E E E E E E E
E E B B B B B B B B B B E E E E E E E E E E E E E H E E E E E E E E E E E E H E E E E E E E E E E E E E E B B B B B B E E E E E E
E E B E E E E E E E B E E E E E E E E E E E E E E H E B B B B B B B B B E E H E E E E E E E E E E E E E E B E E E B E E E E E E E
E E B E H H H H H E B E E E E E E E E E E E E E E E C H H H H H H H H C E E E E E E E E E E E E E E E E E B E H H H B E E E E E E
E E B E H E E E H E B E E E E E E E E E E E E E E E H E E E P P P E E H E E E E E E E E E E E E E E E E E B E H E B E E E E E E E
E E B E H E B E H E B E E E E E E E E E E E E E E E H E P P P P P P E H E E E E E E E E E E E E E E E E E B E H E B E E E E E E E
E E B E H E B E H E B E E E E E E E E E E E E E E E H E P P P T P P E H E E E E E E E E E E E E E E E E E B E H E B E E E E E E E
E E B E H E B E H E B E E E E E E E E E E E E E E E H E P P P P P P E H E E E E E E E E E E E E E E E E E B E H E B E E E E E E E
E E B E H E B E H E B E E E E E E E E E E E E E E E H E E P P P P E E H E E E E E E E E E E E E E E E E E B E H E B E E E E E E E
E E B E H E B E H E B E E E E E E E E E E E E E E E C H H H H H H H H C E E E E E E E E E E E E E E E E E B E H E B E E E E E E E
E E B E H E B E H E B E E E E E E E E E E E E E E E E H E E E E E E E H E E E E E E E E E E E E E E E E E B E H E B E E E E E E E
E E B B B B B B B B B B E E E E E E E E E E E E E E E H E B B B B B B H E E E E E E E E E E E E E E E E E B B B B B B E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E H H H H H H H H H H H H H H H H H H H H H H H H H H E E E E E E E E E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E P P P P P P E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E P P P P P P E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H H H H H H H H H H H H H H H H H H H H H H H H H H E E E P P P P P P E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E E E E E E E E E E E E E E E E E E E E E E E E H E E E P P P P P P E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E B B B B B B B B B B B B B B B B B B B B B E H E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E B E E E E E E E E E E E E E E E E E E E B E H E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E B E H H H H H H H H H H H H H H H H H E B E H E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E B E H E E E E E E E E E E E E E E H E B E H E E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E B E H E B B B B B B B B B B B E H E B E H E E E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E B E H E B E E E E E E E E B E H E B E H E E E E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E C H C H E B E H H H H H H H H E B E H C H C E E E E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E H E B E H E E E E E E E H E B E H E B E H E E E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E H E B E H E B B B B B B E H E B E H E B E H E E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E H E B E H E B E E E E B E H E B E H E B E H E E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E H E B E H E B E H H H B E H E B E H E B E H E E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E H E B E H E B E H E B E H E B E H E B E H E E E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E H E H E B E H E B E H E B E H E B E H E B E H E E E E E P P P P P P E E E E
E E E E P P P P P P E E E E E E E E E E E E E E E E E C H H H H H H H C H H H H H C H H H H H H H H C E E E E P P P P P P E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E E
`;
