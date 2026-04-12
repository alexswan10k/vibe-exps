#!/bin/bash

# Validation script for Grid-Based AI implementations

FILE=$1

if [ ! -f "$FILE" ]; then
    echo "Error: File $FILE not found."
    exit 1
fi

echo "Validating $FILE against Grid-Based AI best practices..."

errors=0

# Check for Semantic Road usage
if ! grep -qi "semantic" "$FILE" && ! grep -qi "type" "$FILE"; then
    echo "MISSING: Explicit mention of semantic road types."
    errors=$((errors+1))
fi

# Check for Intersection handling
if ! grep -qi "intersection" "$FILE" && ! grep -qi "crossroad" "$FILE"; then
    echo "MISSING: Intersection handling logic."
    errors=$((errors+1))
fi

# Check for Collision/Unstick logic
if ! grep -qi "unstick" "$FILE" && ! grep -qi "posHistory" "$FILE"; then
    echo "MISSING: Unstick/Collision recovery logic."
    errors=$((errors+1))
fi

if [ $errors -eq 0 ]; then
    echo "Validation PASSED."
    exit 0
else
    echo "Validation FAILED with $errors errors."
    exit 1
fi
