// LLM Provider Types
export type LLMProvider = 'lmStudio' | 'openRouter';

export interface LLMConfig {
  provider: LLMProvider;
  lmStudioEndpoint: string;
  lmStudioModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
}

// Domain Model Types
export interface RecipeNutritional {
  calories: number; // Calories per serving/portion (kcal)
  carbs: number; // Carbohydrates per serving (g)
  fat: number; // Fat per serving (g)
  protein: number; // Protein per serving (g)
  fiber: number; // Fiber per serving (g)
  vitamins: {
    vitaminA: boolean;
    vitaminC: boolean;
    vitaminD: boolean;
    vitaminE: boolean;
    vitaminK1: boolean;
    vitaminK2: boolean;
    vitaminB12: boolean;
    folate: boolean;
  };
  minerals: {
    calcium: boolean;
    iron: boolean;
    magnesium: boolean;
    potassium: boolean;
    zinc: boolean;
  };
}

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: number;
  name: string;
  ingredients: Ingredient[];
  method: string[];
  nutritional: RecipeNutritional;
}

export interface Calendar {
  Monday: number | null;
  Tuesday: number | null;
  Wednesday: number | null;
  Thursday: number | null;
  Friday: number | null;
  Saturday: number | null;
  Sunday: number | null;
}

// Component Props Interfaces
export interface CalendarProps {
  calendar: Calendar;
  handleDrop: (e: any, day: string) => void;
  handleDragOver: (e: any) => void;
  getRecipeById: (id: number) => Recipe | undefined;
  handleCook: (recipe: Recipe) => void;
  onSelectRecipe: (day: string) => void;
  inventory: Record<string, number>;
}

export interface DaySlotProps {
  day: string;
  recipeId: number | null;
  getRecipeById: (id: number) => Recipe | undefined;
  handleDrop: (e: any, day: string) => void;
  handleDragOver: (e: any) => void;
  handleCook: (recipe: Recipe) => void;
  onSelectRecipe: (day: string) => void;
  inventory: Record<string, number>;
}

export interface RecipeListProps {
  recipes: Recipe[];
  inventory: Record<string, number>;
  addRecipe: (recipeData: Partial<Recipe>) => void;
  updateRecipe: (id: number, recipeData: Partial<Recipe>) => void;
  deleteRecipe: (id: number) => void;
  onEditRecipe: (recipe: Recipe) => void;
  lmStudioEndpoint: string;
  lmStudioModel: string;
  aiMode: boolean;
  setLmStudioEndpoint: (endpoint: string) => void;
  setLmStudioModel: (model: string) => void;
  setAiMode: (mode: boolean) => void;
  generateRecipeWithAI: (prompt: string) => Promise<{ success: boolean; error?: string }>;
  setShowPasteModal: (show: boolean) => void;
}

export interface RecipeItemProps {
  recipe: Recipe;
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: number) => void;
}

export interface InventoryProps {
  inventory: Record<string, number>;
  updateInventory: (item: string, quantity: number) => void;
  recipes: Recipe[];
  calendar: Calendar;
  ingredientsData: Record<string, any>;
  updateIngredientsData: (data: Record<string, any>) => void;
}

export interface ShoppingListProps {
  shoppingList: Record<string, {quantity: number, unitCost: number}>;
  selectedShoppingItems: string[];
  toggleSelectShoppingItem: (item: string) => void;
  transferSelectedToInventory: () => void;
  updateShoppingItemCost: (item: string, unitCost: number) => void;
}

export interface NutritionProps {
  recipes: Recipe[];
  calendar: Calendar;
  getRecipeById: (id: number) => Recipe | undefined;
  ingredientsData: Record<string, any>;
}

export interface EditRecipeFormProps {
  recipe: Recipe;
  inventory: Record<string, number>;
  recipes: Recipe[];
  onSave: (recipeData: Partial<Recipe>) => void;
  onCancel: () => void;
}

