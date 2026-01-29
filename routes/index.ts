export { default as healthRoutes } from './health';
export { default as dashboardRoutes } from './dashboard';
export { default as restaurantRoutes } from './restaurants';
export { default as categoryRoutes } from './categories';
export { default as menuItemRoutes } from './menu-items';
export { default as ingredientRoutes } from './ingredients';
export { default as tableRoutes } from './tables';
export { default as orderRoutes } from './orders';
export { default as customerRoutes } from './customer';
export { default as translationRoutes } from './translations';
export { default as translationAdapterRoutes } from './translation-adapters';
export { default as oauthRoutes } from './oauth';
export { default as analyticsRoutes } from './analytics';
export { default as paymentsRoutes } from './payments';

// Export middleware for use in main routes file
export * from '../middleware'; 