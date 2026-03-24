const OpenFoodFactsService = {
    baseUrl: 'https://world.openfoodfacts.org/api/v2',

    async getProduct(barcode) {
        try {
            const response = await fetch(`${this.baseUrl}/product/${barcode}.json`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'MealPlannerApp/1.0 (web-app)'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return { success: false, error: 'Product not found' };
                }
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 0 || !data.product) {
                return { success: false, error: 'Product not found or invalid barcode' };
            }

            return {
                success: true,
                product: this._mapProduct(data.product)
            };

        } catch (error) {
            console.error("OpenFoodFacts API Error:", error);
            return { success: false, error: error.message };
        }
    },

    _mapProduct(product) {
        // Map OFF product structure to our inventory format
        // Our format needs: name, quantity (default 1), unit (default 'item'), nutritional info?

        return {
            name: product.product_name || product.product_name_en || 'Unknown Product',
            brand: product.brands,
            image: product.image_front_small_url,
            // Try to extract quantity/unit. OFF often has "quantity": "1L" or "serving_size": "..."
            // For now default to generic 1 unit.
            quantity: 1,
            unit: 'item',
            nutritional: {
                calories: product.nutriments?.['energy-kcal_100g'] || 0,
                protein: product.nutriments?.proteins_100g || 0,
                carbs: product.nutriments?.carbohydrates_100g || 0,
                fat: product.nutriments?.fat_100g || 0
            }
        };
    }
};

window.OpenFoodFactsService = OpenFoodFactsService;
