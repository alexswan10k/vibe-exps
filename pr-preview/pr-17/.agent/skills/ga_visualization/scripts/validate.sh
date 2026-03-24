#!/bin/bash

# Simple validation script for GA Visualization implementations

FILE=$1

if [ ! -f "$FILE" ]; then
    echo "Error: File $FILE not found."
    exit 1
fi

echo "Validating $FILE against GA Visualization best practices..."

errors=0

# Check for Internal State Mapping
if ! grep -qi "Internal State Mapping" "$FILE"; then
    echo "MISSING: Documentation of Internal State Mapping."
    errors=$((errors+1))
fi

# Check for Zero-State/Fallback behavior
if ! grep -qi "Zero-State" "$FILE"; then
    echo "MISSING: Zero-State fallback plan."
    errors=$((errors+1))
fi

# Check for normalization
if ! grep -qi "normalize" "$FILE" && ! grep -qi "mapped" "$FILE"; then
    echo "WARNING: No mention of value normalization or mapping found."
fi

if [ $errors -eq 0 ]; then
    echo "Validation PASSED."
    exit 0
else
    echo "Validation FAILED with $errors errors."
    exit 1
fi
