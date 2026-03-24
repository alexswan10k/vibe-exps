#!/bin/bash

# Validation script for Mobile Canvas UX implementations

FILE=$1

if [ ! -f "$FILE" ]; then
    echo "Error: File $FILE not found."
    exit 1
fi

echo "Validating $FILE against Mobile Canvas UX best practices..."

errors=0

# Check for passive listener mention
if ! grep -qi "passive" "$FILE"; then
    echo "MISSING: Mention of active/passive event listeners."
    errors=$((errors+1))
fi

# Check for touch-action
if ! grep -qi "touch-action" "$FILE"; then
    echo "MISSING: CSS touch-action: none configuration."
    errors=$((errors+1))
fi

# Check for touch target size
if ! grep -qi "48px" "$FILE"; then
    echo "MISSING: Confirmation of 48px touch targets."
    errors=$((errors+1))
fi

if [ $errors -eq 0 ]; then
    echo "Validation PASSED."
    exit 0
else
    echo "Validation FAILED with $errors errors."
    exit 1
fi
