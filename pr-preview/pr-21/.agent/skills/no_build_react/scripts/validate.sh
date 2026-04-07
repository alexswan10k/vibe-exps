#!/bin/bash

# Validation script for No-Build React implementations

FILE=$1

if [ ! -f "$FILE" ]; then
    echo "Error: File $FILE not found."
    exit 1
fi

echo "Validating $FILE against No-Build React best practices..."

errors=0

# Check for import/export (illegal in no-build)
if grep -q "import " "$FILE" || grep -q "export " "$FILE"; then
    echo "FAILED: found 'import' or 'export' statements."
    errors=$((errors+1))
fi

# Check for script type=module
if grep -q "type=\"module\"" "$FILE"; then
    echo "FAILED: found 'type=\"module\"'."
    errors=$((errors+1))
fi

# Check for React global usage
if ! grep -qi "React" "$FILE"; then
    echo "MISSING: No reference to global React object."
    errors=$((errors+1))
fi

if [ $errors -eq 0 ]; then
    echo "Validation PASSED."
    exit 0
else
    echo "Validation FAILED with $errors errors."
    exit 1
fi