export interface IngredientDropdownProps {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface RecipeSelectModalProps {
  showRecipeSelectModal: boolean;
  selectingDay: string | null;
  recipes: Recipe[];
  onSelectRecipe: (recipeId: number) => void;
  onClearRecipe: () => void;
  onClose: () => void;
}

export interface CookModalProps {
  show: boolean;
  recipe: Recipe | null;
  inventory: Record<string, number>;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface EditRecipeModalProps {
  show: boolean;
  recipe: Recipe | null;
  inventory: Record<string, number>;
  recipes: Recipe[];
  onSave: (recipeData: Partial<Recipe>) => void;
  onCancel: () => void;
}

export interface PasteResultModalProps {
  show: boolean;
  pastedResult: string;
  onPastedResultChange: (e: any) => void;
  onImport: () => void;
  onCancel: () => void;
}

export interface DataManagementModalProps {
  show: boolean;
  recipes: Recipe[];
  inventory: Record<string, number>;
  ingredientsData: Record<string, any>;
  calendar: Calendar;
  shoppingList: Record<string, {quantity: number, unitCost: number}>;
  onLoadSampleData: () => void;
  onResetToSampleData: () => void;
  onExportData: () => void;
  onImportData: (data: any) => void;
  onClearAllData: () => void;
  onClose: () => void;
  llmProvider: 'lmStudio' | 'openRouter';
  setLlmProvider: (provider: 'lmStudio' | 'openRouter') => void;
  lmStudioEndpoint: string;
  setLmStudioEndpoint: (endpoint: string) => void;
  lmStudioModel: string;
  setLmStudioModel: (model: string) => void;
  openRouterApiKey: string;
  setOpenRouterApiKey: (apiKey: string) => void;
  openRouterModel: string;
  setOpenRouterModel: (model: string) => void;
}

export interface ModalManagerProps {
  showCookModal: boolean;
  cookingRecipe: Recipe | null;
  showEditModal: boolean;
  editingRecipe: Recipe | null;
  showPasteModal: boolean;
  pastedResult: string;
  showRecipeSelectModal: boolean;
  selectingDay: string | null;
  showDataModal: boolean;
  inventory: Record<string, number>;
  recipes: Recipe[];
  confirmCook: () => void;
  cancelCook: () => void;
  updateRecipe: (id: number, recipeData: Partial<Recipe>) => void;
  addRecipe: (recipeData: Partial<Recipe>) => void;
  selectRecipeForDay: (recipeId: number) => void;
  clearRecipeForDay: () => void;
  setShowCookModal: (show: boolean) => void;
  setShowEditModal: (show: boolean) => void;
  setShowPasteModal: (show: boolean) => void;
  setPastedResult: (result: string) => void;
  setShowRecipeSelectModal: (show: boolean) => void;
  setShowDataModal: (show: boolean) => void;
  setRecipes: (recipes: Recipe[]) => void;
  setInventory: (inventory: Record<string, number>) => void;
  setIngredientsData: (data: Record<string, any>) => void;
  setCalendar: (calendar: Calendar) => void;
  setShoppingList: (list: Record<string, {quantity: number, unitCost: number}>) => void;
  llmProvider: 'lmStudio' | 'openRouter';
  setLlmProvider: (provider: 'lmStudio' | 'openRouter') => void;
  lmStudioEndpoint: string;
  setLmStudioEndpoint: (endpoint: string) => void;
  lmStudioModel: string;
  setLmStudioModel: (model: string) => void;
  openRouterApiKey: string;
  setOpenRouterApiKey: (apiKey: string) => void;
  openRouterModel: string;
  setOpenRouterModel: (model: string) => void;
}

// Component Declarations
export declare function Calendar(props: CalendarProps): any;
export declare function DaySlot(props: DaySlotProps): any;
export declare function RecipeList(props: RecipeListProps): any;
export declare function RecipeItem(props: RecipeItemProps): any;
export declare function Inventory(props: InventoryProps): any;
export declare function ShoppingList(props: ShoppingListProps): any;
export declare function Nutrition(props: NutritionProps): any;
export declare function EditRecipeForm(props: EditRecipeFormProps): any;
export declare function IngredientDropdown(props: IngredientDropdownProps): any;
export declare function RecipeSelectModal(props: RecipeSelectModalProps): any;
export declare function CookModal(props: CookModalProps): any;
export declare function EditRecipeModal(props: EditRecipeModalProps): any;
export declare function PasteResultModal(props: PasteResultModalProps): any;
export declare function DataManagementModal(props: DataManagementModalProps): any;
export declare function ModalManager(props: ModalManagerProps): any;

// App State Types
export interface AppState {
  recipes: Recipe[];
  inventory: Record<string, number>;
  ingredientsData: Record<string, any>;
  shoppingList: Record<string, {quantity: number, unitCost: number}>;
  selectedShoppingItems: string[];
  showCookModal: boolean;
  showDataModal: boolean;
  cookingRecipe: Recipe | null;
  showEditModal: boolean;
  editingRecipe: Recipe | null;
  activeTab: 'calendar' | 'inventory' | 'shopping' | 'nutrition';
  calendar: Calendar;
  llmProvider: LLMProvider;
  lmStudioEndpoint: string;
  lmStudioModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
  aiMode: boolean;
  showPasteModal: boolean;
  pastedResult: string;
  showRecipeSelectModal: boolean;
  selectingDay: string | null;
}

// Utility Types
export type DayOfWeek = keyof Calendar;
export type VitaminType = keyof RecipeNutritional['vitamins'];
export type MineralType = keyof RecipeNutritional['minerals'];
